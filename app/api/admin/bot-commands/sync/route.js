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

    const seedPath = path.join(process.cwd(), 'data', 'bot-commands.json');
    if (!fs.existsSync(seedPath)) {
      return NextResponse.json({ error: 'Seed file not found: data/bot-commands.json' }, { status: 500 });
    }
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const commands = Array.isArray(seed.commands) ? seed.commands : [];

    let synced = 0;
    let failed = 0;
    const errors = [];
    // Which bots this seed covers, and how many rows each one got. The '' key is
    // the primary bot, so it is resolved to a real profile id before it is used
    // to aim a reload. Reported back so the panel can name every bot it touched.
    const byProfile = {};

    for (const c of commands) {
      try {
        // Preserve the bot a row belongs to: a seed entry without a profile (the
        // legacy shipped file) means the primary bot, never "all bots".
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

    // Wake EVERY bot this seed wrote to. A bot_control row with no bot_id is
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
    const bots = await listBots(); // never throws, always at least one
    const knownIds = bots.map((b) => b.id);
    const primary = knownIds[0] || '';
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

    return NextResponse.json({ synced, failed, errors, byProfile, nudged: claimable, unclaimed });
  } catch (e) {
    console.error('Sync error:', e.message);
    return NextResponse.json({ error: 'Sync failed: ' + e.message }, { status: 500 });
  }
}
