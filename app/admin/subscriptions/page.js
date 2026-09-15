'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState,
  ImageWithFallback, PageHeader, SkeletonCards, StatusIndicator, humaniseError, planLabel, planTone,
  Icons,
} from '@/components/ui';

// WhatsApp bot plans. Authoritative ids / device counts / prices / duration live
// in lib/pairApi.js (PLANS) — the server drops that module into the browser
// bundle, so the values are mirrored here rather than imported. Free is the
// implicit 1-device tier (no PAID plan row).
const PLANS = [
  { key: 'FREE',      name: 'Free',       devices: 1,   priceKsh: 0,   days: 30 },
  { key: 'PLAN_5',    name: '5 Numbers',  devices: 5,   priceKsh: 100, days: 30 },
  { key: 'PLAN_10',   name: '10 Numbers', devices: 10,  priceKsh: 150, days: 30 },
  { key: 'PLAN_20',   name: '20 Numbers', devices: 20,  priceKsh: 200, days: 30 },
  { key: 'UNLIMITED', name: 'Unlimited',  devices: null, priceKsh: 250, days: 30 },
];

function deviceText(devices) {
  if (devices === null || devices === undefined) return 'Unlimited devices';
  if (Number(devices) >= 999) return 'Unlimited devices';
  return `${devices} device${devices === 1 ? '' : 's'}`;
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'good';
  if (s === 'expired' || s === 'failed' || s === 'cancelled') return 'bad';
  if (s === 'pending' || s === 'trialing') return 'warn';
  return 'neutral';
}

export default function AdminSubscriptions() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/subscriptions');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load subscriptions');
      setData({
        botSubscriptions: d.botSubscriptions || [],
        apiPlans: d.apiPlans || [],
        counts: d.counts || { bot: {}, api: {} },
      });
    } catch (e) {
      setError(humaniseError(e, 'We could not load subscriptions right now. Please try again.'));
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

  // Merge the two sources by user id — the bot plan is the "real" WhatsApp plan,
  // the API plan is the platform fallback.
  const subscribers = useMemo(() => {
    if (!data) return [];
    const byUser = new Map();
    for (const s of data.apiPlans) {
      byUser.set(s.userId, {
        userId: s.userId, email: s.email, fullname: s.fullname,
        botPlan: null, maxDevices: null, botStatus: null, endDate: null,
        apiPlan: s.plan, apiStatus: s.status, expiresAt: s.expiresAt,
      });
    }
    for (const s of data.botSubscriptions) {
      const base = byUser.get(s.userId) || { userId: s.userId };
      byUser.set(s.userId, {
        ...base,
        email: base.email || s.email, fullname: base.fullname || s.fullname,
        botPlan: s.plan, maxDevices: s.maxDevices, botStatus: s.status, endDate: s.endDate,
      });
    }
    return [...byUser.values()].sort((a, b) => (a.userId || 0) - (b.userId || 0));
  }, [data]);

  const botCount = (key) => data?.counts?.bot?.[key] || 0;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <PageHeader
          title="Subscriptions"
          description="WhatsApp bot plans and the members on them. Counts are live from the shared database."
          icon={<Icons.CreditCard size={20} />}
          actions={<Button variant="ghost" size="sm" icon={<Icons.Refresh size={15} />} onClick={load} loading={loading}>Refresh</Button>}
        />

        {error ? (
          <Card><ErrorState title="Could not load subscriptions" message={error} onRetry={load} /></Card>
        ) : (
          <>
            {loading ? (
              <SkeletonCards count={5} height={172} />
            ) : (
              <div className="grid-cards anim-fade-up">
                {PLANS.map((p) => (
                  <article key={p.key} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <ImageWithFallback
                        src={null}
                        alt=""
                        ratio="1-1"
                        rounded="md"
                        label={p.name.split(' ')[0]}
                        style={{ width: 40, height: 40, flex: '0 0 40px' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</h3>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icons.Phone size={13} /> {deviceText(p.devices)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{p.priceKsh ? `KES ${p.priceKsh}` : 'Free'}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>/ {p.days} days</span>
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="stat-label" style={{ margin: 0 }}>Subscribers</span>
                      <span className="stat-num tnum" style={{ fontSize: '1.25rem' }}>{botCount(p.key)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <Card style={{ padding: 0, marginTop: 22 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <CardHeader title="Subscribers" description={`${subscribers.length} member${subscribers.length === 1 ? '' : 's'} with a plan record`} style={{ marginBottom: 0 }} />
              </div>

              {loading ? (
                <div style={{ padding: 18 }}><SkeletonCards count={3} height={64} /></div>
              ) : subscribers.length === 0 ? (
                <EmptyState
                  icon={<Icons.CreditCard size={26} />}
                  title="No subscriptions yet"
                  description="When members subscribe to a WhatsApp bot plan they will appear here."
                />
              ) : (
                <div className="scroll-x table-responsive">
                  <table className="table-plain" style={{ minWidth: 0 }}>
                    <thead>
                      <tr>
                        <th scope="col">User</th>
                        <th scope="col">Plan</th>
                        <th scope="col">Devices</th>
                        <th scope="col">Status</th>
                        <th scope="col">Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscribers.map((s) => {
                        const plan = s.botPlan || s.apiPlan || 'FREE';
                        const status = s.botStatus || s.apiStatus;
                        const expiry = s.botPlan ? s.endDate : s.expiresAt;
                        return (
                          <tr key={s.userId}>
                            <td data-label="User">
                              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>
                                {s.fullname || s.email || `User #${s.userId}`}
                              </div>
                              {s.email && <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim)' }}>{s.email}</div>}
                            </td>
                            <td data-label="Plan"><Badge tone={planTone(plan)}>{planLabel(plan)}</Badge></td>
                            <td data-label="Devices">{s.botPlan ? deviceText(s.maxDevices) : '—'}</td>
                            <td data-label="Status">
                              {status
                                ? <StatusIndicator status={statusTone(status)} label={String(status)[0].toUpperCase() + String(status).slice(1).toLowerCase()} />
                                : '—'}
                            </td>
                            <td data-label="Expiry" className="mono" style={{ fontSize: 12.5, color: 'var(--dim)' }}>{fmtDate(expiry)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
    </div>
  );
}
