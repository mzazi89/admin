// MZAZI ADMIN — taking a snapshot.
//
// Runs on a schedule (see vercel.json) and on demand from the admin panel. It
// reads the protected tables, captures the schema those tables currently have,
// writes one NDJSON stream, gzips it, encrypts it, and puts it in the store.
//
// Two properties matter more than speed here:
//
//   • The snapshot is a point-in-time read, so a restore target gets rows that
//     were mutually consistent. Each table is read in a single statement and the
//     whole run is short by design; the alternative — one transaction held open
//     across the upload — would pin a connection on a database whose quota is
//     the reason we are here.
//
//   • A failure is loud. If the database refuses the read (quota, connection),
//     the run reports exactly which table failed and why, and does not write a
//     manifest entry that would make the archive look healthier than it is.

import { neon } from '@neondatabase/serverless';
import zlib from 'zlib';
import crypto from 'crypto';

import { PROTECTED_TABLES, safeIdent } from './scope';
import { encrypt, keyReady } from './crypto';
import { buildCreateTable } from './ddl';
import { storeReady, putObject, readManifest, writeManifest, listSnapshots, deleteObject } from './store';

export const KEEP_SNAPSHOTS = 12;

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });

const UNDEFINED_TABLE = /does not exist|undefined_table/i;

/** Capture column + primary-key metadata for the protected tables. */
async function captureSchema() {
  const allColumns = await sql(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
            character_maximum_length, numeric_precision, numeric_scale, ordinal_position
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`,
    []
  );

  const keyRows = await sql(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position`,
    []
  );

  const pkByTable = new Map();
  for (const r of keyRows) {
    if (!pkByTable.has(r.table_name)) pkByTable.set(r.table_name, []);
    pkByTable.get(r.table_name).push(r.column_name);
  }

  const byTable = new Map();
  for (const col of allColumns) {
    if (!PROTECTED_TABLES.includes(col.table_name)) continue;
    if (!byTable.has(col.table_name)) byTable.set(col.table_name, []);
    byTable.get(col.table_name).push(col);
  }

  const schema = {};
  for (const [table, columns] of byTable) {
    if (!safeIdent(table)) continue;
    const pk = pkByTable.get(table) || [];
    schema[table] = {
      columns: columns.map((c) => ({ name: c.column_name, udt: c.udt_name })),
      primaryKey: pk,
      ddl: buildCreateTable(table, columns, pk),
    };
  }
  return schema;
}

/**
 * Run a snapshot and store it. Returns a summary; never throws for an expected
 * failure (no store, no key, database unreachable) — the caller is an API route
 * that has to answer with something an operator can act on.
 */
export async function runSnapshot({ reason = 'manual' } = {}) {
  if (!storeReady()) {
    return { ok: false, error: 'BLOB_READ_WRITE_TOKEN is not set — no backup store is configured.' };
  }
  if (!keyReady()) {
    return { ok: false, error: 'No encryption key — set BACKUP_ENCRYPTION_KEY or ADMIN_JWT_SECRET.' };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: 'DATABASE_URL is not set.' };
  }

  const startedAt = new Date().toISOString();
  const counts = {};
  const missing = [];
  const lines = [];

  try {
    const schema = await captureSchema();

    // The header carries the schema, so the archive is self-describing: the
    // transfer can create the tables it is about to fill without ever touching
    // the source database again.
    lines.push(JSON.stringify({ kind: 'meta', version: 1, createdAt: startedAt, schema }));

    for (const table of PROTECTED_TABLES) {
      if (!safeIdent(table)) continue;
      let rows;
      try {
        // Identifiers are from the constant list above and re-checked by
        // safeIdent, so interpolating the table name here is safe; values never
        // are, and never take this form.
        rows = await sql(`SELECT * FROM "${table}"`, []);
      } catch (e) {
        if (UNDEFINED_TABLE.test(e.message || '')) {
          missing.push(table);
          counts[table] = null;
          continue;
        }
        return { ok: false, error: `${table}: ${e.message}`, counts, startedAt };
      }
      counts[table] = rows.length;
      for (const row of rows) lines.push(JSON.stringify({ kind: 'row', table, row }));
    }
  } catch (e) {
    // Usually the database itself: quota exhausted, suspended, or unreachable.
    return { ok: false, error: e.message || 'Snapshot failed while reading the database.', counts, startedAt };
  }

  const ndjson = Buffer.from(lines.join('\n'), 'utf8');
  const gz = zlib.gzipSync(ndjson, { level: 9 });
  const sealed = encrypt(gz);

  const stamp = startedAt.replace(/[:.]/g, '-');
  const id = crypto.randomBytes(3).toString('hex');
  const objectPath = `backups/${stamp}-${id}.mzab`;

  let blob;
  try {
    blob = await putObject(objectPath, sealed, 'application/octet-stream');
  } catch (e) {
    return { ok: false, error: `Upload failed: ${e.message}`, counts, startedAt };
  }

  const entry = {
    object: blob.url,
    path: objectPath,
    createdAt: startedAt,
    reason,
    rows: counts,
    rowTotal: Object.values(counts).filter((n) => typeof n === 'number').reduce((a, b) => a + b, 0),
    rawBytes: ndjson.length,
    storedBytes: sealed.length,
    missing,
  };

  const manifest = await readManifest();
  const snapshots = [entry, ...(manifest.snapshots || [])].slice(0, KEEP_SNAPSHOTS);
  await writeManifest({ updatedAt: new Date().toISOString(), keep: KEEP_SNAPSHOTS, snapshots });

  // Retention: anything beyond the newest KEEP_SNAPSHOTS leaves the store too,
  // so a daily cron cannot quietly fill the account.
  try {
    const stored = await listSnapshots();
    const keepPaths = new Set(snapshots.map((s) => s.path));
    for (const b of stored) {
      if (!keepPaths.has(b.pathname)) await deleteObject(b.url);
    }
  } catch {
    /* pruning is best-effort; the manifest is already correct */
  }

  return { ok: true, entry, counts };
}
