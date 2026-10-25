import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token');
    if (!token) return null;
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    if (d.role !== 'admin') return null;
    return { id: 0, name: 'Dominic (Founder)', role: 'admin' };
  } catch { return null; }
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS community_messages (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER,
      user_name   VARCHAR(255) NOT NULL,
      message     TEXT NOT NULL,
      role        VARCHAR(50) DEFAULT 'user',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

// GET /api/admin/community/messages
export async function GET(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const lastId = parseInt(searchParams.get('lastId') || '0');

    const messages = await sql`
      SELECT * FROM community_messages 
      WHERE id > ${lastId}
      ORDER BY created_at ASC 
      LIMIT 100
    `;
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/admin/community/messages
export async function POST(request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { message } = await request.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Empty' }, { status: 400 });

    await ensureTable();
    const result = await sql`
      INSERT INTO community_messages (user_id, user_name, message, role)
      VALUES (${admin.id}, ${admin.name}, ${message.trim()}, 'admin')
      RETURNING *
    `;
    return NextResponse.json({ message: result[0] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
