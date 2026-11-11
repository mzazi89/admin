// MZAZI ADMIN — support threads.
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

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        sender VARCHAR(8) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_by_admin BOOLEAN DEFAULT false,
        read_by_user BOOLEAN DEFAULT false
      )
    `;
    const threads = await sql`
      SELECT c.user_id,
             u.firstname, u.lastname, u.email,
             MAX(c.id) AS last_id,
             (SELECT body FROM chat_messages WHERE user_id = c.user_id ORDER BY id DESC LIMIT 1) AS last_body,
             (SELECT created_at FROM chat_messages WHERE user_id = c.user_id ORDER BY id DESC LIMIT 1) AS last_at,
             COUNT(*) FILTER (WHERE c.sender = 'user' AND c.read_by_admin = false) AS unread
      FROM chat_messages c
      LEFT JOIN users u ON u.id = c.user_id
      GROUP BY c.user_id, u.firstname, u.lastname, u.email
      ORDER BY last_id DESC
      LIMIT 100
    `;
    return NextResponse.json({ threads });
  } catch (e) {
    console.error('[admin] chat list:', e.message);
    return NextResponse.json({ error: 'Could not load threads' }, { status: 500 });
  }
}
