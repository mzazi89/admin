// MZAZI API — GET /api/admin/sessions
// Admin: all paired WhatsApp sessions across all users, with the owner.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';
import { deviceBotMap, listBotsWithStatus } from '@/lib/bots';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

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
      SELECT ws.id, ws."phoneNumber", ws.status, ws."connectedAt",
             ws."userId", ws."createdAt", ws."updatedAt",
             u.email, u.firstname, u.lastname
      FROM "WhatsAppSession" ws
      LEFT JOIN users u ON u.id = ws."userId"
      ORDER BY ws.id DESC
    `;

    // The bot reports which numbers it currently holds in ./database/sessions/
    // (heartbeat → bot_status.session_numbers). Only those are truly ACTIVE; DB
    // rows without a live bot session are shown as offline.
    //
    // Read across EVERY bot id, not just 'main'. That literal is the single-bot
    // fallback, so reading only it would mark every session offline the moment
    // bot_profiles is configured and the bots start heartbeating under their own
    // ids. `bot` on each row is also what tells the operator which bot to issue
    // an action to.
    const botMap = await deviceBotMap();
    const { bots, multiple } = await listBotsWithStatus();
    const botOnline = bots.some((b) => b.online);

    const sessions = rows.map((r) => ({
      ...r,
      bot: botMap[String(r.phoneNumber)] || null,
      active: Boolean(botMap[String(r.phoneNumber)]),
    }));

    return NextResponse.json({ sessions, botOnline, bots, multipleBots: multiple });
  } catch (e) {
    console.error('Sessions error:', e.message);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}
