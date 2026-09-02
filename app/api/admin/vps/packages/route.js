// MZAZI API — /api/admin/vps/packages
// Admin: list all VPS packages (with stock/sold counts + buyer info) + create.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { initializeDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return false;
  try { const d = jwt.verify(token.value, ADMIN_JWT_SECRET); return d.role === 'admin'; }
  catch { return false; }
}

function cleanSpec(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// GET — packages + pool counts + sold instances (with buyer email where joined)
export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await initializeDatabase();
    const packages = await sql`
      SELECT p.*,
        (SELECT COUNT(*) FROM vps_instances i WHERE i.package_id = p.id AND i.status = 'available')::int AS stock,
        (SELECT COUNT(*) FROM vps_instances i WHERE i.package_id = p.id AND i.status = 'sold')::int AS sold,
        (SELECT COUNT(*) FROM vps_orders o WHERE o.package_id = p.id AND o.status = 'success')::int AS orders
      FROM vps_packages p
      ORDER BY p.id ASC
    `;
    return NextResponse.json({ packages });
  } catch (error) {
    console.error('Admin VPS packages GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch VPS packages' }, { status: 500 });
  }
}

// POST — create a VPS package
export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await initializeDatabase();
    const body = await request.json();
    const name = String(body.name || '').trim();
    const price = Number(body.price);
    if (!name || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Name and a valid price are required' }, { status: 400 });
    }

    const created = await sql`
      INSERT INTO vps_packages
        (name, price, ram, cpu, disk, bandwidth, location, os, description, active)
      VALUES
        (${name}, ${price}, ${cleanSpec(body.ram)}, ${cleanSpec(body.cpu)}, ${cleanSpec(body.disk)},
         ${cleanSpec(body.bandwidth)}, ${cleanSpec(body.location)}, ${cleanSpec(body.os)},
         ${String(body.description || '').trim()}, ${body.active !== false})
      RETURNING id, name, price
    `;
    return NextResponse.json({ package: created[0] }, { status: 201 });
  } catch (error) {
    console.error('Admin VPS packages POST error:', error);
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
  }
}
