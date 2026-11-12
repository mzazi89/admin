// MZAZI ADMIN — moving the archive into a new database.
//
// This is the half a human drives. The snapshot runs on its own; the transfer
// happens when an operator points the panel at a fresh connection string and
// presses the button, because writing into a database is not something that
// should ever happen without somebody deciding to do it.
//
// The snapshot is self-describing — it carries the schema captured at the time —
// so the target needs nothing prepared: tables are created, rows are inserted,
// sequences are moved past the highest id so the next signup does not collide
// with a restored user.
//
// Idempotent by construction: CREATE TABLE IF NOT EXISTS and ON CONFLICT DO
// NOTHING. Running it twice is a no-op, which is what makes it safe to retry a
// transfer that failed halfway.
//
// ── What a first attempt got wrong, and why it matters ──────────────────────
// The insert used ON CONFLICT (primary key) DO NOTHING. That only absorbs a
// conflict on the primary key. A target that already held a UNIQUE index on
// users.email or wallet.user_id — which a database booted by the app itself
// will have, even though the DDL generated here creates neither — turned the
// whole statement into a constraint violation, so the entire batch of 18 rows
// was lost while the run reported only "skipped". Foreign keys behaved the same
// way: one orphan row aborted 200 good ones.
//
// Two changes follow from that. The conflict clause now names no target, so any
// unique violation skips the offending row instead of the batch. And a batch
// that still fails is retried row by row, so one bad row costs one row and the
// reason is recorded against the table instead of vanishing.

import { neon } from '@neondatabase/serverless';
import zlib from 'zlib';

import { PROTECTED_TABLES, TRANSFER_BATCH_ROWS, safeIdent } from './scope';
import { decrypt } from './crypto';
import { fetchObject } from './store';

/** Anything that is not one of these is refused before a connection is opened. */
function assertPostgresUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('That is not a valid connection string.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('The target must be a postgres:// connection string.');
  }
  return url;
}

const asParam = (value) => {
  // The Neon HTTP driver sends primitives as-is. Objects and arrays (jsonb,
  // text[]) have to travel as JSON text, or they arrive as "[object Object]".
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
};

/** Read the archive back into { meta, rows: Map<table, row[]> }. */
async function readArchive(objectUrl) {
  const sealed = await fetchObject(objectUrl);
  const gz = decrypt(sealed);
  const text = zlib.gunzipSync(gz).toString('utf8');

  let meta = null;
  const rows = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const rec = JSON.parse(line);
    if (rec.kind === 'meta') {
      meta = rec;
      continue;
    }
    if (rec.kind !== 'row') continue;
    if (!rows.has(rec.table)) rows.set(rec.table, []);
    rows.get(rec.table).push(rec.row);
  }
  if (!meta) throw new Error('The archive has no schema header — it may be from an older build.');
  return { meta, rows };
}

/**
 * @param {object} opts
 * @param {string} opts.targetUrl  connection string of the new database
 * @param {string} opts.objectUrl  which snapshot to restore
 * @param {boolean} opts.dryRun    parse and report without writing anything
 * @param {boolean} opts.replace   empty the protected tables first, for an exact copy
 */
