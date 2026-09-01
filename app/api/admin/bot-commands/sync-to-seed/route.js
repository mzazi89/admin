// MZAZI API — POST /api/admin/bot-commands/sync-to-seed
// One-click EXPORT of the live registry back into data/bot-commands.json —
// the vice versa of /api/admin/bot-commands/sync (which imports seed → DB).
//
// Writes every row from the Neon `bot_commands` table into the shipped seed
// file, preserving the seed's `meta` block (flags + fresh updatedAt). Use it
// after bulk edits in this panel to make the current live state the new seed.
//
// NOTE: Vercel's serverless filesystem is read-only — the write only works in
// local dev / self-hosted deploys, where you then commit the seed to git.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
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

// DB row → seed-file shape (camelCase, matching data/bot-commands.json).
const toSeed = (r) => ({
  name: r.name,
  aliases: Array.isArray(r.aliases) ? r.aliases : [],
  description: r.description || '',
  category: r.category || 'General',
  usage: r.usage || '',
  ownerOnly: !!r.owner_only,
  adminOnly: !!r.admin_only,
  groupOnly: !!r.group_only,
  enabled: r.enabled !== false,
  code: r.code || '',
});

export async function POST() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seedPath = path.join(process.cwd(), 'data', 'bot-commands.json');

  // Keep the shipped meta flags; only refresh updatedAt.
  let meta = { schemaVersion: 1 };
  if (fs.existsSync(seedPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (existing && typeof existing.meta === 'object') meta = { ...existing.meta };
    } catch {
      // Corrupt/missing seed — fall back to defaults rather than failing.
    }
  }

  try {
    const rows = await sql`
      SELECT name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code
      FROM bot_commands
      ORDER BY name ASC
    `;

    const seed = {
      meta: { ...meta, updatedAt: new Date().toISOString() },
      commands: rows.map(toSeed),
    };

    // Atomic write: temp file + rename so a partial write can never corrupt the seed.
    const tmp = `${seedPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(seed, null, 1));
    fs.renameSync(tmp, seedPath);

    return NextResponse.json({ written: seed.commands.length, path: 'data/bot-commands.json' });
  } catch (e) {
    console.error('Sync-to-seed error:', e.message);
    const hint = /read-only|EROFS|EACCES|ENOENT/.test(e.message)
      ? ' The server filesystem is read-only (e.g. Vercel serverless) — run this in local dev or a self-hosted deploy, then commit the seed to git.'
      : '';
    return NextResponse.json({ error: 'Sync to seed failed: ' + e.message + hint }, { status: 500 });
  }
}
