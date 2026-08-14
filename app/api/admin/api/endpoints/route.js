import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { safeInt } from '@/lib/api/utils';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// GET /api/admin/api/endpoints — registry
export async function GET() {
  noStore();
  try {
    await requireAdmin();
    const rows = await sql`
      SELECT id, path, method, category, name, description, provider, requires_query, is_active, created_at
      FROM endpoints ORDER BY category ASC, path ASC
    `;
    return NextResponse.json({ endpoints: rows });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin endpoints error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/api/endpoints — enable / disable / change provider / change upstream
export async function PUT(request) {
  noStore();
  try {
    await requireAdmin();
    const body = await request.json();
    const id = safeInt(body.id, 0);
    if (!id) return NextResponse.json({ error: 'Endpoint id required' }, { status: 400 });

    const sets = [];
    if (typeof body.is_active === 'boolean') sets.push(sql`is_active = ${body.is_active}`);
    if (typeof body.provider === 'string' && body.provider.trim()) sets.push(sql`provider = ${body.provider.trim()}`);
    if (typeof body.upstream === 'string' && body.upstream.trim()) sets.push(sql`upstream = ${body.upstream.trim()}`);
    if (typeof body.parameters === 'object' && body.parameters !== null) sets.push(sql`parameters = ${JSON.stringify(body.parameters)}::jsonb`);

    if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    let setSql = sql`${sets[0]}`;
    for (let i = 1; i < sets.length; i++) setSql = sql`${setSql}, ${sets[i]}`;
    await sql`UPDATE endpoints SET ${setSql} WHERE id = ${id}`;

    const rows = await sql`SELECT path, is_active FROM endpoints WHERE id = ${id} LIMIT 1`;
    return NextResponse.json({
      message: 'Endpoint updated',
      path: rows[0]?.path,
      is_active: rows[0]?.is_active,
    });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin endpoint update error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
