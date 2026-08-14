'use client';
import { useState, useEffect } from 'react';
import TypingHeading from '@/components/TypingHeading';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fmtMtc, fmtMtcValue, mtcToKsh } from '@/lib/currency';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      Promise.all([
        fetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }),
        fetch('/api/admin/transactions').then(r => r.ok ? r.json() : { transactions: [], orders: [], stats: {} }),
        fetch('/api/admin/inquiries').then(r => r.ok ? r.json() : { inquiries: [] }),
      ]).then(([users, tx, inq]) => {
        setStats({
          totalUsers: users.users.length,
          totalRevenue: tx.stats?.total_revenue || 0,
          completedOrders: tx.stats?.completed_orders || 0,
          openInquiries: inq.inquiries.filter(i => i.status === 'open').length,
          recentInquiries: inq.inquiries.slice(0, 5),
          recentUsers: users.users.slice(0, 5),
        });
        setLoading(false);
      });
    });
  }, []);

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login'); };

  if (loading) return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgba(6,8,16,0.78)' }}>
      <div style={{ backgroundColor: '#04070f', borderBottom: '1px solid #1e3a8a' }} className="h-14" />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: '#64748b' }}>Loading admin panel...</p>
        </div>
      </div>
    </div>
  );

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', href: '/admin/users' },
    { label: 'Total Revenue', value: fmtMtc(stats.totalRevenue), icon: '💰', color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)', href: '/admin/transactions' },
    { label: 'Completed Orders', value: stats.completedOrders, icon: '✅', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', href: '/admin/transactions' },
    { label: 'Open Inquiries', value: stats.openInquiries, icon: '💬', color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', href: '/admin/inquiries' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgba(6,8,16,0.78)' }}>
      {/* Top bar */}
      <div style={{ backgroundColor: '#04070f', borderBottom: '1px solid #1e3a8a' }} className="sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: '#f0f4ff' }}>Admin Panel</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(220,38,38,0.15)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)' }}>Restricted</span>
          </div>
          <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', backgroundColor: 'rgba(248,113,113,0.05)' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Nav tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { href: '/admin/dashboard', label: 'Overview', active: true },
            { href: '/admin/users', label: 'Users' },
            { href: '/admin/transactions', label: 'Transactions' },
            { href: '/admin/inquiries', label: 'Inquiries' },
            { href: '/admin/packages', label: 'Packages' },
            { href: '/admin/vouchers', label: 'Vouchers & Recoveries' },
          ].map(n => (
            <Link key={n.href} href={n.href} className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: n.active ? 'rgba(220,38,38,0.15)' : 'rgba(30,32,48,0.5)', color: n.active ? '#f87171' : '#64748b', border: n.active ? '1px solid rgba(220,38,38,0.3)' : '1px solid #1e3a8a' }}>
              {n.label}
            </Link>
          ))}
        </div>

        <TypingHeading as="h1" text="Dashboard Overview" speed={55} className="text-2xl font-extrabold mb-6" style={{ color: '#f0f4ff' }} />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {cards.map(c => (
            <Link href={c.href} key={c.label} className="rounded-2xl p-5 transition-all hover:scale-105 cursor-pointer"
              style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-2xl font-extrabold mb-1" style={{ color: c.color }}>{c.value}</div>
              <div className="text-xs" style={{ color: '#64748b' }}>{c.label}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Inquiries */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-sm" style={{ color: '#f0f4ff' }}>Recent Inquiries</h2>
              <Link href="/admin/inquiries" className="text-xs" style={{ color: '#3b82f6' }}>View all →</Link>
            </div>
            {stats.recentInquiries.length > 0 ? (
              <div className="space-y-3">
                {stats.recentInquiries.map(inq => (
                  <div key={inq.id} className="p-3 rounded-xl" style={{ backgroundColor: '#04070f', border: '1px solid #1e3a8a' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#f0f4ff' }}>{inq.subject}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#64748b' }}>{inq.user_email}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
                        style={{ backgroundColor: inq.status === 'open' ? 'rgba(251,146,60,0.15)' : 'rgba(74,222,128,0.1)', color: inq.status === 'open' ? '#fb923c' : '#4ade80' }}>
                        {inq.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-center py-4" style={{ color: '#374151' }}>No inquiries yet</p>}
          </div>

          {/* Recent Users */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-sm" style={{ color: '#f0f4ff' }}>Recent Sign-ups</h2>
              <Link href="/admin/users" className="text-xs" style={{ color: '#3b82f6' }}>View all →</Link>
            </div>
            {stats.recentUsers.length > 0 ? (
              <div className="space-y-3">
                {stats.recentUsers.map(u => (
                  <div key={u.id} className="flex items-center space-x-3 p-3 rounded-xl" style={{ backgroundColor: '#04070f', border: '1px solid #1e3a8a' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff' }}>
                      {(u.firstname || u.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#f0f4ff' }}>{u.fullname || ((u.firstname || '') + ' ' + (u.lastname || '')).trim()}</p>
                      <p className="text-xs truncate" style={{ color: '#64748b' }}>{u.email}</p>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>{fmtMtc(u.wallet_balance || 0)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-center py-4" style={{ color: '#374151' }}>No users yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
