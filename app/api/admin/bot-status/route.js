// MZAZI API — /api/admin/bot-status
// Admin: read the bot's latest reported status.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';

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
      SELECT bot_id, online, version, uptime_seconds, telegram_online, whatsapp_sessions,
             command_count, last_sync_at, last_sync_error, last_seen_at
      FROM bot_status ORDER BY last_seen_at DESC
    `;

    const now = Date.now();
    const statuses = rows.map((r) => {
      const lastSeen = r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0;
      const online = !!r.online && now - lastSeen < 90000; // heartbeat every 30s, allow 90s grace
      return {
        botId: r.bot_id,
        online,
        version: r.version,
        uptimeSeconds: r.uptime_seconds || 0,
        telegramOnline: !!r.telegram_online,
        whatsappSessions: r.whatsapp_sessions || 0,
        commandCount: r.command_count || 0,
        lastSyncAt: r.last_sync_at,
        lastSyncError: r.last_sync_error,
        lastSeenAt: r.last_seen_at,
        lastSeenAgoSeconds: lastSeen ? Math.floor((now - lastSeen) / 1000) : null,
      };
    });

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error('Admin bot-status error:', error);
    return NextResponse.json({ error: 'Failed to fetch bot status' }, { status: 500 });
  }
}
