'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar, Badge, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, PageHeader,
  RowMenu, SearchInput, Skeleton, StatusIndicator, humaniseError, planLabel, planTone, useToast,
  Icons,
} from '@/components/ui';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'free', label: 'Free' },
  { key: 'premium', label: 'Premium' },
  { key: 'expired', label: 'Expired' },
];

// Only the plans the API actually accepts for set_plan.
const PLAN_CHOICES = [
  { plan: 'PREMIUM', label: 'Upgrade to Premium', icon: <Icons.Sparkles size={15} /> },
  { plan: 'BUSINESS', label: 'Upgrade to Business', icon: <Icons.Zap size={15} /> },
  { plan: 'FREE', label: 'Downgrade to Free', icon: <Icons.ChevronDown size={15} /> },
  { plan: 'ADMIN', label: 'Make Admin', icon: <Icons.Shield size={15} /> },
];

const PAID = new Set(['PREMIUM', 'BUSINESS', 'ADMIN', 'PLAN_5', 'PLAN_10', 'PLAN_20', 'UNLIMITED']);

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsers() {
  const router = useRouter();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [confirm, setConfirm] = useState(null); // { user, type, plan, ... }
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, subsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/subscriptions'),
      ]);
      const usersData = usersRes.ok ? await usersRes.json() : {};
      if (!usersRes.ok) throw new Error(usersData.error || 'Failed to load users');
      const subsData = subsRes.ok ? await subsRes.json() : { botSubscriptions: [], apiPlans: [] };

      const map = new Map();
      for (const s of subsData.apiPlans || []) {
        map.set(s.userId, { apiPlan: s.plan, apiStatus: s.status, expiresAt: s.expiresAt, maxDevices: null, botStatus: null, endDate: null, email: s.email, fullname: s.fullname });
      }
      for (const s of subsData.botSubscriptions || []) {
        map.set(s.userId, { ...(map.get(s.userId) || {}), botPlan: s.plan, maxDevices: s.maxDevices, botStatus: s.status, endDate: s.endDate, email: s.email, fullname: s.fullname });
      }

      setSubs(map);
      setUsers(usersData.users || []);
    } catch (e) {
      setError(humaniseError(e, 'We could not load users right now. Please try again.'));
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

  const rows = useMemo(() => users.map((u) => {
    const sub = subs.get(u.id) || {};
    const plan = sub.botPlan || sub.apiPlan || null;
    const status = sub.botStatus || sub.apiStatus || null;
    const expiry = sub.botPlan ? sub.endDate : (sub.expiresAt ?? null);
    return {
      ...u,
      plan,
      status,
      expiry,
      devices: sub.botPlan ? sub.maxDevices : null,
      expired: expiry ? new Date(expiry).getTime() < Date.now() : false,
    };
  }), [users, subs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      if (q) {
        const name = (u.fullname || `${u.firstname || ''} ${u.lastname || ''}`).toLowerCase();
        if (!name.includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
      }
      if (filter === 'active') return (u.status || '').toLowerCase() === 'active' && !u.expired;
      if (filter === 'free') return (u.plan || '').toUpperCase() === 'FREE';
      if (filter === 'premium') return PAID.has((u.plan || '').toUpperCase());
      if (filter === 'expired') return u.expired;
      return true;
    });
  }, [rows, search, filter]);

  const runAction = async (user, body, successMsg) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Action failed');
      toast.success(successMsg);
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(humaniseError(e, 'We could not complete that action. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const menuItems = (u) => [
    ...PLAN_CHOICES
      .filter((c) => (u.plan || 'FREE').toUpperCase() !== c.plan)
      .map((c) => ({
        label: c.label,
        icon: c.icon,
        onClick: () => setConfirm({
          user: u,
          body: { action: 'set_plan', plan: c.plan },
          title: `Change plan for ${u.email}?`,
          description: `This sets the API subscription to ${planLabel(c.plan)} immediately.`,
          confirmLabel: 'Change plan',
        }),
      })),
    {
      label: 'Suspend', icon: <Icons.Ban size={15} />, danger: true,
      onClick: () => setConfirm({
        user: u,
        body: { action: 'suspend' },
        title: `Suspend ${u.email}?`,
        description: 'The account is suspended and its active API keys are revoked. You can restore it later.',
        confirmLabel: 'Suspend user',
      }),
    },
    {
      label: 'Restore', icon: <Icons.Refresh size={15} />,
      onClick: () => setConfirm({
        user: u,
        body: { action: 'restore' },
        title: `Restore ${u.email}?`,
        description: 'The account is set back to active.',
        confirmLabel: 'Restore user',
      }),
    },
  ];

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader
        title="Users"
        description={`${filtered.length} of ${rows.length} members`}
        icon={<Icons.Users size={20} />}
      />

      <Card style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <SearchInput
            id="users-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
          />
          <div className="segmented scroll-x" role="tablist" aria-label="Filter users">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={filter === f.key ? 'is-active' : ''}
                style={{ minHeight: 44 }}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error ? (
        <Card><ErrorState title="Could not load users" message={error} onRetry={load} /></Card>
      ) : loading ? (
        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={40} />)}
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icons.Users size={26} />}
            title={search || filter !== 'all' ? 'No matching users' : 'No users yet'}
            description={search || filter !== 'all' ? 'Try a different search or filter.' : 'New members will appear here once they sign up.'}
          />
        </Card>
      ) : (
        <Card style={{ padding: 0 }} className="anim-fade-up">
          <DataTable columns={['User', 'Plan', 'Devices', 'Status', 'Expiry', 'Actions']}>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td data-label="User">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={u.fullname || u.email || 'U'} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{u.fullname || `${u.firstname || ''} ${u.lastname || ''}`.trim() || 'Unknown'}</div>
                      <div className="mono truncate-1" style={{ fontSize: 11.5, color: 'var(--dim)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Plan">
                  {u.plan ? <Badge tone={planTone(u.plan)}>{planLabel(u.plan)}</Badge> : '—'}
                </td>
                <td data-label="Devices">{u.devices !== null && u.devices !== undefined ? u.devices : '—'}</td>
                <td data-label="Status">
                  {u.status
                    ? <StatusIndicator
                        status={String(u.status).toLowerCase() === 'active' ? 'good' : 'warn'}
                        label={String(u.status)[0].toUpperCase() + String(u.status).slice(1).toLowerCase()}
                      />
                    : '—'}
                </td>
                <td data-label="Expiry" className="mono" style={{ fontSize: 12.5, color: u.expired ? 'var(--bad)' : 'var(--dim)' }}>{fmtDate(u.expiry)}</td>
                <td data-label="Actions" style={{ textAlign: 'right' }}>
                  <RowMenu items={menuItems(u)} label={`Actions for ${u.email}`} />
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && runAction(confirm.user, confirm.body, confirm.title)}
        loading={busy}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
      />
    </div>
  );
}
