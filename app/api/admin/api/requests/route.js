import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { safeInt } from '@/lib/api/utils';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// GET /api/admin/api/requests — platform request logs (paginated, filterable)
// ?endpoint=&status=success|failed&provider_failure=1&page=&per_page=
export async function GET(request) {
  noStore();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint') || null;
    const status = url.searchParams.get('status') || null;
    const providerFailure = url.searchParams.get('provider_failure') === '1';
    const page = Math.max(1, safeInt(url.searchParams.get('page'), 1));
    const perPage = Math.min(100, Math.max(1, safeInt(url.searchParams.get('per_page'), 20)));

    const where = [];
    if (endpoint) where.push(sql`endpoint = ${endpoint}`);
    if (status === 'success') where.push(sql`status_code < 400`);
    if (status === 'failed') where.push(sql`status_code >= 400`);
    if (providerFailure) {
      where.push(sql`error_code IN ('PROVIDER_ERROR','PROVIDER_TIMEOUT','PROVIDER_NOT_CONFIGURED')`);
    }

    let whereSql = sql``;
    if (where.length > 0) {
      whereSql = sql`WHERE ${where[0]}`;
      for (let i = 1; i < where.length; i++) {
        whereSql = sql`${whereSql} AND ${where[i]}`;
      }
    }

    const [countRows, rows] = await Promise.all([
      sql`SELECT COUNT(*) AS cnt FROM api_requests ${whereSql}`,
      sql`
        SELECT r.request_id, r.endpoint, r.method, r.status_code, r.response_time_ms,
               r.provider, r.error_code, r.created_at, r.ip, k.name AS key_name,
               u.email AS user_email
        FROM api_requests r
        LEFT JOIN api_keys k ON k.id = r.api_key_id
        LEFT JOIN users u ON u.id = r.user_id
        ${whereSql}
        ORDER BY r.created_at DESC
        LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
      `,
    ]);

    return NextResponse.json({
      requests: rows,
      meta: {
        total: parseInt(countRows[0].cnt, 10) || 0,
        page,
        per_page: perPage,
        total_pages: Math.max(1, Math.ceil((parseInt(countRows[0].cnt, 10) || 0) / perPage)),
      },
    });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin requests error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
