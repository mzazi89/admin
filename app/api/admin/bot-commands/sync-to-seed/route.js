// MZAZI API — POST /api/admin/bot-commands/sync-to-seed
// One-click EXPORT of the live registry back into data/bot-commands.json —
// the vice versa of /api/admin/bot-commands/sync (which imports seed → DB).
//
// Writes every row from the Neon `bot_commands` table into the shipped seed
// file, preserving the seed's `meta` block (flags + fresh updatedAt).
//
// Two targets, picked automatically:
//   1. GITHUB_TOKEN set  → commit the seed straight to the GitHub repo via the
//      contents API (works on Vercel, whose serverless filesystem is read-only).
//      Configure: GITHUB_TOKEN, optional GITHUB_REPO (default mzazi89/admin),
//      optional GITHUB_BRANCH (default main).
//   2. no GITHUB_TOKEN   → atomic local write (tmp + rename) for local dev /
//      self-hosted deploys — then commit the seed to git yourself.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'mzazi89/admin';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const SEED_PATH = 'data/bot-commands.json';

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

// Commit the seed to GitHub via the contents API (create/update file).
async function pushSeedToGithub(content) {
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mzazi-tech-admin',
  };
  const api = `https://api.github.com/repos/${GITHUB_REPO}/contents/${SEED_PATH}`;

  // Existing file → the API requires its current sha to update it.
  let sha = null;
  const getRes = await fetch(`${api}?ref=${GITHUB_BRANCH}`, { headers });
  if (getRes.ok) {
    const meta = await getRes.json();
    sha = meta.sha || null;
  } else if (getRes.status !== 404) {
    const err = await getRes.json().catch(() => ({}));
    throw new Error(`GitHub lookup failed: ${err.message || getRes.status}`);
  }

  const putRes = await fetch(api, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Seed: sync to seed from admin — ${new Date().toISOString()}`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    throw new Error(`GitHub commit failed (${putRes.status}): ${err.message || putRes.statusText}${err.documentation_url ? '' : ''}`);
  }
  const out = await putRes.json();
  return {
    target: 'github',
    commit: out.commit?.sha || null,
    url: out.content?.html_url || `https://github.com/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${SEED_PATH}`,
  };
}

// Local-dev fallback: atomic write into the repo's data/ folder.
function writeSeedLocally(content) {
  const seedPath = path.join(process.cwd(), SEED_PATH);
  const tmp = `${seedPath}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, seedPath);
  return { target: 'local', path: SEED_PATH };
}

export async function POST() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seedPath = path.join(process.cwd(), SEED_PATH);

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
    const content = JSON.stringify(seed, null, 1);

    const result = GITHUB_TOKEN
      ? await pushSeedToGithub(content)
      : writeSeedLocally(content);

    return NextResponse.json({ written: seed.commands.length, ...result });
  } catch (e) {
    console.error('Sync-to-seed error:', e.message);
    const hint = /read-only|EROFS|EACCES|ENOENT/.test(e.message)
      ? ' Local writes are unavailable here — set GITHUB_TOKEN (Vercel → project → Settings → Environment Variables) to commit the seed to GitHub instead.'
      : '';
    return NextResponse.json({ error: 'Sync to seed failed: ' + e.message + hint }, { status: 500 });
  }
}
