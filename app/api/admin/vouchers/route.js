import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return null;
  try {
    return jwt.verify(token.value, ADMIN_JWT_SECRET);
  } catch {
    return null;
  }
}

// GET — list all vouchers
export async function GET(request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const vouchers = await sql`
      SELECT v.*, u.email AS used_by_email
      FROM voucher_codes v
      LEFT JOIN users u ON v.used_by = u.id
      ORDER BY v.created_at DESC
    `;
    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error('List vouchers error:', error);
    return NextResponse.json({ error: 'Failed to list vouchers' }, { status: 500 });
  }
}

// POST — create & activate a voucher
export async function POST(request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { code, amount } = await request.json();

    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      return NextResponse.json({ error: 'Code must be exactly 6 characters' }, { status: 400 });
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();
    const amountVal = parseFloat(amount);

    const existing = await sql`SELECT id FROM voucher_codes WHERE code = ${upperCode}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Code already exists. Use a different code.' }, { status: 409 });
    }

    const [voucher] = await sql`
      INSERT INTO voucher_codes (code, amount, status, created_by)
      VALUES (${upperCode}, ${amountVal}, 'active', ${admin.email})
      RETURNING *
    `;

    return NextResponse.json({ voucher, message: 'Voucher created and activated successfully' });
  } catch (error) {
    console.error('Create voucher error:', error);
    return NextResponse.json({ error: 'Failed to create voucher' }, { status: 500 });
  }
}
