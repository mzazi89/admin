// MZAZI API — /api/admin/vps/packages/[id]
// Admin: update or delete a VPS package. Deleting is blocked while any sold
// instance exists under it (that would wipe buyers' credentials).
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

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

export async function PUT(request, { params }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const id = Number(params.id);
    const body = await request.json();
    const name = String(body.name || '').trim();
    const price = Number(body.price);
    if (!id || !name || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Name and a valid price are required' }, { status: 400 });
    }

    const upd = await sql`
      UPDATE vps_packages SET
        name = ${name},
        price = ${price},
        ram = ${String(body.ram || '').trim()},
        cpu = ${String(body.cpu || '').trim()},
        disk = ${String(body.disk || '').trim()},
        bandwidth = ${String(body.bandwidth || '').trim()},
        location = ${String(body.location || '').trim()},
        os = ${String(body.os || '').trim()},
        description = ${String(body.description || '').trim()},
        active = ${body.active !== false}
      WHERE id = ${id}
      RETURNING id, name, price, active
    `;
    if (upd.length === 0) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    return NextResponse.json({ package: upd[0] });
  } catch (error) {
    console.error('Admin VPS packages PUT error:', error);
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const id = Number(params.id);
    const sold = await sql`
      SELECT COUNT(*)::int AS cnt FROM vps_instances WHERE package_id = ${id} AND status = 'sold'
    `;
    if ((sold[0]?.cnt || 0) > 0) {
      return NextResponse.json(
        { error: 'This package has sold instances — delete those first (or keep it to preserve buyers\' credentials).' },
        { status: 409 }
      );
    }
    const del = await sql`DELETE FROM vps_packages WHERE id = ${id} RETURNING id`;
    if (del.length === 0) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Admin VPS packages DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 });
  }
}
