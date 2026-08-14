// MZAZI API — /api/admin/bot-config
// Admin: view or set the bot API key (stored in Neon, not Vercel env).
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';
import { getBotApiKey, setBotApiKey } from '@/lib/botKey';

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
  try {
    await ensureDatabase();
    const key = await getBotApiKey();
    return NextResponse.json({
      configured: !!key,
      key: key || '',
      source: 'database',
    });
  } catch (error) {
    console.error('Admin bot-config error:', error);
    return NextResponse.json({ error: 'Failed to read bot config' }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    if (!body || typeof body.key !== 'string' || !body.key.trim()) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }
    if (body.key.length > 128) return NextResponse.json({ error: 'key too long (max 128 chars)' }, { status: 400 });

    await ensureDatabase();
    const saved = await setBotApiKey(body.key.trim());
    return NextResponse.json({ ok: true, configured: !!saved });
  } catch (error) {
    console.error('Admin bot-config save error:', error);
    return NextResponse.json({ error: 'Failed to save bot config' }, { status: 500 });
  }
}
