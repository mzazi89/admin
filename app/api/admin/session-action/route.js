// MZAZI API — POST /api/admin/session-action
// Admin: pause/resume/unlink/delete ANY paired WhatsApp session (no ownership
// check — the bot skips ownership when no accountId is sent).
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';
const ACTIONS = ['unlink', 'delete', 'pause', 'resume'];

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

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();

  try {
    let body;
    try { body = await request.json(); } catch { body = {}; }

    const number = String(body.number || '').replace(/\D/g, '');
    const action = ACTIONS.includes(body.action) ? body.action : null;
    if (!number || number.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    let controlAction, payload;
    if (action === 'delete') {
      controlAction = 'unpair';
      payload = { number, mode: 'delete' };
    } else if (action === 'pause' || action === 'resume') {
      controlAction = 'pause';
      payload = { number, paused: action === 'pause' };
    } else {
      controlAction = 'unpair';
      payload = { number };
    }

    const pending = await sql`
      SELECT id FROM bot_control
      WHERE action = ${controlAction} AND status IN ('pending', 'claimed')
        AND payload->>'number' = ${number}
      ORDER BY id DESC LIMIT 1
    `;
    if (pending.length) {
      return NextResponse.json({ error: 'A request for this number is already in progress.' }, { status: 409 });
    }

    const rows = await sql`
      INSERT INTO bot_control (action, payload, status)
      VALUES (${controlAction}, ${JSON.stringify(payload)}::jsonb, 'pending')
      RETURNING id
    `;
    return NextResponse.json({ requestId: rows[0].id, number, action });
  } catch (e) {
    console.error('Session action error:', e.message);
    return NextResponse.json({ error: 'Failed to run the action. Try again.' }, { status: 500 });
  }
}
