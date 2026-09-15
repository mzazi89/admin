// MZAZI API — POST /api/admin/bot-commands/sync
// One-click FULL command sync from data/bot-commands.json — for EVERY bot.
//
// Upserts every command (INSERT ... ON CONFLICT (profile, name) DO UPDATE), so
// the live database rows always match the shipped registry — including fixes to
// EXISTING commands that the first-run seed never overwrites. The conflict is
// scoped to (profile, name) because `name` is no longer unique on its own: two
// bots may each own a command of the same name. Admin-authenticated.
//
// Every seed entry carries the `profile` of the bot that serves it (an absent or
// empty profile means the primary bot), so one press of the button seeds all the
// bots the seed describes — there is no per-bot target to pick. Rows the seed
// does not mention are left alone: this is an upsert, never a delete.
//
// ── Two sources, because the file is not always there ────────────────────────
// The seed is read with fs, not imported, so Next.js's file tracer cannot see it
// and a serverless build leaves it out of the function bundle. Locally that
// works; deployed it produced a button that did nothing. Two defences:
//
//   1. next.config.js lists it in outputFileTracingIncludes, so the file IS in
//      the bundle. This is the normal path (`source: 'seed'`).
//   2. If it is still missing, mirror the primary bot's rows onto every other
//      configured bot (`source: 'mirror'`). That needs only the database, which
//      is reachable whenever the panel itself is — a manual Add command already
//      proves that. The button therefore works even on a build that predates
//      the tracing fix.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';
import { requestBotCommandSync } from '@/lib/botSync';
import { listBots } from '@/lib/bots';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return false;
  try {
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    return d.role === 'admin';
  } catch {
    return false;
  }
}

export async function POST() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureDatabase();

    // Which bots exist. Resolved before anything is written, because an empty
    // profile means "the primary bot" and that needs a real id to be usable.
    const bots = await listBots(); // never throws, always at least one
    const knownIds = bots.map((b) => b.id);
    const primary = knownIds[0] || '';

    let synced = 0;
    let failed = 0;
    const errors = [];
    // Which bots this run covered, and how many rows each one got. '' is the
    // primary bot's legacy representation in the table.
    const byProfile = {};
    let source = 'seed';

    const seedPath = path.join(process.cwd(), 'data', 'bot-commands.json');

    if (fs.existsSync(seedPath)) {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const commands = Array.isArray(seed.commands) ? seed.commands : [];

      for (const c of commands) {
        try {
          // Preserve the bot a row belongs to: a seed entry without a profile
          // (the legacy shipped file) means the primary bot, never "all bots".
          const profile = typeof c.profile === 'string' && /^[A-Za-z0-9_-]{0,64}$/.test(c.profile) ? c.profile : '';
          await sql`
            INSERT INTO bot_commands
              (name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code, profile)
            VALUES
              (${c.name}, ${JSON.stringify(c.aliases || [])}::jsonb, ${c.description || ''}, ${c.category || 'General'},
               ${c.usage || ''}, ${!!c.ownerOnly}, ${!!c.adminOnly}, ${!!c.groupOnly},
               ${c.enabled !== false}, ${c.code || ''}, ${profile})
            ON CONFLICT (profile, name) DO UPDATE SET
              aliases = EXCLUDED.aliases,
              description = EXCLUDED.description,
              category = EXCLUDED.category,
              usage = EXCLUDED.usage,
              owner_only = EXCLUDED.owner_only,
              admin_only = EXCLUDED.admin_only,
              group_only = EXCLUDED.group_only,
              enabled = EXCLUDED.enabled,
              code = EXCLUDED.code,
              updated_at = CURRENT_TIMESTAMP
          `;
          synced++;
          byProfile[profile] = (byProfile[profile] || 0) + 1;
        } catch (e) {
          failed++;
          if (errors.length < 5) errors.push(`${c.name}: ${e.message}`);
        }
      }
    } else {
      // ── The file is not in this deployment ─────────────────────────────────
      // Fall back to the one source that is always present: the database. Every
      // bot except the primary gets a copy of the primary's rows, in one
      // statement per bot. DISTINCT ON (name) is required rather than optional:
      // a name can legitimately exist twice for the same bot (profile '' and the
      // explicit primary id), and an ON CONFLICT DO UPDATE that would touch the
      // same row twice aborts the whole statement with "cannot affect row a
      // second time". The most recently updated copy wins.
      source = 'mirror';
      const targets = knownIds.slice(1);

      if (!targets.length) {
        return NextResponse.json({
          error:
            'The seed file is missing from this deployment and only one bot is configured, so there is nothing to mirror. ' +
            'Add data/bot-commands.json to outputFileTracingIncludes in next.config.js, or configure a second bot profile.',
        }, { status: 500 });
      }

      for (const target of targets) {
        try {
          const written = await sql`
            INSERT INTO bot_commands
              (name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code, profile)
            SELECT DISTINCT ON (name)
              name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code, ${target}
            FROM bot_commands
            WHERE COALESCE(profile, '') = '' OR COALESCE(profile, '') = ${primary}
            ORDER BY name, updated_at DESC
            ON CONFLICT (profile, name) DO UPDATE SET
              aliases = EXCLUDED.aliases,
              description = EXCLUDED.description,
              category = EXCLUDED.category,
              usage = EXCLUDED.usage,
              owner_only = EXCLUDED.owner_only,
              admin_only = EXCLUDED.admin_only,
              group_only = EXCLUDED.group_only,
              enabled = EXCLUDED.enabled,
              code = EXCLUDED.code,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
          `;
          synced += written.length;
          byProfile[target] = written.length;
        } catch (e) {
          failed++;
          if (errors.length < 5) errors.push(`${target}: ${e.message}`);
        }
      }
    }

    // Wake EVERY bot this run wrote to. A bot_control row with no bot_id is
    // claimed by whichever bot polls first (see lib/botSync.js), so a single
    // untargeted nudge would reload one bot and leave the other serving its old
    // registry until something else happened to nudge it.
    //
    // Targeting has its own trap: the bot only claims a targeted row when bot_id
    // is one of its OWN profile ids (quartz/lib/botTelemetry.js — `bot_id IN
    // (targets)`). A row aimed at an id no bot owns is therefore never claimed,
    // and the sync silently reaches nobody. So every target is checked against
    // the configured bot list first, and anything unrecognised is reported
    // rather than written and forgotten.
    const named = [...new Set(Object.keys(byProfile))];
    const targets = [...new Set(named.map((p) => (p === '' ? primary : p)).filter(Boolean))];
    const claimable = targets.filter((t) => knownIds.indexOf(t) !== -1);
    const unclaimed = targets.filter((t) => knownIds.indexOf(t) === -1);

    for (const target of claimable) {
      try { await requestBotCommandSync(target); } catch (e) {}
    }
    // Seed entries that map to no configured bot — e.g. a profile that was
    // renamed or a bot_profiles setting that never listed this bot. Fall back to
    // one untargeted row, which ANY bot may claim, so the sync still becomes
    // visible somewhere instead of quietly doing nothing.
    if (!claimable.length) {
      try { await requestBotCommandSync(); } catch (e) {}
    }

    return NextResponse.json({ synced, failed, errors, byProfile, nudged: claimable, unclaimed, source });
  } catch (e) {
    console.error('Sync error:', e.message);
    return NextResponse.json({ error: 'Sync failed: ' + e.message }, { status: 500 });
  }
}
