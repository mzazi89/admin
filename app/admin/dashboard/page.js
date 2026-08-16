'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fmtMtc } from '@/lib/currency';

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

  if (loading) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="spinner" />
      <p className="mono mt-4" style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4C535B' }}>
        Loading dashboard
      </p>
    </div>
  );

  const statCells = [
    { label: 'Total users', value: stats.totalUsers, href: '/admin/users', accent: false },
    { label: 'Total revenue', value: fmtMtc(stats.totalRevenue), href: '/admin/transactions', accent: true },
    { label: 'Completed orders', value: stats.completedOrders, href: '/admin/transactions', accent: false },
    { label: 'Open inquiries', value: stats.openInquiries, href: '/admin/inquiries', accent: false },
  ];

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow mb-4">Overview</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>
          Dashboard
        </h1>
        <p className="lede mt-3" style={{ maxWidth: 560, fontSize: '0.95rem' }}>
          Live figures from the shared Neon database — users, revenue, orders and support volume.
        </p>
      </div>

      {/* Stat ledger — one panel, hairline dividers, not a card grid */}
      <div className="card mb-8" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="grid grid-cols-2 lg:grid-cols-4"
          style={{
            backgroundColor: '#1B2026',
            gap: '1px',
            borderBottom: '1px solid #262C33',
          }}
        >
          {statCells.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              style={{
                textDecoration: 'none',
                display: 'block',
                padding: '26px 22px',
                backgroundColor: '#14181D',
                transition: 'background-color .15s ease',
              }}
              className="hover:bg-[#1A1F25]"
            >
              <div className="stat-num" style={{ color: c.accent ? '#F2A93B' : '#E9E7E2' }}>{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </Link>
          ))}
        </div>
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4C535B' }}>
            Ledger · {new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4C535B' }}>
            Sync live
          </span>
        </div>
      </div>

      <div className="grid-2-responsive">
        {/* Recent inquiries */}
        <div className="card card-pad" style={{ padding: '22px' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="section-title" style={{ fontSize: '1.05rem' }}>Recent inquiries</h2>
            <Link href="/admin/inquiries" className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4C7DFC', textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          {stats.recentInquiries.length > 0 ? (
            <div>
              {stats.recentInquiries.map((inq, i) => (
                <div key={inq.id} className="flex items-start justify-between gap-3 py-3"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid #1B2026' }}>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#E9E7E2', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inq.subject}
                    </p>
                    <p className="mono mt-1" style={{ fontSize: 10.5, color: '#4C535B', margin: 0 }}>
                      {inq.user_email}
                    </p>
                  </div>
                  <span className={`tag ${inq.status === 'open' ? 'tag-amber' : inq.status === 'closed' ? 'tag-red' : 'tag-green'} flex-shrink-0`}>
                    {inq.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mono" style={{ fontSize: 12, color: '#4C535B', padding: '20px 0' }}>No inquiries yet.</p>
          )}
        </div>

        {/* Recent users */}
        <div className="card card-pad" style={{ padding: '22px' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="section-title" style={{ fontSize: '1.05rem' }}>Recent sign-ups</h2>
            <Link href="/admin/users" className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4C7DFC', textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          {stats.recentUsers.length > 0 ? (
            <div>
              {stats.recentUsers.map((u, i) => (
                <div key={u.id} className="flex items-center justify-between gap-3 py-3"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid #1B2026' }}>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#E9E7E2', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.fullname || ((u.firstname || '') + ' ' + (u.lastname || '')).trim() || 'Unknown'}
                    </p>
                    <p className="mono mt-1" style={{ fontSize: 10.5, color: '#4C535B', margin: 0 }}>
                      {u.email}
                    </p>
                  </div>
                  <span className="mono flex-shrink-0" style={{ fontSize: 11, color: '#3ECF8E' }}>
                    {fmtMtc(u.wallet_balance || 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mono" style={{ fontSize: 12, color: '#4C535B', padding: '20px 0' }}>No users yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
