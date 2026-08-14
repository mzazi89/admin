import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// PUT /api/admin/api/users/[id] — actions: suspend | ban | restore | set_plan
export async function PUT(request, { params }) {
  noStore();
  try {
    await requireAdmin();
    const body = await request.json();
    const action = body.action;
    const userId = parseInt(params.id, 10);

    if (!userId || Number.isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE id = ${userId} LIMIT 1`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (['suspend', 'ban', 'restore'].includes(action)) {
      const status = action === 'suspend' ? 'suspended' : action === 'ban' ? 'banned' : 'active';
      await sql`UPDATE users SET status = ${status} WHERE id = ${userId}`;
      // suspend/ban also revokes active API keys
      if (status !== 'active') {
        await sql`UPDATE api_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE user_id = ${userId} AND status = 'active'`;
      }
      return NextResponse.json({ message: `User ${status}`, status });
    }

    if (action === 'set_plan') {
      const plan = String(body.plan || '').toUpperCase();
      if (!['FREE', 'PREMIUM', 'BUSINESS', 'ADMIN'].includes(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
      }
      await sql`
        INSERT INTO subscriptions (user_id, plan, status, updated_at)
        VALUES (${userId}, ${plan}, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET plan = ${plan}, status = 'active', updated_at = CURRENT_TIMESTAMP
      `;
      await sql`UPDATE api_keys SET plan = ${plan} WHERE user_id = ${userId} AND status = 'active'`;
      return NextResponse.json({ message: `Plan set to ${plan}`, plan });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin user update error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
