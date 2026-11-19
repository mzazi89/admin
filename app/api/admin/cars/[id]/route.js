import { adminJwtSecret } from '@/lib/authSecret';
import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { adminCar, saveCar, deleteCar, STATUSES, ensureCars } from '@/lib/cars';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });

async function verifyAdmin() {
  try {
    const store = await cookies();
    const token = store.get('admin_token');
    if (!token) return null;
    return jwt.verify(token.value, adminJwtSecret());
  } catch { return null; }
}

// MZAZI ADMIN — one vehicle.
//   GET     full record + image ids, for the editor
//   PATCH   save (status, price, specs, description, features …)
//   DELETE  remove the listing and its photos
export async function GET(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const car = await adminCar(Number(id));
  if (!car) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ car });
}

export async function PATCH(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));

    // A one-tap publish/sold toggle should not require the whole record: the
    // editor form is the only place that carries every field.
    if (body.action === 'status') {
      if (!STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
      }
      await ensureCars();
      await sql`UPDATE cars SET status = ${body.status}, updated_at = NOW() WHERE id = ${Number(id)}`;
      return NextResponse.json({ ok: true, status: body.status });
    }

    const car = await saveCar(body, { id: Number(id) });
    if (!car) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ car });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not save that vehicle' }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    await deleteCar(Number(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/cars] DELETE', e?.message || e);
    return NextResponse.json({ error: 'Could not delete that vehicle' }, { status: 500 });
  }
}
