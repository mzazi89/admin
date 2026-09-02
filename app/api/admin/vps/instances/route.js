// MZAZI API — /api/admin/vps/instances
// Admin: manage the credential pool for a package.
//   GET    ?package_id=…   → instances (with buyer email for sold ones)
//   POST   { package_id, instances: [{ host, username, password, port }] } → add stock (bulk supported)
//   DELETE ?id=…           → remove an AVAILABLE instance (sold ones keep buyer access)
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

export async function GET(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const packageId = Number(request.nextUrl.searchParams.get('package_id'));
    if (!packageId) return NextResponse.json({ error: 'package_id is required' }, { status: 400 });

    const instances = await sql`
      SELECT i.*, u.email AS buyer_email, u.firstname AS buyer_firstname
      FROM vps_instances i
      LEFT JOIN users u ON u.id = i.sold_to
      WHERE i.package_id = ${packageId}
      ORDER BY (i.status = 'sold'), i.id ASC
    `;
    return NextResponse.json({ instances });
  } catch (error) {
    console.error('Admin VPS instances GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch instances' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    const packageId = Number(body.package_id);
    const list = Array.isArray(body.instances) ? body.instances : [body.instance || {}];
    if (!packageId) return NextResponse.json({ error: 'package_id is required' }, { status: 400 });

    const rows = [];
    for (const raw of list) {
      const host = String(raw.host || '').trim();
      const username = String(raw.username || '').trim();
      const password = String(raw.password || '').trim();
      if (!host || !username || !password) {
        return NextResponse.json({ error: 'Every instance needs an IP address, username and password' }, { status: 400 });
      }
      const created = await sql`
        INSERT INTO vps_instances
          (package_id, host, username, password, port,
           droplet_id, hostname, region, os, cpu, status)
        VALUES
          (${packageId}, ${host}, ${username}, ${password}, ${String(raw.port || '22').trim() || '22'},
           ${String(raw.droplet_id || '').trim()}, ${String(raw.hostname || '').trim()},
           ${String(raw.region || '').trim()}, ${String(raw.os || '').trim()}, ${String(raw.cpu || '').trim()}, 'available')
        RETURNING id, host, username, port
      `;
      rows.push(created[0]);
    }
    return NextResponse.json({ added: rows.length, instances: rows }, { status: 201 });
  } catch (error) {
    console.error('Admin VPS instances POST error:', error);
    return NextResponse.json({ error: 'Failed to add instances' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const del = await sql`
      DELETE FROM vps_instances WHERE id = ${id} AND status = 'available' RETURNING id
    `;
    if (del.length === 0) {
      return NextResponse.json({ error: 'Instance not found or already sold (sold instances keep buyer access).' }, { status: 409 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Admin VPS instances DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete instance' }, { status: 500 });
  }
}
