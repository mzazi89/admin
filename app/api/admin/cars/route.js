import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { adminCars, saveCar } from '@/lib/cars';

export const dynamic = 'force-dynamic';

async function verifyAdmin() {
  try {
    const store = await cookies();
    const token = store.get('admin_token');
    if (!token) return null;
    return jwt.verify(token.value, adminJwtSecret());
  } catch { return null; }
}

// MZAZI ADMIN — the Golden Lion Motors stock list.
//   GET  ?status=&q=   every listing, any state
//   POST               create one
export async function GET(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  try {
    const cars = await adminCars({
      status: searchParams.get('status') || 'all',
      q: searchParams.get('q') || '',
    });
    const counts = cars.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});
    return NextResponse.json({ cars, counts });
  } catch (e) {
    console.error('[admin/cars] GET', e?.message || e);
    return NextResponse.json({ error: 'Could not load the stock list' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const car = await saveCar(body);
    return NextResponse.json({ car });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not save that vehicle' }, { status: 400 });
  }
}
