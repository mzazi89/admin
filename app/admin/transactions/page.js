'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtKes } from '@/lib/currency';
import {
  Badge, Card, DataTable, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, StatCard,
  humaniseError, Icons,
} from '@/components/ui';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'orders', label: 'Orders' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'credit', label: 'Credit' },
  { key: 'debit', label: 'Debit' },
];

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed' || s === 'paid' || s === 'success') return 'good';
  if (s === 'pending') return 'warn';
  return 'bad';
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminPayments() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/transactions');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load payments');
      setData(d);
    } catch (e) {
      setError(humaniseError(e, 'We could not load payments right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const orders = (data.orders || []).map((o) => ({
      id: `o-${o.id}`, typeKey: 'order', type: 'Order', user: o.user_email,
      detail: o.package_name, amount: o.amount, status: o.status, date: o.created_at, ref: o.reference,
    }));
    const txns = (data.transactions || []).map((t) => ({
      id: `w-${t.id}`, typeKey: t.type, type: t.type === 'debit' ? 'Debit' : 'Credit', user: t.user_email,
      detail: t.description, amount: t.amount, status: t.status, date: t.created_at, ref: t.reference,
    }));
    return [...orders, ...txns].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'orders' && r.typeKey !== 'order') return false;
      if (filter === 'wallet' && r.typeKey !== 'credit' && r.typeKey !== 'debit') return false;
      if ((filter === 'credit' || filter === 'debit') && r.typeKey !== filter) return false;
      if (q) {
        const hay = `${r.user || ''} ${r.ref || ''} ${r.detail || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader
        title="Payments"
        description="Orders and wallet transactions from the shared ledger."
        icon={<Icons.Wallet size={20} />}
      />

      <div className="grid-cards" style={{ marginBottom: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard label="Total revenue" value={fmtKes(data?.stats?.total_revenue || 0)} hint="Completed orders" icon={<Icons.Wallet size={18} />} tone="brand" loading={loading} />
        <StatCard label="Completed orders" value={data?.stats?.completed_orders || 0} hint="All time" icon={<Icons.CheckCircle size={18} />} tone="good" loading={loading} />
        <StatCard label="Pending orders" value={data?.stats?.pending_orders || 0} hint="Awaiting payment" icon={<Icons.Clock size={18} />} tone="warn" loading={loading} />
      </div>

      <Card style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <SearchInput id="payments-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email, reference or item" />
          <div className="segmented scroll-x" role="tablist" aria-label="Filter payments">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'is-active' : ''} style={{ minHeight: 44 }} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error ? (
        <Card><ErrorState title="Could not load payments" message={error} onRetry={load} /></Card>
      ) : loading ? (
        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={40} />)}
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icons.Wallet size={26} />}
            title={search || filter !== 'all' ? 'No matching payments' : 'No payments yet'}
            description={search || filter !== 'all' ? 'Try a different search or filter.' : 'Orders and wallet activity will appear here.'}
          />
        </Card>
      ) : (
        <Card style={{ padding: 0 }} className="anim-fade-up">
          <DataTable columns={['User', 'Type', 'Amount', 'Status', 'Date']}>
            {filtered.map((r) => {
              const debit = r.typeKey === 'debit';
              return (
                <tr key={r.id}>
                  <td data-label="User">
                    <div style={{ color: 'var(--ink-2)' }}>{r.user || '—'}</div>
                    <div className="mono truncate-1" style={{ fontSize: 12.5, color: 'var(--dim)' }}>{r.ref ? String(r.ref).slice(-14) : r.detail}</div>
                  </td>
                  <td data-label="Type"><Badge tone={r.typeKey === 'order' ? 'blue' : debit ? 'bad' : 'good'}>{r.type}</Badge></td>
                  <td data-label="Amount" style={{ fontWeight: 600, color: debit ? 'var(--bad)' : 'var(--good)' }}>
                    {debit ? '−' : '+'}{fmtKes(r.amount || 0)}
                  </td>
                  <td data-label="Status"><Badge tone={statusTone(r.status)}>{r.status || '—'}</Badge></td>
                  <td data-label="Date" className="mono" style={{ fontSize: 12.5, color: 'var(--dim)' }}>{fmtDate(r.date)}</td>
                </tr>
              );
            })}
          </DataTable>
        </Card>
      )}
    </div>
  );
}
