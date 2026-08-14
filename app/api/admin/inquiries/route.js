import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token');
    if (!token) return false;
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    return d.role === 'admin';
  } catch { return false; }
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS inquiries (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email  VARCHAR(255),
      user_name   VARCHAR(255),
      subject     VARCHAR(255) NOT NULL,
      message     TEXT NOT NULL,
      status      VARCHAR(50) DEFAULT 'open',
      admin_reply TEXT,
      replied_at  TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
  await sql`
    CREATE TABLE IF NOT EXISTS inquiry_messages (
      id          SERIAL PRIMARY KEY,
      inquiry_id  INTEGER REFERENCES inquiries(id) ON DELETE CASCADE,
      sender      VARCHAR(20) NOT NULL DEFAULT 'user',
      message     TEXT NOT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

// GET /api/admin/inquiries — list all inquiry threads for admin
export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureTables();
    const inquiries = await sql`
      SELECT
        i.id, i.subject, i.message, i.status,
        i.admin_reply, i.replied_at, i.created_at, i.updated_at,
        COALESCE(i.user_email, u.email)    AS user_email,
        COALESCE(i.user_name,  u.fullname) AS user_name,
        i.user_id,
        (SELECT COUNT(*) FROM inquiry_messages im WHERE im.inquiry_id = i.id) AS message_count,
        (SELECT message FROM inquiry_messages im WHERE im.inquiry_id = i.id ORDER BY im.created_at DESC LIMIT 1) AS last_message,
        (SELECT sender  FROM inquiry_messages im WHERE im.inquiry_id = i.id ORDER BY im.created_at DESC LIMIT 1) AS last_sender
      FROM inquiries i
      LEFT JOIN users u ON u.id = i.user_id
      ORDER BY
        CASE WHEN i.status = 'open' THEN 0 ELSE 1 END,
        COALESCE(i.updated_at, i.created_at) DESC
    `;
    const open    = inquiries.filter(i => i.status === 'open').length;
    const replied = inquiries.filter(i => i.status === 'replied').length;
    return NextResponse.json({ inquiries, stats: { open, replied, total: inquiries.length } });
  } catch (error) {
    console.error('Admin inquiries GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inquiries', detail: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/inquiries — admin replies to an inquiry (adds a message)
export async function PATCH(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id, admin_reply, status } = await request.json();
    if (!id) return NextResponse.json({ error: 'Inquiry ID required' }, { status: 400 });
    if (!admin_reply?.trim()) return NextResponse.json({ error: 'Reply cannot be empty' }, { status: 400 });

    await ensureTables();

    const newStatus = status || 'replied';

    // Add reply as a message in the thread
    await sql`
      INSERT INTO inquiry_messages (inquiry_id, sender, message)
      VALUES (${id}, 'admin', ${admin_reply.trim()})
    `;

    // Update the inquiry record too (for backwards compat + status)
    await sql`
      UPDATE inquiries
      SET
        admin_reply = ${admin_reply.trim()},
        status      = ${newStatus},
        replied_at  = NOW(),
        updated_at  = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ message: 'Reply sent successfully' });
  } catch (error) {
    console.error('Admin inquiries PATCH error:', error);
    return NextResponse.json({ error: 'Failed to send reply', detail: error.message }, { status: 500 });
  }
}

// GET /api/admin/inquiries/[id]/messages handled separately, but we can also
// support ?id=X query param for messages:
// This DELETE closes an inquiry
export async function DELETE(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Inquiry ID required' }, { status: 400 });
    await sql`UPDATE inquiries SET status = 'closed', updated_at = NOW() WHERE id = ${id}`;
    return NextResponse.json({ message: 'Inquiry closed' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to close inquiry', detail: error.message }, { status: 500 });
  }
}
