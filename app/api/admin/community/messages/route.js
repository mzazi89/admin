import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
const ADMIN_JWT_SECRET = adminJwtSecret();

// MZAZI ADMIN — the founder's side of the community room.
//
// The customer site moved from one flat `community_messages` table to a real
// chat model (com_chats / com_members / com_messages — see web/lib/community.js),
// so this route reads and writes the MAIN room there instead. The response is
// still the flat shape the admin page renders, which is why that page needed no
// change:
//
//   { id, user_id, user_name, message, role, created_at }
//
// Admin messages carry `sender_id = NULL` and `sender_label`, precisely so an
// operator post is distinguishable from a customer's without inventing a user row
// in `users` (which would appear in the member directory and could be paired).
const FOUNDER = 'Dominic (Founder)';
const MAIN_KEY = 'main';

async function verifyAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token');
    if (!token) return null;
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    if (d.role !== 'admin') return null;
    return { id: 0, name: FOUNDER, role: 'admin' };
  } catch { return null; }
}

async function ensureMain() {
  await sql`
    CREATE TABLE IF NOT EXISTS com_chats (
      id              SERIAL PRIMARY KEY,
      kind            VARCHAR(8)  NOT NULL DEFAULT 'group',
      title           VARCHAR(120),
      about           VARCHAR(255) DEFAULT '',
      dm_key          VARCHAR(48) UNIQUE,
      is_main         BOOLEAN DEFAULT false,
      created_by      INTEGER,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS com_messages (
      id           SERIAL PRIMARY KEY,
      chat_id      INTEGER NOT NULL,
      sender_id    INTEGER,
      sender_label VARCHAR(80),
      kind         VARCHAR(10) DEFAULT 'text',
      body         TEXT NOT NULL DEFAULT '',
      reply_to     INTEGER,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      edited_at    TIMESTAMP,
      deleted_at   TIMESTAMP
    )
  `;
  await sql`
    INSERT INTO com_chats (kind, title, dm_key, is_main, about)
    SELECT 'group', 'MZAZI Community', ${MAIN_KEY}, true, 'Everyone on MZAZI TECH'
    WHERE NOT EXISTS (SELECT 1 FROM com_chats WHERE dm_key = ${MAIN_KEY})
  `;
  const rows = await sql`SELECT id FROM com_chats WHERE dm_key = ${MAIN_KEY} LIMIT 1`;
  return rows[0]?.id || null;
}

const shape = (r) => ({
  id: r.id,
  user_id: r.sender_id || 0,
  user_name: r.sender_label || r.fullname || r.email || 'Member',
  message: r.deleted_at ? 'This message was deleted' : r.body,
  role: r.sender_id ? 'user' : 'admin',
  created_at: r.created_at,
});

// GET /api/admin/community/messages?lastId=
export async function GET(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const chatId = await ensureMain();
    if (!chatId) return NextResponse.json({ messages: [] });

    const { searchParams } = new URL(request.url);
    const lastId = parseInt(searchParams.get('lastId') || '0', 10) || 0;

    const messages = await sql`
      SELECT x.id, x.sender_id, x.sender_label, x.body, x.created_at, x.deleted_at,
             u.fullname, u.email
      FROM com_messages x LEFT JOIN users u ON u.id = x.sender_id
      WHERE x.chat_id = ${chatId} AND x.id > ${lastId}
      ORDER BY x.id ASC LIMIT 100
    `;
    return NextResponse.json({ messages: messages.map(shape) });
  } catch (error) {
    console.error('[admin/community] GET', error?.message || error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/admin/community/messages  { message }
export async function POST(request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const chatId = await ensureMain();
    if (!chatId) return NextResponse.json({ error: 'Community room is not ready' }, { status: 503 });

    let body;
    try { body = await request.json(); } catch { body = {}; }
    const text = String(body.message || body.body || '').replace(/\u0000/g, '').trim().slice(0, 4000);
    if (!text) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const rows = await sql`
      INSERT INTO com_messages (chat_id, sender_id, sender_label, kind, body)
      VALUES (${chatId}, NULL, ${FOUNDER}, 'text', ${text})
      RETURNING id, chat_id, sender_id, sender_label, body, created_at, deleted_at
    `;
    await sql`UPDATE com_chats SET last_message_at = NOW() WHERE id = ${chatId}`;

    return NextResponse.json({ message: shape(rows[0]) });
  } catch (error) {
    console.error('[admin/community] POST', error?.message || error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
