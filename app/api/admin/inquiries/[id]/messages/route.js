import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token');
    if (!token) return false;
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    return d.role === 'admin';
  } catch { return false; }
}

// GET /api/admin/inquiries/[id]/messages
export async function GET(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const inquiry = await sql`SELECT * FROM inquiries WHERE id = ${parseInt(id)}`;
  if (inquiry.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const messages = await sql`
    SELECT id, sender, message, created_at
    FROM inquiry_messages
    WHERE inquiry_id = ${parseInt(id)}
    ORDER BY created_at ASC
  `;

  return NextResponse.json({ inquiry: inquiry[0], messages });
}
