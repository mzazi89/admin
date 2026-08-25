// MZAZI API — POST /api/admin/bot-commands/sync
// One-click FULL command sync from data/bot-commands.json.
//
// Upserts every command (INSERT ... ON CONFLICT (name) DO UPDATE), so the live
// database rows always match the shipped registry — including fixes to EXISTING
// commands that the first-run seed never overwrites. Admin-authenticated.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';
import { requestBotCommandSync } from '@/lib/botSync';
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

    for (const c of commands) {
      try {
        await sql`
          INSERT INTO bot_commands
            (name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code)
          VALUES
            (${c.name}, ${JSON.stringify(c.aliases || [])}::jsonb, ${c.description || ''}, ${c.category || 'General'},
             ${c.usage || ''}, ${!!c.ownerOnly}, ${!!c.adminOnly}, ${!!c.groupOnly},
             ${c.enabled !== false}, ${c.code || ''})
          ON CONFLICT (name) DO UPDATE SET
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
      } catch (e) {
        failed++;
        if (errors.length < 5) errors.push(`${c.name}: ${e.message}`);
      }
    }

    // Nudge the bot to re-import the registry (falls back to its 15s telemetry poll).
    try { await requestBotCommandSync(); } catch (e) {}

    return NextResponse.json({ synced, failed, errors });
  } catch (e) {
    console.error('Sync error:', e.message);
    return NextResponse.json({ error: 'Sync failed: ' + e.message }, { status: 500 });
  }
}
