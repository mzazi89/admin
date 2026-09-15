// MZAZI API — GET /api/admin/subscriptions
// Admin: READ-ONLY subscription data for the Subscriptions page and the Users
// page's plan / expiry columns.
//
// Two sources, merged by user id on the client:
//   * the bot's Prisma-managed `"Subscription"` table (quoted identifiers),
//     owned by `"User"` rows whose `"telegramId"` is the site user id;
//   * the API platform's `subscriptions` table (unquoted), joined to `users`.
//
// SELECT only — no INSERT / UPDATE / DELETE. The `"Subscription"` query is
// wrapped in its own try/catch so that if that bot table is absent on this
// deployment the route still returns `apiPlans` instead of 500ing.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return false;
  try { const d = jwt.verify(token.value, ADMIN_JWT_SECRET); return d.role === 'admin'; }
  catch { return false; }
}

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // ── Bot-side WhatsApp subscriptions (Prisma table, quoted identifiers) ──
    let botSubscriptions = [];
    try {
      const botRows = await sql`
        SELECT s."userId" AS "userId", s."plan" AS plan, s."maxDevices" AS "maxDevices",
               s."status" AS status, s."endDate" AS "endDate",
               u.email, u.fullname
        FROM "Subscription" s
        LEFT JOIN "User" bu ON bu.id = s."userId"
        LEFT JOIN users u ON u.id = bu."telegramId"
        ORDER BY s."userId" ASC
      `;
      botSubscriptions = botRows.map((r) => ({
        userId: r.userId,
        plan: r.plan || 'FREE',
        maxDevices: r.maxDevices ?? null,
        status: r.status || null,
        endDate: r.endDate || null,
        email: r.email || null,
        fullname: r.fullname || null,
      }));
    } catch (botError) {
      // The bot's Prisma schema may not be managed from this deployment — this
      // is expected on some instances, so it must not fail the whole request.
      console.error('Admin subscriptions bot-table error:', botError.message);
      botSubscriptions = [];
    }

    // ── API-platform plans (site `subscriptions` table, unquoted) ──
    const apiRows = await sql`
      SELECT s.user_id AS "userId", s.plan AS plan, s.status AS status,
             s.expires_at AS "expiresAt",
             u.email, u.fullname
      FROM subscriptions s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.user_id ASC
    `;
    const apiPlans = apiRows.map((r) => ({
      userId: r.userId,
      plan: r.plan || 'FREE',
      status: r.status || null,
      expiresAt: r.expiresAt || null,
      email: r.email || null,
      fullname: r.fullname || null,
    }));

    const counts = { bot: {}, api: {} };
    for (const s of botSubscriptions) counts.bot[s.plan] = (counts.bot[s.plan] || 0) + 1;
    for (const s of apiPlans) counts.api[s.plan] = (counts.api[s.plan] || 0) + 1;

    return NextResponse.json({ botSubscriptions, apiPlans, counts });
  } catch (error) {
    console.error('Admin subscriptions error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}
