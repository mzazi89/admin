import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { safeInt } from '@/lib/api/utils';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// GET /api/admin/api/keys — all API keys (hashes never returned)
export async function GET(request) {
  noStore();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const page = Math.max(1, safeInt(url.searchParams.get('page'), 1));
    const perPage = Math.min(100, Math.max(1, safeInt(url.searchParams.get('per_page'), 20)));

    const [countRows, rows] = await Promise.all([
      sql`SELECT COUNT(*) AS cnt FROM api_keys`,
      sql`
        SELECT k.id, k.name, k.key_prefix, k.status, k.plan, k.expires_at, k.last_used_at,
               k.created_at, k.revoked_at, u.email AS user_email, u.id AS user_id,
               (SELECT COUNT(*) FROM api_requests r WHERE r.api_key_id = k.id) AS request_count
        FROM api_keys k
        LEFT JOIN users u ON u.id = k.user_id
        ORDER BY k.created_at DESC
        LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
      `,
    ]);

    return NextResponse.json({
      keys: rows,
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
    console.error('[mzazi-api] admin keys error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/api/keys — actions: revoke | restore | delete
export async function PUT(request) {
  noStore();
  try {
    await requireAdmin();
    const body = await request.json();
    const keyId = safeInt(body.id, 0);
    const action = body.action;

    if (!keyId) return NextResponse.json({ error: 'Key id required' }, { status: 400 });

    if (action === 'revoke') {
      await sql`UPDATE api_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ${keyId}`;
      return NextResponse.json({ message: 'API key revoked' });
    }
    if (action === 'restore') {
      await sql`UPDATE api_keys SET status = 'active', revoked_at = NULL WHERE id = ${keyId}`;
      return NextResponse.json({ message: 'API key restored' });
    }
    if (action === 'delete') {
      await sql`DELETE FROM api_keys WHERE id = ${keyId}`;
      return NextResponse.json({ message: 'API key deleted' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin key update error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
