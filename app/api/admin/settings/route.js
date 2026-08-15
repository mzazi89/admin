// MZAZI API — /api/admin/settings
// GET  → the bot's shared settings (Paystack + Pterodactyl)
// POST → upsert them into the Neon `settings` table — the bot picks them up
//        within ~60s (no env vars, no restart needed).
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';
const ALLOWED_KEYS = ['paystack_secret_key', 'pterodactyl_url', 'pterodactyl_api_key', 'mzazi_api_key', 'deepseek_api_key'];

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
    const rows = await sql`SELECT key, value FROM settings WHERE key = ANY(${ALLOWED_KEYS})`;
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return NextResponse.json({ settings: out });
  } catch (e) {
    console.error('Settings GET error:', e.message);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const body = await request.json();
    const updates = [];
    for (const key of ALLOWED_KEYS) {
      if (key in body) {
        updates.push(
          sql`
            INSERT INTO settings (key, value, updated_at)
            VALUES (${key}, ${body[key] === null ? '' : String(body[key])}, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
          `
        );
      }
    }
    if (updates.length) await Promise.all(updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Settings POST error:', e.message);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