export async function transferArchive({ targetUrl, objectUrl, dryRun = false, replace = false }) {
  if (!objectUrl) throw new Error('No snapshot selected.');
  const { meta, rows } = await readArchive(objectUrl);

  const summary = {
    dryRun,
    replace,
    snapshot: { createdAt: meta.createdAt, object: objectUrl },
    tables: {},
    cleared: {},
    totals: { rows: 0, inserted: 0, skipped: 0 },
  };

  for (const [table, list] of rows) {
    summary.tables[table] = { rows: list.length, inserted: 0, skipped: 0, error: null };
    summary.totals.rows += list.length;
  }

  if (dryRun) return { ok: true, ...summary };

  if (!targetUrl) throw new Error('No target database given.');
  if (targetUrl === process.env.DATABASE_URL) {
    throw new Error('That is the current database. Point the transfer at the new one.');
  }

  const target = neon(assertPostgresUrl(targetUrl), { fetchOptions: { cache: 'no-store' } });

  // 1. Schema — exactly as it was when the snapshot was taken.
  for (const [table, def] of Object.entries(meta.schema || {})) {
    if (!safeIdent(table)) continue;
    try {
      await target(def.ddl, []);
    } catch (e) {
      summary.tables[table] = { ...(summary.tables[table] || { rows: 0 }), error: `schema: ${e.message}` };
    }
  }

  // 2. Optional clean slate. Children first, so a foreign key from an earlier
  //    table cannot block a later delete; only the tables in scope are touched.
  if (replace) {
    const childrenFirst = [...PROTECTED_TABLES].reverse();
    for (const table of childrenFirst) {
      if (!safeIdent(table)) continue;
      try {
        const removed = await target(`DELETE FROM "${table}" RETURNING 1`, []);
        summary.cleared[table] = removed.length;
      } catch (e) {
        summary.cleared[table] = `failed: ${e.message}`;
      }
    }
  }

  // 3. Rows, in batches, idempotently. Insert order matters: users before
  //    wallet, wallet before wallet_transactions, so foreign keys resolve.
  for (const [table, list] of rows) {
    if (!safeIdent(table)) continue;
    const columns = (meta.schema?.[table]?.columns || []).map((c) => c.name).filter(safeIdent);
    if (!columns.length) {
      summary.tables[table].error = 'no column metadata in the archive';
      continue;
    }

    const colSql = columns.map((c) => `"${c}"`).join(', ');
    const state = summary.tables[table];
    const errors = [];

    const build = (batch) => {
      const params = [];
      const tuples = batch.map((row) => {
        const placeholders = columns.map((c) => {
          params.push(asParam(row[c]));
          return `$${params.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });
      return {
        // No conflict target on purpose: catch every unique violation, not just
        // the primary key. RETURNING tells us which rows actually landed, so
        // "skipped" means skipped rather than "the batch blew up".
        text: `INSERT INTO "${table}" (${colSql}) VALUES ${tuples.join(', ')} ON CONFLICT DO NOTHING RETURNING 1`,
        params,
      };
    };

    const write = async (batch) => {
      const { text, params } = build(batch);
      const done = await target(text, params);
      state.inserted += done.length;
      summary.totals.inserted += done.length;
      const missed = batch.length - done.length;
      state.skipped += missed;
      summary.totals.skipped += missed;
    };

    for (let i = 0; i < list.length; i += TRANSFER_BATCH_ROWS) {
      const batch = list.slice(i, i + TRANSFER_BATCH_ROWS);
      try {
        await write(batch);
      } catch (batchError) {
        // One row the target cannot accept (a foreign key to a row that did not
        // restore, a value it cannot cast) must not take the rest of the batch
        // with it.
        for (const row of batch) {
          try {
            await write([row]);
          } catch (rowError) {
            state.skipped += 1;
            summary.totals.skipped += 1;
            const msg = String(rowError.message || rowError).slice(0, 160);
            if (!errors.includes(msg) && errors.length < 3) errors.push(msg);
          }
        }
        if (!errors.length) errors.push(String(batchError.message || batchError).slice(0, 160));
      }
    }

    if (errors.length) state.error = errors.join(' · ');

    // 4. Sequences. A restored user with id 41 must not be followed by a signup
    //    that also takes 41 — the next value has to be past the highest restored
    //    id, not past whatever the table's sequence was sitting on.
    const pk = (meta.schema?.[table]?.primaryKey || []).filter(safeIdent);
    if (pk.length === 1) {
      const idCol = pk[0];
      try {
        await target(
          `SELECT setval(pg_get_serial_sequence($1, $2),
                  COALESCE((SELECT MAX("${idCol}") FROM "${table}"), 1))`,
          [`public.${table}`, idCol]
        );
      } catch {
        // No sequence behind that column — nothing to advance.
      }
    }
  }

  return { ok: true, ...summary };
}
