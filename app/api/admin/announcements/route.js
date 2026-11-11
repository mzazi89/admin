// MZAZI ADMIN — announcements shown in the customer app and dashboard.
//
// One table, three verbs. Publishing is a boolean on the row, so an announcement
// can be drafted, hidden, and re-shown without deleting the history.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { adminJwtSecret } from '@/lib/authSecret';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
const ADMIN_JWT_SECRET = adminJwtSecret();

async function verifyAdmin() {
  const store = await cookies();
  const token = store.get('admin_token');
  if (!token) return false;
  try { return jwt.verify(token.value, ADMIN_JWT_SECRET).role === 'admin'; } catch { return false; }
}

let ready = false;
async function ensureTable() {
  if (ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      body TEXT,
      level VARCHAR(16) DEFAULT 'info',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  ready = true;
}

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const rows = await sql`SELECT id, title, body, level, active, created_at FROM announcements ORDER BY created_at DESC`;
    return NextResponse.json({ announcements: rows });
  } catch (e) {
    console.error('[admin] announcements GET:', e.message);
    return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const { title, body, level } = await request.json();
    if (!title?.trim()) return NextResponse.json({ error: 'A title is required' }, { status: 400 });
    const rows = await sql`
      INSERT INTO announcements (title, body, level)
      VALUES (${title.trim()}, ${body?.trim() || null}, ${['info', 'success', 'warning'].includes(level) ? level : 'info'})
      RETURNING id, title, body, level, active, created_at
    `;
    return NextResponse.json({ announcement: rows[0] }, { status: 201 });
  } catch (e) {
    console.error('[admin] announcements POST:', e.message);
    return NextResponse.json({ error: 'Could not publish the announcement' }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const { id, action } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (action === 'toggle') {
      await sql`UPDATE announcements SET active = NOT active, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: 'Could not update' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await sql`DELETE FROM announcements WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Could not delete' }, { status: 500 });
  }
}
