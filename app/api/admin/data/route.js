// MZAZI ADMIN — data bundles on sale.
//
// The catalogue lives here, not in the customer app, because prices change with
// Safaricom's wholesale rates and nobody should need a deploy to follow them.
//
//   GET            → plans + the last 50 orders
//   POST           → add a bundle
//   PATCH          → edit one (price, size, validity, name, active)
//   DELETE ?id=    → remove one; orders keep their own snapshot of the amount
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { adminJwtSecret } from '@/lib/authSecret';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
const ADMIN_JWT_SECRET = adminJwtSecret();

async function verifyAdmin() {
  const store = await cookies();
  const token = store.get('admin_token');
  if (!token) return false;
  try {
    return jwt.verify(token.value, ADMIN_JWT_SECRET).role === 'admin';
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const [plans, orders] = await Promise.all([
    sql`SELECT id, network, name, size_mb, validity_days, price::float AS price, cost::float AS cost, active, sort_order
        FROM data_plans ORDER BY sort_order, price`,
    sql`SELECT o.id, o.phone, o.amount::float AS amount, o.status, o.reference, o.response,
               o.created_at, o.plan_id, p.name AS plan
        FROM data_orders o LEFT JOIN data_plans p ON p.id = o.plan_id
        ORDER BY o.created_at DESC LIMIT 50`,
  ]).catch(() => [[], []]);
  return NextResponse.json({ plans, orders });
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const name = String(b.name || '').trim();
  const sizeMb = Number(b.size_mb);
  const price = Number(b.price);
  if (!name || !Number.isFinite(sizeMb) || sizeMb <= 0) {
    return NextResponse.json({ error: 'A name and a size in MB are required.' }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'Price must be greater than zero.' }, { status: 400 });
  }
  const rows = await sql`
    INSERT INTO data_plans (network, name, size_mb, validity_days, price, cost, sort_order)
    VALUES (${String(b.network || 'safaricom').toLowerCase()}, ${name}, ${Math.round(sizeMb)},
            ${Number(b.validity_days) || 1}, ${price}, ${Number(b.cost) || null}, ${Number(b.sort_order) || 100})
    RETURNING id
  `;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

export async function PATCH(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Which bundle?' }, { status: 400 });

  // Whitelisted fields only — a PATCH should never be able to rewrite an id.
  const map = {
    name: b.name !== undefined ? String(b.name).trim() : undefined,
    size_mb: b.size_mb !== undefined ? Math.round(Number(b.size_mb)) : undefined,
    validity_days: b.validity_days !== undefined ? Number(b.validity_days) : undefined,
    price: b.price !== undefined ? Number(b.price) : undefined,
    cost: b.cost !== undefined ? Number(b.cost) : undefined,
    active: b.active !== undefined ? Boolean(b.active) : undefined,
    sort_order: b.sort_order !== undefined ? Number(b.sort_order) : undefined,
  };
  // Explicit statements, not a dynamic column name: interpolating an identifier
  // into a template is exactly where SQL injection lives.
  if (map.name !== undefined) await sql`UPDATE data_plans SET name = ${map.name} WHERE id = ${id}`;
  if (map.size_mb !== undefined) await sql`UPDATE data_plans SET size_mb = ${map.size_mb} WHERE id = ${id}`;
  if (map.validity_days !== undefined) await sql`UPDATE data_plans SET validity_days = ${map.validity_days} WHERE id = ${id}`;
  if (map.price !== undefined) await sql`UPDATE data_plans SET price = ${map.price} WHERE id = ${id}`;
  if (map.cost !== undefined) await sql`UPDATE data_plans SET cost = ${map.cost} WHERE id = ${id}`;
  if (map.active !== undefined) await sql`UPDATE data_plans SET active = ${map.active} WHERE id = ${id}`;
  if (map.sort_order !== undefined) await sql`UPDATE data_plans SET sort_order = ${map.sort_order} WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Which bundle?' }, { status: 400 });
  await sql`DELETE FROM data_plans WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
