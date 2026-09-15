'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fmtKes } from '@/lib/currency';
import {
  Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton,
  StatCard, humaniseError, Icons,
} from '@/components/ui';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/transactions'),
      fetch('/api/admin/inquiries'),
      fetch('/api/admin/sessions'),
      fetch('/api/admin/api/stats'),
    ])
      .then(async ([uRes, txRes, inqRes, sRes, stRes]) => {
        const bad = [uRes, txRes, inqRes, sRes, stRes].find((r) => !r.ok);
        if (bad) throw new Error(`Request failed (${bad.status})`);
        const [users, tx, inq, sess, apiStats] = await Promise.all([
          uRes.json(), txRes.json(), inqRes.json(), sRes.json(), stRes.json(),
        ]);
        const sessions = sess.sessions || [];
        setStats({
          totalUsers: (users.users || []).length,
          activeUsers: apiStats.users?.active ?? null,
          connectedDevices: sessions.filter((s) => s.active).length,
          activeSubscriptions: apiStats.subscriptions?.active ?? null,
          totalRevenue: tx.stats?.total_revenue || 0,
          botOnline: sess.botOnline !== false,
          openInquiries: (inq.inquiries || []).filter((i) => i.status === 'open').length,
          recentUsers: (users.users || []).slice(0, 5),
          recentOrders: (tx.orders || []).slice(0, 5),
        });
        setLoading(false);
      })
      .catch((e) => {
        setError(humaniseError(e, 'We could not load the dashboard right now. Please try again.'));
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exactly six tiles, each bound to a real figure from the endpoints above.
  const tiles = [
    {
      label: 'Total users', value: stats?.totalUsers ?? 0, hint: 'Registered accounts',
      icon: <Icons.Users size={18} />, tone: 'brand', href: '/admin/users',
    },
    {
      label: 'Active users', value: stats?.activeUsers ?? '—', hint: 'Accounts with active status',
      icon: <Icons.User size={18} />, tone: 'good', href: '/admin/users',
    },
    {
      label: 'Connected devices', value: stats?.connectedDevices ?? 0, hint: 'Live WhatsApp sessions',
      icon: <Icons.Phone size={18} />, tone: 'blue', href: '/admin/sessions',
    },
    {
      label: 'Active subscriptions', value: stats?.activeSubscriptions ?? '—', hint: 'Active plan records',
      icon: <Icons.CreditCard size={18} />, tone: 'brand', href: '/admin/subscriptions',
    },
    {
      label: 'Revenue', value: fmtKes(stats?.totalRevenue || 0), hint: 'Completed orders',
      icon: <Icons.Wallet size={18} />, tone: 'good', href: '/admin/transactions',
    },
    {
      label: 'Bot status', value: stats ? (stats.botOnline ? 'Online' : 'Offline') : '—',
      hint: 'From the bot heartbeat',
      icon: <Icons.Bot size={18} />, tone: stats?.botOnline ? 'good' : 'bad', href: '/admin/bot',
    },
  ];

  const uName = (u) => u.fullname || ((u.firstname || '') + ' ' + (u.lastname || '')).trim() || u.email || 'Unknown';

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader
        title="Dashboard"
        description="Live figures from the shared Neon database."
        icon={<Icons.Dashboard size={20} />}
        actions={
          <Link href="/admin/inquiries" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
            <span>Support · {loading ? '…' : `${stats?.openInquiries ?? 0} open`}</span>
          </Link>
        }
      />

      {error ? (
        <Card><ErrorState title="Could not load the dashboard" message={error} onRetry={load} /></Card>
      ) : (
        <>
          <div className="grid-cards anim-fade-up" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {tiles.map((t) => (
              <Link key={t.label} href={t.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <StatCard label={t.label} value={t.value} hint={t.hint} icon={t.icon} tone={t.tone} loading={loading} />
              </Link>
            ))}
          </div>

          <div className="grid-2-responsive" style={{ marginTop: 22 }}>
            {/* Recent sign-ups */}
            <Card style={{ padding: 20 }}>
              <CardHeader
                title="Recent sign-ups"
                icon={<Icons.Users size={17} />}
                action={<Link href="/admin/users" className="link" style={{ fontSize: 13 }}>View all</Link>}
                style={{ marginBottom: 8 }}
              />
              {loading ? (
                <div style={{ display: 'grid', gap: 12, paddingTop: 6 }}>
                  {[0, 1, 2].map((i) => <Skeleton key={i} h={34} />)}
                </div>
              ) : stats.recentUsers.length === 0 ? (
                <EmptyState compact icon={<Icons.Users size={22} />} title="No users yet" description="New sign-ups will appear here." />
              ) : (
                <div>
                  {stats.recentUsers.map((u, i) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)' }}>
                      <div style={{ minWidth: 0 }}>
                        <p className="truncate-1" style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{uName(u)}</p>
                        <p className="mono truncate-1" style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--dim)' }}>{u.email}</p>
                      </div>
                      <span style={{ flex: '0 0 auto', fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{fmtKes(u.wallet_balance || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent payments */}
            <Card style={{ padding: 20 }}>
              <CardHeader
                title="Recent payments"
                icon={<Icons.CreditCard size={17} />}
                action={<Link href="/admin/transactions" className="link" style={{ fontSize: 13 }}>View all</Link>}
                style={{ marginBottom: 8 }}
              />
              {loading ? (
                <div style={{ display: 'grid', gap: 12, paddingTop: 6 }}>
                  {[0, 1, 2].map((i) => <Skeleton key={i} h={34} />)}
                </div>
              ) : stats.recentOrders.length === 0 ? (
                <EmptyState compact icon={<Icons.CreditCard size={22} />} title="No payments yet" description="Completed orders will appear here." />
              ) : (
                <div>
                  {stats.recentOrders.map((o, i) => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)' }}>
                      <div style={{ minWidth: 0 }}>
                        <p className="truncate-1" style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{o.package_name || 'Payment'}</p>
                        <p className="mono truncate-1" style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--dim)' }}>{o.user_email}</p>
                      </div>
                      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Badge tone={o.status === 'completed' ? 'good' : o.status === 'pending' ? 'warn' : 'bad'}>{o.status}</Badge>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{fmtKes(o.amount || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
