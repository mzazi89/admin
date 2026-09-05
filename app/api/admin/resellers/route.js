// MZAZI API — /api/admin/resellers
// Admin: generate WhatsApp-panel reseller passwords + list them with status.
//   GET            → all reseller passwords (code, status, activated by/at) + panels created per reseller
//   POST { count } → generate `count` new unique passwords (returned ONCE)
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { initializeDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return false;
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    return payload?.role === 'admin';
  } catch { return false; }
}

// Unambiguous alphabet (no 0/O, 1/I/L) — resellers type these into WhatsApp.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(len = 10) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return out;
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const rows = await sql`
      SELECT r.id, r.code, r.status, r.activated_by, r.activated_at, r.created_at,
             (SELECT COUNT(*) FROM whatsapp_panels w WHERE w.reseller_phone = r.activated_by) AS panels_created
      FROM reseller_passwords r
      ORDER BY r.id DESC
      LIMIT 500
    `;
    return NextResponse.json({ passwords: rows });
  } catch (e) {
    console.error('Resellers list error:', e.message);
    return NextResponse.json({ error: 'Failed to load reseller passwords' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    let count = 1;
    try {
      const body = await request.json();
      count = Math.min(100, Math.max(1, parseInt(body?.count) || 1));
    } catch { /* default 1 */ }

    await initializeDatabase();
    const codes = [];
    for (let i = 0; i < count; i++) {
      let inserted = false;
      for (let attempt = 0; attempt < 8 && !inserted; attempt++) {
        const code = generateCode();
        try {
          const res = await sql`
            INSERT INTO reseller_passwords (code)
            VALUES (${code})
            RETURNING id, code, status, created_at
          `;
          codes.push(res[0]);
          inserted = true;
        } catch (e) {
          if (e.code !== '23505') throw e; // unique violation → retry
        }
      }
      if (!inserted) throw new Error('Could not generate a unique password — please retry');
    }

    return NextResponse.json({ passwords: codes });
  } catch (e) {
    console.error('Resellers generate error:', e.message);
    return NextResponse.json({ error: 'Failed to generate passwords: ' + e.message }, { status: 500 });
  }
}
