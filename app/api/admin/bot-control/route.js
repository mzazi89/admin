// MZAZI API — /api/admin/bot-control
// Admin: issue control actions to the bot + view recent control history.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';
const ACTIONS = ['sync', 'broadcast', 'botname'];

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

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const rows = await sql`
      SELECT id, action, payload, status, result, created_at, claimed_at, done_at
      FROM bot_control ORDER BY id DESC LIMIT 25
    `;
    return NextResponse.json({
      controls: rows.map((r) => ({
        id: r.id,
        action: r.action,
        payload: r.payload || {},
        status: r.status,
        result: r.result,
        createdAt: r.created_at,
        claimedAt: r.claimed_at,
        doneAt: r.done_at,
      })),
    });
  } catch (error) {
    console.error('Admin bot-control list error:', error);
    return NextResponse.json({ error: 'Failed to fetch controls' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const body = await request.json();
    if (!body || !ACTIONS.includes(body.action)) {
      return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 });
    }
    if (body.action === 'broadcast' && (!body.payload?.message || typeof body.payload.message !== 'string')) {
      return NextResponse.json({ error: 'broadcast requires payload.message' }, { status: 400 });
    }
    if (body.action === 'botname' && (!body.payload?.name || typeof body.payload.name !== 'string')) {
      return NextResponse.json({ error: 'botname requires payload.name' }, { status: 400 });
    }

    const ins = await sql`
      INSERT INTO bot_control (action, payload)
      VALUES (${body.action}, ${body.payload || {}})
      RETURNING id, action, status
    `;

    return NextResponse.json({ ok: true, control: ins[0] }, { status: 201 });
  } catch (error) {
    console.error('Admin bot-control create error:', error);
    return NextResponse.json({ error: 'Failed to issue control' }, { status: 500 });
  }
}
