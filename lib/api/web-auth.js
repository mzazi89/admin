// MZAZI API — helper for web-dashboard APIs (uses the existing site JWT cookie auth)
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { qmark } from './utils';

const JWT_SECRET = process.env.JWT_SECRET || 'mzazi-tech-secret-2024';
const sql = neon(process.env.DATABASE_URL);

export async function requireUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');
  if (!token) throw new Error('UNAUTHORIZED');

  const decoded = jwt.verify(token.value, JWT_SECRET);
  const m = qmark();
  const rows = await sql`
    SELECT id, firstname, lastname, fullname, email, role, status
    FROM users WHERE id = ${decoded.userId} AND ${m} = ${m} LIMIT 1
  `;
  if (rows.length === 0) throw new Error('UNAUTHORIZED');
  return rows[0];
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) throw new Error('UNAUTHORIZED');
  const decoded = jwt.verify(token.value, process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024');
  if (decoded.role !== 'admin') throw new Error('FORBIDDEN');
  return decoded;
}
