'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fmtMtc, fmtMtcValue, mtcToKsh } from '@/lib/currency';

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

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login'); };
  const sc = s => s === 'completed' ? '#4ade80' : s === 'pending' ? '#fb923c' : '#f87171';
  const sb = s => s === 'completed' ? 'rgba(74,222,128,0.1)' : s === 'pending' ? 'rgba(251,146,60,0.1)' : 'rgba(248,113,113,0.1)';

  const orders = (data?.orders || []).filter(o =>
    (o.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.reference || '').toLowerCase().includes(search.toLowerCase())
  );
  const txns = (data?.transactions || []).filter(t => (t.user_email || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgba(6,8,16,0.78)' }}>
      <div style={{ backgroundColor: '#04070f', borderBottom: '1px solid #1e3a8a' }} className="sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: '#f0f4ff' }}>Admin Panel</span>
          </div>
          <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>Sign Out</button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          {[{ href: '/admin/dashboard', label: 'Overview' }, { href: '/admin/users', label: 'Users' }, { href: '/admin/transactions', label: 'Transactions', active: true }, { href: '/admin/inquiries', label: 'Inquiries' }, { href: '/admin/packages', label: 'Packages' }, { href: '/admin/vouchers', label: 'Vouchers & Recoveries' }].map(n => (
            <Link key={n.href} href={n.href} className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: n.active ? 'rgba(220,38,38,0.15)' : 'rgba(30,32,48,0.5)', color: n.active ? '#f87171' : '#64748b', border: n.active ? '1px solid rgba(220,38,38,0.3)' : '1px solid #1e3a8a' }}>
              {n.label}
            </Link>
          ))}
        </div>
        {data?.stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Revenue', value: fmtMtc(data.stats.total_revenue || 0), color: '#4ade80' },
              { label: 'Completed Orders', value: data.stats.completed_orders || 0, color: '#3b82f6' },
              { label: 'Pending Orders', value: data.stats.pending_orders || 0, color: '#fb923c' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-5" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
                <div className="text-xl font-extrabold mb-1" style={{ color: c.color }}>{c.value}</div>
                <div className="text-xs" style={{ color: '#64748b' }}>{c.label}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div className="flex space-x-2">
            {['orders', 'wallet'].map(t => (
              <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: tab === t ? 'rgba(59,130,246,0.15)' : '#04070f', color: tab === t ? '#60a5fa' : '#64748b', border: tab === t ? '1px solid rgba(59,130,246,0.3)' : '1px solid #1e3a8a' }}>
                {t === 'orders' ? 'Orders' : 'Wallet Txns'}
              </button>
            ))}
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or reference..."
            className="rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:w-72"
            style={{ backgroundColor: '#04070f', border: '1px solid #1e3a8a', color: '#f0f4ff' }} />
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : tab === 'orders' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr style={{ borderBottom: '1px solid #1e3a8a' }}>
                  {['Reference', 'User', 'Package', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={o.id} style={{ borderBottom: i < orders.length - 1 ? '1px solid #1e3a8a' : 'none' }}>
                      <td className="px-5 py-4 text-xs font-mono" style={{ color: '#475569' }}>{(o.reference || '—').slice(-12)}</td>
                      <td className="px-5 py-4 text-sm" style={{ color: '#94a3b8' }}>{o.user_email}</td>
                      <td className="px-5 py-4 text-sm" style={{ color: '#f0f4ff' }}>{o.package_name}</td>
                      <td className="px-5 py-4 text-sm font-semibold" style={{ color: '#4ade80' }}>{fmtMtc(o.amount || 0)}</td>
                      <td className="px-5 py-4"><span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: sb(o.status), color: sc(o.status) }}>{o.status}</span></td>
                      <td className="px-5 py-4 text-xs" style={{ color: '#475569' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#374151' }}>No orders found</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr style={{ borderBottom: '1px solid #1e3a8a' }}>
                  {['User', 'Type', 'Amount', 'Description', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {txns.map((t, i) => (
                    <tr key={t.id} style={{ borderBottom: i < txns.length - 1 ? '1px solid #1e3a8a' : 'none' }}>
                      <td className="px-5 py-4 text-sm" style={{ color: '#94a3b8' }}>{t.user_email}</td>
                      <td className="px-5 py-4 text-sm capitalize" style={{ color: '#f0f4ff' }}>{t.type}</td>
                      <td className="px-5 py-4 text-sm font-semibold" style={{ color: t.type === 'debit' ? '#f87171' : '#4ade80' }}>{t.type === 'debit' ? '-' : '+'}{fmtMtc(t.amount)}</td>
                      <td className="px-5 py-4 text-xs max-w-xs truncate" style={{ color: '#64748b' }}>{t.description}</td>
                      <td className="px-5 py-4"><span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: sb(t.status), color: sc(t.status) }}>{t.status}</span></td>
                      <td className="px-5 py-4 text-xs" style={{ color: '#475569' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {txns.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#374151' }}>No transactions found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
