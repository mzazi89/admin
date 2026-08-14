// MZAZI API — GET /api/admin/sessions
// Admin: all paired WhatsApp sessions across all users, with the owner.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return false;
  try {
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    return d.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const rows = await sql`
      SELECT ws.id, ws."phoneNumber", ws.status, ws."connectedAt",
             ws."userId", ws."createdAt", ws."updatedAt",
             u.email, u.firstname, u.lastname
      FROM "WhatsAppSession" ws
      LEFT JOIN users u ON u.id = ws."userId"
      ORDER BY ws.id DESC
    `;
    return NextResponse.json({ sessions: rows });
  } catch (e) {
    console.error('Sessions error:', e.message);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}
