import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '@/lib/api/web-auth';
import { safeInt } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);

// GET /api/admin/testimonials — ?status=pending|approved|all
export async function GET(request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const where = status === 'pending' ? sql`WHERE approved = false`
      : status === 'approved' ? sql`WHERE approved = true`
      : sql``;
    const rows = await sql`
      SELECT id, name, rating, message, approved, created_at
      FROM testimonials ${where}
      ORDER BY created_at DESC LIMIT 200
    `;
    return NextResponse.json({ testimonials: rows });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi] admin testimonials error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/testimonials — { id, approved: true|false }
export async function PUT(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = safeInt(body.id, 0);
    if (!id || typeof body.approved !== 'boolean') {
      return NextResponse.json({ error: 'id and approved are required' }, { status: 400 });
    }
    await sql`UPDATE testimonials SET approved = ${body.approved} WHERE id = ${id}`;
    return NextResponse.json({ message: body.approved ? 'Testimonial approved' : 'Testimonial hidden' });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi] admin testimonial update error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/testimonials — { id }
export async function DELETE(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = safeInt(body.id, 0);
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await sql`DELETE FROM testimonials WHERE id = ${id}`;
    return NextResponse.json({ message: 'Testimonial deleted' });
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[mzazi] admin testimonial delete error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
