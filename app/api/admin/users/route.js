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

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const users = await sql`
      SELECT u.id, u.firstname, u.lastname, u.fullname, u.email, u.created_at,
             COALESCE(w.balance, 0) AS wallet_balance,
             COUNT(DISTINCT o.id) AS total_orders
      FROM users u
      LEFT JOIN wallet w ON w.user_id = u.id
      LEFT JOIN orders o ON o.user_id = u.id
      GROUP BY u.id, w.balance
      ORDER BY u.created_at DESC
    `;
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
