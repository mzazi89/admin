import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });

async function verifyAdmin() {
  try {
    const store = await cookies();
    const token = store.get('admin_token');
    if (!token) return null;
    return jwt.verify(token.value, adminJwtSecret());
  } catch { return null; }
}

// MZAZI ADMIN — reports raised from community chats.
//
// A report is private to the operator: the reported person is never told, and the
// chat shows nothing. That makes this list the only place the report exists, which
// is why it carries the message text, the reporter and the sender together.
export async function GET(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get('status') || 'open');

  try {
    const reports = await sql`
      SELECT r.id, r.message_id, r.chat_id, r.reason, r.note, r.status, r.created_at, r.resolved_at,
             x.body AS message_body, x.kind, x.deleted_at, x.sender_id,
             rep.email AS reporter_email, rep.fullname AS reporter_name,
             snd.email AS sender_email, snd.fullname AS sender_name,
             c.title AS chat_title, c.kind AS chat_kind
      FROM com_reports r
      LEFT JOIN com_messages x ON x.id = r.message_id
      LEFT JOIN users rep ON rep.id = r.reporter_id
      LEFT JOIN users snd ON snd.id = x.sender_id
      LEFT JOIN com_chats c ON c.id = r.chat_id
      WHERE (${status} = 'all' OR r.status = ${status})
      ORDER BY r.id DESC
      LIMIT 200
    `;
    const counts = await sql`
      SELECT status, COUNT(*)::int AS c FROM com_reports GROUP BY status
    `;
    return NextResponse.json({
      reports,
      counts: Object.fromEntries(counts.map((r) => [r.status, r.c])),
    });
  } catch (e) {
    console.error('[admin/reports] GET', e?.message || e);
    return NextResponse.json({ error: 'Could not load reports' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const status = body.status === 'open' ? 'open' : 'resolved';
    if (!id) return NextResponse.json({ error: 'Missing report id' }, { status: 400 });

    await sql`
      UPDATE com_reports
      SET status = ${status}, resolved_at = ${status === 'resolved' ? new Date() : null}
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error('[admin/reports] POST', e?.message || e);
    return NextResponse.json({ error: 'Could not update that report' }, { status: 500 });
  }
}
