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

// PUT — update a package
export async function PUT(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const { name, price, cpu, ram, disk, description, popular, accent, active, sort_order, expires_after_hours } = await request.json();
    if (!name || price == null) return NextResponse.json({ error: 'name and price are required' }, { status: 400 });

    const rows = await sql`
      UPDATE packages SET
        name        = ${name},
        price       = ${parseFloat(price)},
        cpu         = ${parseInt(cpu) || 0},
        ram         = ${parseInt(ram) || 0},
        disk        = ${parseInt(disk) || 0},
        description = ${description || ''},
        popular     = ${popular === true || popular === 'true'},
        accent      = ${accent || '#2563eb'},
        active           = ${active !== false && active !== 'false'},
        sort_order       = ${parseInt(sort_order) || 0},
        expires_after_hours = ${expires_after_hours ? parseInt(expires_after_hours) : null}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    return NextResponse.json({ package: rows[0] });
  } catch (error) {
    console.error('Admin packages PUT error:', error);
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
  }
}

// DELETE — remove a package
export async function DELETE(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    await sql`DELETE FROM packages WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin packages DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 });
  }
}
