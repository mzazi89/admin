import { adminJwtSecret } from '@/lib/authSecret';
// MZAZI API — POST /api/admin/session-action
// Admin: unlink (logout) / delete (logout + wipe) ANY paired WhatsApp session
// (no ownership check — the bot skips ownership when no accountId is sent).
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';
import { resolveBotForNumber } from '@/lib/bots';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
const ADMIN_JWT_SECRET = adminJwtSecret();
const ACTIONS = ['unlink', 'delete'];

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

    // Which bot holds this number. An unlink has to reach the bot whose session
    // folder it is: the other one would claim the row, find no such session, and
    // the device would stay linked while the panel reported success.
    const resolved = await resolveBotForNumber(number, body.bot);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const bot = resolved.bot;

    let controlAction, payload;
    if (action === 'delete') {
      controlAction = 'unpair';
      payload = { number, mode: 'delete' };
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

    // bot_id only when the target is known. Untargeted rows stay claimable by
    // any bot, which is how this endpoint behaved before bots were selectable.
    const rows = await sql`
      INSERT INTO bot_control (action, payload, status, bot_id)
      VALUES (${controlAction}, ${JSON.stringify(payload)}::jsonb, 'pending', ${resolved.named ? bot.id : ''})
      RETURNING id
    `;

    // ── Clear the number here and now ───────────────────────────────────────
    // The bot applies the queued request within ~15s and the panel used to wait
    // for it, so a deleted number sat in this very table — and, worse, went on
    // being listed as online from telemetry — long after the operator pressed
    // Delete. The row written here is the row the bot writes when it applies the
    // request, so it is written now, in the request that asked for it. The bot
    // still logs the device out and wipes the session folder; if it is offline
    // the panel is already truthful and the request waits for it in bot_control.
    //
    // Admin actions are unscoped on purpose — this endpoint is the one place a
    // session may be removed without an ownership check (see the header).
    let cleared = false;
    try {
      if (action === 'delete') {
        await sql`DELETE FROM "WhatsAppSession" WHERE "phoneNumber" = ${number}`;
      } else {
        await sql`
          UPDATE "WhatsAppSession"
          SET status = 'INACTIVE', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "phoneNumber" = ${number}
        `;
      }
      cleared = true;
    } catch (e) {
      // The queued request still runs; a cleanup failure must not fail the call.
      console.warn('[admin][session-action] could not clear the session row:', e.message);
    }

    return NextResponse.json({ requestId: rows[0].id, number, action, bot: bot.id, cleared });
  } catch (e) {
    console.error('Session action error:', e.message);
    return NextResponse.json({ error: 'Failed to run the action. Try again.' }, { status: 500 });
  }
}
