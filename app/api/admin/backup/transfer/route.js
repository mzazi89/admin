// MZAZI ADMIN — move an archived snapshot into a new database.
//
// POST { objectUrl, targetUrl, dryRun }
//
// dryRun is the default the UI offers first: it reads and decrypts the archive
// and reports exactly what would be written, per table, without opening a
// connection to the target. The write path is idempotent, so a retry after a
// partial failure is safe.

import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

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
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const dryRun = body.dryRun !== false;
  let objectUrl = String(body.objectUrl || '');

  // "latest" is what the UI shows by default, and it means the newest archive
  // the manifest knows about — resolved here so the client never has to.
  if (!objectUrl || objectUrl === 'latest') {
    const manifest = await readManifest();
    objectUrl = manifest.snapshots?.[0]?.object || '';
  }
  if (!objectUrl) {
    return NextResponse.json({ error: 'No snapshot to transfer.' }, { status: 400 });
  }

  try {
    const result = await transferArchive({
      targetUrl: String(body.targetUrl || '').trim(),
      objectUrl,
      dryRun,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('Backup transfer error:', e);
    return NextResponse.json({ error: e.message || 'Transfer failed' }, { status: 400 });
  }
}
