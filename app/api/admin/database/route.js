// MZAZI ADMIN — check a candidate database before anything is written to it.
//
// The sync itself lives in /api/admin/backup/transfer; this endpoint only answers
// "can we reach it, and what is already in there?" so the operator sees the
// answer before pressing the button that writes.
//
// Read-only: it opens the connection, asks the server who it is, and counts what
// exists. No CREATE, no INSERT.

import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

import { PROTECTED_TABLES } from '@/lib/backup/scope';

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

function assertPostgresUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('That is not a valid connection string.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('The target must be a postgres:// connection string.');
  }
  return url;
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const targetUrl = String(body.targetUrl || '').trim();
  if (!targetUrl) return NextResponse.json({ error: 'Paste the new connection string first.' }, { status: 400 });

  if (targetUrl === process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'That is the database this deployment is already using.' },
      { status: 400 }
    );
  }

  try {
    // Neon's driver speaks the same wire protocol to any Postgres server, and
    // fails fast on a bad host or password — which is exactly the check wanted.
    const sql = neon(assertPostgresUrl(targetUrl), { fetchOptions: { cache: 'no-store' } });

    const [who] = await sql(`SELECT version() AS version, current_database() AS db`, []);
    const stats = await sql(`SELECT relname, n_live_tup FROM pg_stat_user_tables`, []);
    const present = await sql(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      []
    );

    const existing = {};
    for (const row of stats) {
      if (PROTECTED_TABLES.includes(row.relname) && Number(row.n_live_tup) > 0) {
        existing[row.relname] = Number(row.n_live_tup);
      }
    }
    const tableNames = new Set(present.map((r) => r.table_name));
    const alreadyHasSchema = PROTECTED_TABLES.some((t) => tableNames.has(t));

    return NextResponse.json({
      ok: true,
      database: who?.db || null,
      version: String(who?.version || '').split(' ').slice(0, 2).join(' '),
      existing,
      existingRows: Object.values(existing).reduce((a, b) => a + b, 0),
      alreadyHasSchema,
    });
  } catch (e) {
    // Neon throws its own error type with the server's message in it; a wrong
    // password or an unreachable host is the common case and the message is
    // what the operator needs to see.
    const message = String(e.message || 'Could not connect');
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
