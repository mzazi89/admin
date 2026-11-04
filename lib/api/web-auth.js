// MZAZI API — helper for web-dashboard APIs (uses the existing site JWT cookie auth)
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { qmark } from './utils';
import { adminJwtSecret } from '../authSecret';

// No hardcoded fallback: the previous one ('mzazi-tech-secret-2024') was in the
// repository, so a misconfigured deployment accepted forged user cookies. An
// unset secret now fails the request instead of validating it.
function userJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('UNAUTHORIZED');
  return secret;
}
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });

export async function requireUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');
  if (!token) throw new Error('UNAUTHORIZED');

  const decoded = jwt.verify(token.value, userJwtSecret());
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
  const decoded = jwt.verify(token.value, adminJwtSecret());
  if (decoded.role !== 'admin') throw new Error('FORBIDDEN');
  return decoded;
}
