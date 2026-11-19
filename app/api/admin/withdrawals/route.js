import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
const ADMIN_JWT_SECRET = adminJwtSecret();

async function verifyAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token');
    if (!token) return null;
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    return d.role === 'admin' || d.role === undefined ? d : null;
  } catch { return null; }
}

// MZAZI ADMIN — wallet withdrawals (M-PESA B2C).
//
// The customer side debits the wallet and waits for Safaricom's result callback.
// When that callback never arrives, the money sits held and only a human can
// decide: the M-PESA message exists (mark paid) or it does not (refund). Both
// actions are guarded by `status = 'pending'`, so two operators clicking at once
// cannot refund twice.

export async function GET(request) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get('status') || 'pending');

  try {
    const rows = await sql`
      SELECT t.id, t.user_id, t.amount, t.status, t.phone_number, t.reference,
             t.provider_ref, t.provider_conversation_id, t.provider_receipt,
             t.failure_reason, t.result_code, t.result_desc, t.created_at, t.paid_at,
             u.email, u.fullname
      FROM wallet_transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = 'withdrawal'
        AND (${status} = 'all' OR t.status = ${status})
      ORDER BY t.id DESC
      LIMIT 100
    `;
    const counts = await sql`
      SELECT status, COUNT(*)::int AS c
      FROM wallet_transactions WHERE type = 'withdrawal'
      GROUP BY status
    `;
    return NextResponse.json({
      withdrawals: rows,
      counts: Object.fromEntries(counts.map((r) => [r.status, r.c])),
    });
  } catch (e) {
    console.error('[admin/withdrawals] GET', e?.message || e);
    return NextResponse.json({ error: 'Could not load withdrawals' }, { status: 500 });
  }
}

export async function POST(request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const id = Number(body.id);
  const action = String(body.action || '');
  if (!id) return NextResponse.json({ error: 'Missing withdrawal id' }, { status: 400 });

  try {
    const rows = await sql`SELECT * FROM wallet_transactions WHERE id = ${id} AND type = 'withdrawal' LIMIT 1`;
    const tx = rows[0];
    if (!tx) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    if (tx.status !== 'pending') return NextResponse.json({ error: `Already ${tx.status}` }, { status: 409 });

    if (action === 'paid') {
      const changed = await sql`
        UPDATE wallet_transactions
        SET status = 'success', provider_receipt = ${String(body.receipt || '').slice(0, 40) || null},
            result_desc = ${String(body.note || 'Confirmed paid by support').slice(0, 250)},
            paid_at = NOW(), updated_at = NOW()
        WHERE id = ${id} AND status = 'pending'
        RETURNING id
      `;
      if (!changed[0]) return NextResponse.json({ error: 'Already settled' }, { status: 409 });
      return NextResponse.json({ ok: true, status: 'success' });
    }

    if (action === 'refund') {
      const changed = await sql`
        UPDATE wallet_transactions
        SET status = 'failed',
            failure_reason = ${String(body.note || 'Refunded by support — payout not completed').slice(0, 250)},
            updated_at = NOW()
        WHERE id = ${id} AND status = 'pending'
        RETURNING id
      `;
      if (!changed[0]) return NextResponse.json({ error: 'Already settled' }, { status: 409 });

      await sql`
        UPDATE wallet SET balance = balance + ${Number(tx.amount)}, updated_at = NOW()
        WHERE user_id = ${tx.user_id}
      `;
      return NextResponse.json({ ok: true, status: 'failed' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('[admin/withdrawals] POST', e?.message || e);
    return NextResponse.json({ error: 'Could not update the withdrawal' }, { status: 500 });
  }
}
