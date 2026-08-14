import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// GET /api/admin/api/settings — configurable platform settings (rate limits)
export async function GET() {
  noStore();
  try {
    await requireAdmin();
    const rows = await sql`SELECT key, value, updated_at FROM api_settings ORDER BY key ASC`;
    const settings = {};
    rows.forEach(r => { settings[r.key] = { value: r.value, updated_at: r.updated_at }; });
    return NextResponse.json({ settings });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin settings error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/api/settings — { key: 'rate_limit.PREMIUM', value: '20000' }
export async function PUT(request) {
  noStore();
  try {
    await requireAdmin();
    const body = await request.json();
    const key = String(body.key || '').trim();
    const value = String(body.value ?? '').trim();

    if (!/^[a-zA-Z0-9._-]+$/.test(key) || value === '') {
      return NextResponse.json({ error: 'Invalid setting key or value' }, { status: 400 });
    }

    if (/^rate_limit\./.test(key)) {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n) || n < -1) {
        return NextResponse.json({ error: 'Rate limit must be >= -1 (or -1 for unlimited)' }, { status: 400 });
      }
    }

    await sql`
      INSERT INTO api_settings (key, value, updated_at)
      VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({ message: 'Setting updated', key, value });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi-api] admin settings update error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
