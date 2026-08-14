'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fmtMtc, fmtMtcValue, mtcToKsh } from '@/lib/currency';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      fetch('/api/admin/users').then(async r2 => {
        if (r2.ok) { const d = await r2.json(); setUsers(d.users); }
        setLoading(false);
      });
    });
  }, []);

  const filtered = users.filter(u =>
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.fullname || '').toLowerCase().includes(search.toLowerCase()) ||
    ((u.firstname || '') + ' ' + (u.lastname || '')).toLowerCase().includes(search.toLowerCase())
  );

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login'); };

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
          {[{ href: '/admin/dashboard', label: 'Overview' }, { href: '/admin/users', label: 'Users', active: true }, { href: '/admin/transactions', label: 'Transactions' }, { href: '/admin/inquiries', label: 'Inquiries' }, { href: '/admin/packages', label: 'Packages' }, { href: '/admin/vouchers', label: 'Vouchers & Recoveries' }].map(n => (
            <Link key={n.href} href={n.href} className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: n.active ? 'rgba(220,38,38,0.15)' : 'rgba(30,32,48,0.5)', color: n.active ? '#f87171' : '#64748b', border: n.active ? '1px solid rgba(220,38,38,0.3)' : '1px solid #1e3a8a' }}>
              {n.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-extrabold" style={{ color: '#f0f4ff' }}>
            All Users <span className="text-base font-normal" style={{ color: '#64748b' }}>({filtered.length})</span>
          </h1>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
            className="rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:w-72"
            style={{ backgroundColor: '#04070f', border: '1px solid #1e3a8a', color: '#f0f4ff' }} />
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e3a8a' }}>
                    {['ID', 'Name', 'Email', 'Wallet Balance', 'Orders', 'Joined'].map(h => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #1e3a8a' : 'none' }}>
                      <td className="px-5 py-4 text-xs" style={{ color: '#475569' }}>#{u.id}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff' }}>
                            {(u.firstname || u.email || 'U')[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium" style={{ color: '#f0f4ff' }}>{u.fullname || ((u.firstname || '') + ' ' + (u.lastname || '')).trim() || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: '#94a3b8' }}>{u.email}</td>
                      <td className="px-5 py-4 text-sm font-semibold" style={{ color: '#4ade80' }}>{fmtMtc(u.wallet_balance || 0)}</td>
                      <td className="px-5 py-4 text-sm" style={{ color: '#94a3b8' }}>{u.total_orders}</td>
                      <td className="px-5 py-4 text-xs" style={{ color: '#475569' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#374151' }}>No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
