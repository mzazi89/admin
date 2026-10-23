// MZAZI API — GET /api/admin/sessions
//
// Admin: every paired WhatsApp session on the platform, attributed to the bot
// that holds it, so the Devices page can be split per bot.
//
// Attribution order (first hit wins):
//   1. the bot telemetry says holds the number right now  (bot_status)
//   2. the bot the last /pair request named               (bot_control)
//   3. nobody → "unassigned"
//
// (2) matters because WhatsAppSession has no bot column: once a bot stops
// heartbeating, telemetry alone would drop a number back to "unassigned" and the
// operator would lose track of which bot to send an unlink to.
//
// The list is the UNION of database rows and live telemetry, so a session the
// bot is holding without a matching row (a wiped row, a manual pairing) is still
// visible and still actionable.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';
import { deviceBotMap, listBots, listBotsWithStatus } from '@/lib/bots';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

const UNASSIGNED = '__unassigned';

const digits = (n) => String(n || '').replace(/\D/g, '');

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

/**
 * Last bot each number was paired into, from the pairing control log.
 * Newest row per number wins; numbers never paired through the site are absent.
 */
async function pairHistory() {
  try {
    const rows = await sql`
      SELECT payload->>'number' AS number, bot_id
      FROM bot_control
      WHERE action = 'pair'
        AND COALESCE(bot_id, '') <> ''
        AND payload->>'number' IS NOT NULL
      ORDER BY id DESC
      LIMIT 5000
    `;
    const map = {};
    for (const r of rows) {
      const n = digits(r.number);
      // Descending, so the first row seen for a number is the most recent.
      if (n && !map[n]) map[n] = r.bot_id;
    }
    return map;
  } catch (e) {
    console.warn('[admin][sessions] pair history unavailable:', e.message);
    return {};
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

    const [liveMap, history, profiles, status] = await Promise.all([
      deviceBotMap(),
      pairHistory(),
      listBots(),
      listBotsWithStatus(),
    ]);
    const bots = status.bots;
    const botOnline = bots.some((b) => b.online);
    const nameOf = (id) => {
      const hit = profiles.find((b) => b.id === id);
      return hit ? hit.name : id;
    };

    const sessions = rows.map((r) => {
      const number = digits(r.phoneNumber);
      const bot = liveMap[number] || history[number] || null;
      return {
        ...r,
        bot,
        botName: bot ? nameOf(bot) : null,
        active: Boolean(liveMap[number]),
        source: 'db',
      };
    });

    // Sessions the bots are holding that have no row of their own.
    const known = new Set(sessions.map((s) => digits(s.phoneNumber)));
    for (const [number, bot] of Object.entries(liveMap)) {
      if (!number || known.has(number)) continue;
      sessions.push({
        id: `live-${number}`,
        phoneNumber: number,
        status: 'ACTIVE',
        connectedAt: null,
        createdAt: null,
        updatedAt: null,
        userId: null,
        email: null,
        firstname: null,
        lastname: null,
        bot,
        botName: nameOf(bot),
        active: true,
        source: 'live',
      });
    }

    // Group order follows the configured bot order, then unassigned, then the
    // numbers inside each group by phone so the same number never jumps rows.
    const order = {};
    profiles.forEach((b, i) => { order[b.id] = i; });
    sessions.sort((a, b) => {
      const ka = a.bot ? order[a.bot] ?? 90 : 99;
      const kb = b.bot ? order[b.bot] ?? 90 : 99;
      if (ka !== kb) return ka - kb;
      return digits(a.phoneNumber).localeCompare(digits(b.phoneNumber));
    });

    // `group` is what the page filters on; `bot` stays the real profile id (or
    // null) because it is what gets sent back to /session-action. Sending the
    // sentinel there would name a bot that does not exist.
    const byBot = {};
    for (const b of profiles) byBot[b.id] = 0;
    byBot[UNASSIGNED] = 0;
    for (const s of sessions) {
      const group = s.bot || UNASSIGNED;
      s.group = group;
      byBot[group] = (byBot[group] || 0) + 1;
    }

    return NextResponse.json({
      sessions,
      bots,
      profiles,
      counts: { byBot, total: sessions.length, active: sessions.filter((s) => s.active).length },
      botOnline,
      multipleBots: bots.length > 1,
      unassignedKey: UNASSIGNED,
    });
  } catch (e) {
    console.error('Sessions error:', e.message);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}
