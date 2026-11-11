// MZAZI ADMIN — bot files (BugBot / standard bot packages).
//
// Vercel's filesystem is read-only at runtime, so the artefact lives in Postgres
// as base64 rather than on disk or in a bucket nobody provisioned. Files are
// capped at 5 MB before encoding; anything larger belongs in object storage.
//
// The shelf endpoint on the website reads this table, so publishing here is the
// only step needed to put a file on sale.

import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
const ADMIN_JWT_SECRET = adminJwtSecret();

const MAX_BYTES = 5 * 1024 * 1024;

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return false;
  try { const d = jwt.verify(token.value, ADMIN_JWT_SECRET); return d.role === 'admin'; }
  catch { return false; }
}

let ready = false;
async function ensureTable() {
  if (ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS bot_files (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(80) NOT NULL,
      variant VARCHAR(16) NOT NULL DEFAULT 'normal',
      version VARCHAR(24),
      description TEXT,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      file_name VARCHAR(120),
      mime VARCHAR(80) DEFAULT 'application/zip',
      size_bytes INTEGER DEFAULT 0,
      content TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      downloads INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  ready = true;
}

const slugify = (s) =>
  String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `bot-${Date.now()}`;

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const files = await sql`
      SELECT id, slug, name, variant, version, description, price, file_name, mime,
             size_bytes, active, downloads, created_at, updated_at
      FROM bot_files
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ files });
  } catch (error) {
    console.error('[admin] bot files GET:', error.message);
    return NextResponse.json({ error: 'Failed to load bot files' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const body = await request.json();
    const { name, variant, version, description, price, file_name, mime, content, active } = body || {};

    if (!name || !content) return NextResponse.json({ error: 'Name and file are required' }, { status: 400 });
    if (!['bugbot', 'normal'].includes(variant)) return NextResponse.json({ error: 'Variant must be bugbot or normal' }, { status: 400 });

    const bytes = Buffer.from(String(content), 'base64');
    if (!bytes.length) return NextResponse.json({ error: 'The uploaded file is empty' }, { status: 400 });
    if (bytes.length > MAX_BYTES) return NextResponse.json({ error: 'File is larger than 5 MB' }, { status: 413 });

    let slug = slugify(`${name}-${version || ''}`);
    const clash = await sql`SELECT id FROM bot_files WHERE slug = ${slug} LIMIT 1`;
    if (clash[0]) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const rows = await sql`
      INSERT INTO bot_files (slug, name, variant, version, description, price, file_name, mime, size_bytes, content, active)
      VALUES (
        ${slug}, ${name}, ${variant}, ${version || null}, ${description || null},
        ${Number(price) || 0}, ${file_name || null}, ${mime || 'application/zip'},
        ${bytes.length}, ${String(content)}, ${active !== false}
      )
      RETURNING id, slug, name, variant, version, price, size_bytes, active
    `;
    return NextResponse.json({ file: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[admin] bot files POST:', error.message);
    return NextResponse.json({ error: 'Could not save the file' }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const { id, action, ...patch } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (action === 'toggle') {
      await sql`UPDATE bot_files SET active = NOT active, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }

    // Metadata edits never touch the stored bytes.
    await sql`
      UPDATE bot_files SET
        name = COALESCE(${patch.name ?? null}, name),
        version = COALESCE(${patch.version ?? null}, version),
        description = COALESCE(${patch.description ?? null}, description),
        price = COALESCE(${patch.price != null ? Number(patch.price) : null}, price),
        active = COALESCE(${typeof patch.active === 'boolean' ? patch.active : null}, active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin] bot files PATCH:', error.message);
    return NextResponse.json({ error: 'Could not update the file' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await sql`DELETE FROM bot_files WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin] bot files DELETE:', error.message);
    return NextResponse.json({ error: 'Could not delete the file' }, { status: 500 });
  }
}
