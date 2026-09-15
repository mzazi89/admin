'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, ConfirmDialog, DataTable, EmptyState, ErrorState, PageHeader, RowMenu, Skeleton,
  StatusIndicator, formatPhone, humaniseError, useToast,
  Icons,
} from '@/components/ui';

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function AdminSessions() {
  const router = useRouter();
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [bots, setBots] = useState([]);
  const [botOnline, setBotOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { session, action }
  const [busy, setBusy] = useState(false);

  const botName = (id) => {
    const found = bots.find((b) => b.id === id);
    return found ? found.name : id;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/sessions');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load devices');
      setSessions(d.sessions || []);
      setBots(d.bots || []);
      setBotOnline(d.botOnline !== false);
    } catch (e) {
      setError(humaniseError(e, 'We could not load devices right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
  }, [load, router]);

  const run = async (session, action) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/session-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: session.phoneNumber, action, bot: session.bot || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to run the action');
      toast.success(`${action === 'delete' ? 'Delete' : 'Unlink'} requested for ${session.phoneNumber} — the bot applies it within ~15s.`);
      setConfirm(null);
      setTimeout(load, 15000);
    } catch (e) {
      toast.error(humaniseError(e, 'We could not complete that action. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const statusFor = (s) => {
    if (s.active) return { status: 'good', label: 'Online', pulse: true };
    if (!botOnline) return { status: 'warn', label: 'Needs attention' };
    return { status: 'offline', label: 'Offline' };
  };

  const menuItems = (s) => [
    {
      label: 'Unlink', icon: <Icons.LogOut size={15} />,
      onClick: () => setConfirm({
        session: s, action: 'unlink',
        title: `Unlink ${s.phoneNumber}?`,
        description: 'The bot logs this device out of WhatsApp. It can be paired again afterwards.',
        confirmLabel: 'Unlink device',
      }),
    },
    {
      label: 'Delete', icon: <Icons.Trash size={15} />, danger: true,
      onClick: () => setConfirm({
        session: s, action: 'delete',
        title: `Delete ${s.phoneNumber}?`,
        description: 'This removes the session folder on the bot and the database row. It cannot be undone.',
        confirmLabel: 'Delete device',
      }),
    },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <PageHeader
        title="Devices"
        description="Every paired WhatsApp number across all members. Online = the bot currently holds the session."
        icon={<Icons.Phone size={20} />}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            <span><Icons.Refresh size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Refresh</span>
          </button>
        }
      />

      {error ? (
        <Card><ErrorState title="Could not load devices" message={error} onRetry={load} /></Card>
      ) : loading ? (
        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState icon={<Icons.Phone size={26} />} title="No devices paired" description="When members pair a WhatsApp number it will appear here." />
        </Card>
      ) : (
        <Card style={{ padding: 0 }} className="anim-fade-up">
          <DataTable columns={['Phone', 'User', 'Bot', 'Status', 'Last seen', 'Actions']}>
            {sessions.map((s) => {
              const st = statusFor(s);
              return (
                <tr key={s.id}>
                  <td data-label="Phone">
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatPhone(s.phoneNumber)}</span>
                  </td>
                  <td data-label="User">
                    <div style={{ color: 'var(--ink-2)' }}>{s.email || `User #${s.userId ?? '?'}`}</div>
                    {s.firstname && <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim)' }}>{s.firstname} {s.lastname || ''}</div>}
                  </td>
                  <td data-label="Bot" className="mono" style={{ fontSize: 12.5, color: s.bot ? 'var(--brand)' : 'var(--dim)' }}>
                    {s.bot ? botName(s.bot) : '—'}
                  </td>
                  <td data-label="Status">
                    <StatusIndicator status={st.status} label={st.label} pulse={st.pulse} />
                  </td>
                  <td data-label="Last seen" className="mono" style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                    {fmtDate(s.updatedAt || s.connectedAt || s.createdAt)}
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'right' }}>
                    <RowMenu items={menuItems(s)} label={`Actions for ${s.phoneNumber}`} />
                  </td>
                </tr>
              );
            })}
          </DataTable>

          {/* Technical detail is admin-only and collapsed by default. */}
          <details style={{ borderTop: '1px solid var(--line)', padding: '14px 16px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
              Technical session details
            </summary>
            <div className="mono scroll-x" style={{ marginTop: 12, fontSize: 12, lineHeight: 1.7, color: 'var(--dim)' }}>
              {sessions.map((s) => (
                <div key={s.id} style={{ padding: '6px 0', borderTop: '1px solid var(--line-soft)' }}>
                  id={s.id} · user={s.userId ?? '—'} · raw_status={String(s.status ?? '—')} · bot={s.bot || '—'} ·
                  connectedAt={s.connectedAt ? new Date(s.connectedAt).toISOString() : '—'} ·
                  createdAt={s.createdAt ? new Date(s.createdAt).toISOString() : '—'} ·
                  updatedAt={s.updatedAt ? new Date(s.updatedAt).toISOString() : '—'}
                </div>
              ))}
            </div>
          </details>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && run(confirm.session, confirm.action)}
        loading={busy}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
      />
    </div>
  );
}
