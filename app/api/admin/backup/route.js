// MZAZI ADMIN — backup status and manual snapshot.
//
// GET  — what the archive looks like, and what the live database looks like next
//        to it, so an operator can see staleness at a glance.
// POST — take a snapshot now.

import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

import { PROTECTED_TABLES } from '@/lib/backup/scope';
import { storeReady, readManifest } from '@/lib/backup/store';
import { keyReady, keySource } from '@/lib/backup/crypto';
import { runSnapshot, KEEP_SNAPSHOTS } from '@/lib/backup/snapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ADMIN_JWT_SECRET = adminJwtSecret();

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return null;
  try {
    return jwt.verify(token.value, ADMIN_JWT_SECRET);
  } catch {
    return null;
  }
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
  const manifest = await readManifest();

  // Live shape of the database, for comparison against the newest snapshot.
  // Counts come from pg_stat_user_tables — estimates, but one query instead of
  // eleven, and the exact figure is what the transfer reports anyway.
  let dbBytes = null;
  let liveCounts = {};
  let dbError = null;
  try {
    const [size] = await sql(`SELECT pg_database_size(current_database()) AS bytes`, []);
    dbBytes = size ? Number(size.bytes) : null;
    const stats = await sql(`SELECT relname, n_live_tup FROM pg_stat_user_tables`, []);
    liveCounts = Object.fromEntries(
      stats
        .filter((r) => PROTECTED_TABLES.includes(r.relname))
        .map((r) => [r.relname, Number(r.n_live_tup)])
    );
  } catch (e) {
    // A database at its quota often cannot even answer this.
    dbError = e.message;
  }

  return NextResponse.json({
    storeReady: storeReady(),
    keyReady: keyReady(),
    keySource: keySource(),
    keep: KEEP_SNAPSHOTS,
    cronScheduled: Boolean(process.env.CRON_SECRET),
    tables: PROTECTED_TABLES,
    snapshots: manifest.snapshots || [],
    updatedAt: manifest.updatedAt || null,
    database: { bytes: dbBytes, counts: liveCounts, error: dbError },
  });
}

export async function POST() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await runSnapshot({ reason: 'manual' });
  if (!result.ok) return NextResponse.json({ error: result.error, counts: result.counts }, { status: 400 });
  return NextResponse.json({ ok: true, snapshot: result.entry });
}
