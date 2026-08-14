import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { safeInt } from '@/lib/api/utils';
import { getProvider } from '@/lib/providers';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// GET /api/admin/api/providers — provider registry + latest health checks
export async function GET() {
  noStore();
  try {
    await requireAdmin();
    const rows = await sql`
      SELECT p.id, p.name, p.display_name, p.base_url, p.api_key_configured, p.status,
             p.avg_response_ms, p.failure_rate, p.total_requests, p.total_failures,
             p.last_success_at, p.last_failure_at, p.last_error, p.updated_at,
             (SELECT response_time_ms FROM provider_health h WHERE h.provider_id = p.id ORDER BY h.checked_at DESC LIMIT 1) AS last_check_ms,
             (SELECT ok FROM provider_health h WHERE h.provider_id = p.id ORDER BY h.checked_at DESC LIMIT 1) AS last_check_ok
      FROM providers p ORDER BY p.name
    `;
    return NextResponse.json({ providers: rows });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin providers error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/api/providers — { id, status?, base_url? }
export async function PUT(request) {
  noStore();
  try {
    await requireAdmin();
    const body = await request.json();
    const id = safeInt(body.id, 0);
    if (!id) return NextResponse.json({ error: 'Provider id required' }, { status: 400 });

    const fields = [];
    if (body.status && ['active', 'offline', 'disabled'].includes(body.status)) fields.push(sql`status = ${body.status}`);
    if (typeof body.base_url === 'string' && body.base_url.trim()) fields.push(sql`base_url = ${body.base_url.trim()}`);

    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    let setSql = sql`updated_at = CURRENT_TIMESTAMP`;
    for (const f of fields) setSql = sql`${setSql}, ${f}`;

    await sql`UPDATE providers SET ${setSql} WHERE id = ${id}`;
    return NextResponse.json({ message: 'Provider updated' });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin provider update error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/api/providers — { action: 'check', id } run a live health check
export async function POST(request) {
  noStore();
  try {
    await requireAdmin();
    const body = await request.json();
    if (body.action !== 'check') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    const id = safeInt(body.id, 0);
    const rows = await sql`SELECT name FROM providers WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    const provider = getProvider(rows[0].name);
    if (!provider) return NextResponse.json({ error: 'Provider adapter not available' }, { status: 400 });

    // live probe: hit the base URL and check JSON
    const started = Date.now();
    let ok = false;
    let error = null;
    let ms = 0;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${provider.base_url || 'https://apis.davidcyril.name.ng'}/fact`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      ms = Date.now() - started;
      const ct = res.headers.get('content-type') || '';
      ok = res.ok && ct.includes('json');
      if (!ok) error = `HTTP ${res.status}`;
    } catch (e) {
      ms = Date.now() - started;
      error = e.message.slice(0, 200);
    }

    await sql`
      INSERT INTO provider_health (provider_id, ok, response_time_ms, error)
      VALUES (${id}, ${ok}, ${ms}, ${error})
    `;
    if (ok) {
      await sql`UPDATE providers SET last_success_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    } else {
      await sql`UPDATE providers SET last_failure_at = CURRENT_TIMESTAMP, last_error = ${error}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    }

    return NextResponse.json({ ok, ms, error, checked_at: new Date().toISOString() });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin provider check error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
