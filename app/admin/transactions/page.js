'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fmtMtc } from '@/lib/currency';

const STATUS_TAG = {
  completed: 'tag-green',
  pending: 'tag-amber',
  failed: 'tag-red',
  refunded: 'tag-red',
  cancelled: 'tag-red',
};

export default function AdminTransactions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders');
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      fetch('/api/admin/transactions').then(async r2 => {
        if (r2.ok) { const d = await r2.json(); setData(d); }
        setLoading(false);
      });
    });
  }, []);

  const orders = (data?.orders || []).filter(o =>
    (o.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.reference || '').toLowerCase().includes(search.toLowerCase())
  );
  const txns = (data?.transactions || []).filter(t => (t.user_email || '').toLowerCase().includes(search.toLowerCase()));

  const tagFor = (s) => STATUS_TAG[s] || 'tag-amber';

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow mb-4">Ledger</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Transactions</h1>
      </div>

      {/* Stats row — asymmetric: revenue is the wide cell */}
      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 mb-8" style={{ gap: 14 }}>
          <div className="card" style={{ padding: '22px 24px', gridColumn: '1 / -1' }}>
            <div className="stat-num" style={{ color: '#F2A93B' }}>{fmtMtc(data.stats.total_revenue || 0)}</div>
            <div className="stat-label">Total revenue</div>
          </div>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div className="stat-num">{data.stats.completed_orders || 0}</div>
            <div className="stat-label">Completed orders</div>
          </div>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div className="stat-num" style={{ color: '#AEB5BD' }}>{data.stats.pending_orders || 0}</div>
            <div className="stat-label">Pending orders</div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex gap-2">
          {['orders', 'wallet'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="mono btn"
              style={{
                fontSize: 11, padding: '9px 18px',
                backgroundColor: tab === t ? '#F2A93B' : 'transparent',
                color: tab === t ? '#14100A' : '#79818A',
                border: `1px solid ${tab === t ? '#F2A93B' : '#262C33'}`,
                cursor: 'pointer',
              }}>
              {t === 'orders' ? 'Orders' : 'Wallet txns'}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email or reference"
          className="input mono" style={{ maxWidth: 300, fontSize: 13 }} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="spinner" /></div>
        ) : tab === 'orders' ? (
          <div className="scroll-x table-responsive">
            <table className="table-plain" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>User</th>
                  <th>Package</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td data-label="Reference" className="mono" style={{ fontSize: 12, color: '#4C535B' }}>{(o.reference || '—').slice(-12)}</td>
                    <td data-label="User" style={{ color: '#AEB5BD' }}>{o.user_email}</td>
                    <td data-label="Package" style={{ color: '#E9E7E2', fontWeight: 600 }}>{o.package_name}</td>
                    <td data-label="Amount" style={{ color: '#3ECF8E', fontWeight: 600 }}>{fmtMtc(o.amount || 0)}</td>
                    <td data-label="Status"><span className={`tag ${tagFor(o.status)}`}>{o.status}</span></td>
                    <td data-label="Date" className="mono" style={{ fontSize: 12, color: '#4C535B' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td colSpan={6} className="text-center" style={{ padding: '48px 0', color: '#4C535B' }}>No orders found</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="scroll-x table-responsive">
            <table className="table-plain" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id}>
                    <td data-label="User" style={{ color: '#AEB5BD' }}>{t.user_email}</td>
                    <td data-label="Type" className="mono" style={{ fontSize: 12, color: '#E9E7E2', textTransform: 'uppercase' }}>{t.type}</td>
                    <td data-label="Amount" style={{ color: t.type === 'debit' ? '#E5484D' : '#3ECF8E', fontWeight: 600 }}>
                      {t.type === 'debit' ? '−' : '+'}{fmtMtc(t.amount)}
                    </td>
                    <td data-label="Description" style={{ fontSize: 13, color: '#79818A', maxWidth: 320 }}>{t.description}</td>
                    <td data-label="Status"><span className={`tag ${tagFor(t.status)}`}>{t.status}</span></td>
                    <td data-label="Date" className="mono" style={{ fontSize: 12, color: '#4C535B' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {txns.length === 0 && <tr><td colSpan={6} className="text-center" style={{ padding: '48px 0', color: '#4C535B' }}>No transactions found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
