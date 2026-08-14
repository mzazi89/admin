import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// GET /api/admin/api/users — list users with plan + API platform stats
export async function GET(request) {
  noStore();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page'), 10) || 20));

    const where = search ? sql`WHERE (u.email ILIKE ${'%' + search + '%'} OR u.fullname ILIKE ${'%' + search + '%'})` : sql``;

    const [countRows, rows] = await Promise.all([
      sql`SELECT COUNT(*) AS cnt FROM users u ${where}`,
      sql`
        SELECT u.id, u.email, u.firstname, u.lastname, u.fullname, u.role, u.status, u.created_at,
               s.plan AS plan, s.status AS subscription_status,
               (SELECT COUNT(*) FROM api_keys k WHERE k.user_id = u.id) AS key_count,
               (SELECT COUNT(*) FROM api_requests r WHERE r.user_id = u.id) AS request_count
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id
        ${where}
        ORDER BY u.created_at DESC
        LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
      `,
    ]);

    return NextResponse.json({
      users: rows,
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
    console.error('[mzazi-api] admin users error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
