// MZAZI ADMIN — one support thread.
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

export async function GET(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const userId = Number(params.userId);
  const after = Number(new URL(request.url).searchParams.get('after')) || 0;
  try {
    const messages = await sql`
      SELECT id, sender, body, created_at
      FROM chat_messages
      WHERE user_id = ${userId} AND id > ${after}
      ORDER BY id ASC
      LIMIT 200
    `;
    if (messages.length) {
      await sql`UPDATE chat_messages SET read_by_admin = true WHERE user_id = ${userId} AND sender = 'user' AND read_by_admin = false`;
    }
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json({ error: 'Could not load thread' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const userId = Number(params.userId);
  try {
    const { body } = await request.json();
    const text = String(body || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    if (!text) return NextResponse.json({ error: 'Type a reply' }, { status: 400 });
    const rows = await sql`
      INSERT INTO chat_messages (user_id, sender, body, read_by_admin, read_by_user)
      VALUES (${userId}, 'admin', ${text}, true, false)
      RETURNING id, sender, body, created_at
    `;
    return NextResponse.json({ message: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Could not send' }, { status: 500 });
  }
}
