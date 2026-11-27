// MZAZI ADMIN — put the newest archive back into THIS database.
//
// POST { objectUrl?, dryRun? }  (admin session required)
//
// The transfer endpoint moves a snapshot into a *different* database, which is
// useless when the current one is the one that needs recovering — exactly the
// situation after a provider quota lock. This route is the same machinery with
// the target fixed to our own connection string and `replace` on, so the result
// is an exact copy rather than a merge.
//
// Safe to re-run: the writer upserts on primary keys, so a second call rewrites
// the same rows instead of duplicating them.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

import { adminJwtSecret } from '@/lib/authSecret';
import { transferArchive } from '@/lib/backup/transfer';
import { readManifest } from '@/lib/backup/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not set on this deployment.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  let objectUrl = String(body.objectUrl || '');
  if (!objectUrl || objectUrl === 'latest') {
    const manifest = await readManifest();
    objectUrl = manifest.snapshots?.[0]?.object || '';
  }
  if (!objectUrl) return NextResponse.json({ error: 'No snapshot to restore.' }, { status: 400 });

  try {
    const result = await transferArchive({
      targetUrl: process.env.DATABASE_URL,
      objectUrl,
      dryRun: body.dryRun === true,
      replace: true,
      allowSelf: true,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('Backup restore error:', e);
    return NextResponse.json({ error: e.message || 'Restore failed' }, { status: 400 });
  }
}
