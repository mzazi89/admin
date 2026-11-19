'use client';

// MZAZI ADMIN — M-PESA payouts.
//
// A withdrawal is the one ledger row that can leave the customer holding nothing:
// the wallet was debited and the payout is waiting on Safaricom. When a result
// callback never arrives, this page is how a human settles it — paste the M-PESA
// code if the message exists, or refund if it does not. Both write through the
// API, which only acts on rows that are still pending.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtKes } from '@/lib/currency';
import {
  Alert, Badge, Button, Card, CardHeader, DataTable, EmptyState, ErrorState,
  PageHeader, Skeleton, humaniseError, useToast, Icons,
} from '@/components/ui';

const FILTERS = [
  { id: 'pending', label: 'Waiting' },
  { id: 'success', label: 'Paid' },
  { id: 'failed', label: 'Failed' },
  { id: 'all', label: 'All' },
];

const tone = (status) => (status === 'success' ? 'good' : status === 'failed' ? 'bad' : 'warn');

export default function AdminWithdrawals() {
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipts, setReceipts] = useState({});
  const [busy, setBusy] = useState(0);

  const load = useCallback(async (status = filter) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${status}`, { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not load withdrawals');
      setRows(d.withdrawals || []);
      setCounts(d.counts || {});
    } catch (e) {
      setError(humaniseError(e, 'We could not load withdrawals right now.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const resolve = async (row, action) => {
    const code = (receipts[row.id] || '').trim();
    if (action === 'paid' && !code) {
      toast.error('Paste the M-PESA code from the customer message first.');
      return;
    }
    if (action === 'refund' && !window.confirm(`Refund ${fmtKes(Number(row.amount))} to ${row.email || row.phone_number}?`)) {
      return;
    }

    setBusy(row.id);
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          action,
          receipt: code,
          note: action === 'paid' ? 'Confirmed paid by support' : 'Refunded by support — payout not completed',
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not update the withdrawal');
      toast.success(action === 'paid' ? 'Marked as paid' : 'Refunded to the wallet');
      await load();
    } catch (e) {
      toast.error(humaniseError(e, 'Could not update the withdrawal'));
    } finally {
      setBusy(0);
    }
  };

  const waiting = counts.pending || 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader
        title="M-PESA payouts"
        subtitle="Wallet withdrawals sent through Daraja B2C. Every payout is held until Safaricom confirms it."
        actions={<Button variant="ghost" icon={<Icons.Refresh size={15} />} onClick={() => load()}>Refresh</Button>}
      />

      <Alert kind={waiting ? 'warn' : 'info'} title={waiting ? `${waiting} payout${waiting === 1 ? '' : 's'} waiting` : 'Nothing waiting'}>
        {waiting
          ? 'These wallets are debited already. Check the M-PESA message: paste the code to mark it paid, or refund it back. Both only work while the row is still waiting.'
          : 'When a payout is accepted by M-PESA it settles on its own. Rows only land here if a callback was missed.'}
      </Alert>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? 'primary' : 'ghost'}
              onClick={() => setFilter(f.id)}
            >
              {f.label}{counts[f.id] ? ` · ${counts[f.id]}` : ''}
            </Button>
          ))}
          <div style={{ flex: 1 }} />
          <CardHeader title="Withdrawals" description={`${rows.length} shown`} style={{ marginBottom: 0, textAlign: 'right' }} />
        </div>

        {error ? (
          <ErrorState title="Could not load withdrawals" message={error} onRetry={() => load()} />
        ) : loading ? (
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} h={44} />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icons.Send size={26} />}
            title={filter === 'pending' ? 'Nothing waiting' : 'No withdrawals here'}
            description={filter === 'pending' ? 'Payouts settle automatically through the M-PESA callback.' : 'Try another filter.'}
          />
        ) : (
          <DataTable columns={['Customer', 'Amount', 'Phone', 'Requested', 'Status', '']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Customer">
                  <div style={{ fontWeight: 600 }}>{r.fullname || '—'}</div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim)' }}>{r.email || `user ${r.user_id}`}</div>
                </td>
                <td data-label="Amount" style={{ fontWeight: 700 }}>{fmtKes(Number(r.amount))}</td>
                <td data-label="Phone" className="mono" style={{ fontSize: 12.5 }}>{r.phone_number}</td>
                <td data-label="Requested" className="mono" style={{ fontSize: 12, color: 'var(--dim)' }}>
                  {new Date(r.created_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                  <div style={{ fontSize: 11 }}>{r.reference}</div>
                </td>
                <td data-label="Status">
                  <Badge tone={tone(r.status)}>{r.status}</Badge>
                  {r.provider_receipt && <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>{r.provider_receipt}</div>}
                  {r.failure_reason && <div style={{ fontSize: 11, color: 'var(--dim)', maxWidth: 220 }}>{r.failure_reason}</div>}
                </td>
                <td data-label="">
                  {r.status === 'pending' ? (
                    <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <input
                        className="input"
                        placeholder="M-PESA code"
                        value={receipts[r.id] || ''}
                        onChange={(e) => setReceipts((m) => ({ ...m, [r.id]: e.target.value.toUpperCase().slice(0, 12) }))}
                        style={{ width: 120, fontSize: 12 }}
                        aria-label={`M-PESA code for withdrawal ${r.id}`}
                      />
                      <Button size="sm" variant="primary" loading={busy === r.id} onClick={() => resolve(r, 'paid')}>
                        Paid
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => resolve(r, 'refund')}>
                        Refund
                      </Button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>
                      {r.paid_at ? new Date(r.paid_at).toLocaleDateString('en-KE') : '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
