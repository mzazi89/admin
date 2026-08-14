import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// GET /api/admin/api/stats — platform-wide MZAZI API statistics
export async function GET() {
  noStore();
  try {
    await requireAdmin();

    const [totals, today, avg, keys, endpoints, plans, subs, recent, topEndpoints, topCategories] = await Promise.all([
      sql`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END) AS success,
               SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS failed,
               SUM(CASE WHEN error_code IN ('PROVIDER_ERROR','PROVIDER_TIMEOUT','PROVIDER_NOT_CONFIGURED') THEN 1 ELSE 0 END) AS provider_failures,
               AVG(response_time_ms)::numeric(10,1) AS avg_ms
        FROM api_requests
      `,
      sql`SELECT COUNT(*) AS cnt FROM api_requests WHERE created_at >= CURRENT_DATE`,
      sql`SELECT AVG(response_time_ms)::numeric(10,1) AS avg_ms FROM api_requests`,
      sql`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
        FROM api_keys
      `,
      sql`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS active
        FROM endpoints
      `,
      sql`
        SELECT plan, COUNT(*) AS cnt FROM subscriptions
        GROUP BY plan ORDER BY cnt DESC
      `,
      sql`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
        FROM subscriptions
      `,
      sql`
        SELECT r.request_id, r.endpoint, r.status_code, r.response_time_ms, r.error_code,
               r.created_at, k.name AS key_name, u.email AS user_email
        FROM api_requests r
        LEFT JOIN api_keys k ON k.id = r.api_key_id
        LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC LIMIT 10
      `,
      // top endpoints (last 14 days)
      sql`
        SELECT endpoint, category, SUM(requests) AS cnt, AVG(total_response_time_ms::numeric / NULLIF(requests, 0)) AS avg_ms
        FROM endpoint_usage WHERE date >= CURRENT_DATE - 13
        GROUP BY endpoint, category ORDER BY cnt DESC LIMIT 8
      `,
      // top categories (last 14 days)
      sql`
        SELECT category, SUM(requests) AS cnt, SUM(failed) AS failed
        FROM endpoint_usage WHERE date >= CURRENT_DATE - 13 AND category IS NOT NULL
        GROUP BY category ORDER BY cnt DESC LIMIT 10
      `,
    ]);

    const users = await sql`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
             SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) AS banned
      FROM users
    `;

    return NextResponse.json({
      stats: {
        total_requests: parseInt(totals[0].total, 10) || 0,
        successful: parseInt(totals[0].success, 10) || 0,
        failed: parseInt(totals[0].failed, 10) || 0,
        provider_failures: parseInt(totals[0].provider_failures, 10) || 0,
        avg_response_ms: avg[0].avg_ms ? Number(avg[0].avg_ms) : null,
        requests_today: parseInt(today[0].cnt, 10) || 0,
      },
      users: {
        total: parseInt(users[0].total, 10) || 0,
        active: parseInt(users[0].active, 10) || 0,
        suspended: parseInt(users[0].suspended, 10) || 0,
        banned: parseInt(users[0].banned, 10) || 0,
      },
      keys: {
        total: parseInt(keys[0].total, 10) || 0,
        active: parseInt(keys[0].active, 10) || 0,
      },
      endpoints: {
        total: parseInt(endpoints[0].total, 10) || 0,
        active: parseInt(endpoints[0].active, 10) || 0,
      },
      subscriptions: {
        total: parseInt(subs[0].total, 10) || 0,
        active: parseInt(subs[0].active, 10) || 0,
        by_plan: plans.map(p => ({ plan: p.plan, count: parseInt(p.cnt, 10) })),
      },
      recent_requests: recent,
      top_endpoints: topEndpoints.map(e => ({
        endpoint: e.endpoint,
        category: e.category,
        count: parseInt(e.cnt, 10) || 0,
        avg_response_ms: e.avg_ms ? Number(e.avg_ms) : null,
      })),
      top_categories: topCategories.map(c => ({
        category: c.category,
        count: parseInt(c.cnt, 10) || 0,
        failed: parseInt(c.failed, 10) || 0,
      })),
    });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin stats error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
