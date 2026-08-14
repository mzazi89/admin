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

// GET — list all packages (including inactive)
export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const packages = await sql`
      SELECT *, expires_after_hours FROM packages ORDER BY sort_order ASC, id ASC
    `;
    return NextResponse.json({ packages });
  } catch (error) {
    console.error('Admin packages GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
  }
}

// POST — create a new package
export async function POST(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { name, price, cpu, ram, disk, description, popular, accent, active, sort_order, expires_after_hours } = await request.json();
    if (!name || price == null) return NextResponse.json({ error: 'name and price are required' }, { status: 400 });

    const rows = await sql`
      INSERT INTO packages (name, price, cpu, ram, disk, description, popular, accent, active, sort_order, expires_after_hours)
      VALUES (
        ${name},
        ${parseFloat(price)},
        ${parseInt(cpu) || 0},
        ${parseInt(ram) || 0},
        ${parseInt(disk) || 0},
        ${description || ''},
        ${popular === true || popular === 'true'},
        ${accent || '#2563eb'},
        ${active !== false && active !== 'false'},
        ${parseInt(sort_order) || 0},
        ${expires_after_hours ? parseInt(expires_after_hours) : null}
      )
      RETURNING *
    `;
    return NextResponse.json({ package: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Admin packages POST error:', error);
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
  }
}
