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

// ── Broadcast buttons ────────────────────────────────────────────────────────
// The bot puts a photo and two buttons on a broadcast of its own accord (see
// lib/botTelemetry.js in the bot repos), so what the admin sends here is an
// OVERRIDE, not a requirement. Anything unusable is dropped rather than rejected:
// a broadcast is a one-way message the operator has already written, and failing
// it over an over-long button label would be the wrong trade.
//
// The limits are WhatsApp's, and they are hard limits — a label of 21 characters
// or a fourth button does not get trimmed by the client, it fails to send.
const MAX_BUTTONS = 3;
const MAX_LABEL = 20;
const MAX_COMMAND = 60;

function normaliseButtons(input) {
  if (!Array.isArray(input)) return undefined;
  const buttons = input
    .map((b) => ({
      id: String((b && (b.id || b.command)) || '').trim().slice(0, MAX_COMMAND),
      text: String((b && (b.text || b.label)) || '').trim().slice(0, MAX_LABEL),
    }))
    .filter((b) => b.id && b.text)
    .slice(0, MAX_BUTTONS);
  return buttons.length ? buttons : undefined;
}

/** Only an http(s) URL, and only one short enough to be one. */
function normaliseImage(input) {
  if (typeof input !== 'string') return undefined;
  const url = input.trim();
  if (!url || url.length > 2048) return undefined;
  if (!/^https?:\/\//i.test(url)) return undefined;
  return url;
}

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

    // The broadcast payload is rebuilt rather than passed through, so the row the
    // bot will read holds only what was validated here.
    let payload = body.payload || {};
    if (body.action === 'broadcast') {
      payload = {
        message: String(payload.message).slice(0, 4096),
        ...(normaliseImage(payload.image) ? { image: normaliseImage(payload.image) } : {}),
        ...(normaliseButtons(payload.buttons) ? { buttons: normaliseButtons(payload.buttons) } : {}),
      };
    }

    const ins = await sql`
      INSERT INTO bot_control (action, payload)
      VALUES (${body.action}, ${payload})
      RETURNING id, action, status
    `;

    return NextResponse.json({ ok: true, control: ins[0] }, { status: 201 });
  } catch (error) {
    console.error('Admin bot-control create error:', error);
    return NextResponse.json({ error: 'Failed to issue control' }, { status: 500 });
  }
}
