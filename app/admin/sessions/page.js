'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, ConfirmDialog, DataTable, EmptyState, ErrorState, PageHeader, RowMenu,
  SearchInput, Skeleton, StatusIndicator, formatPhone, humaniseError, useToast,
  Icons,
} from '@/components/ui';

// Admin → Devices.
//
// Every paired session, split by bot. The bots are separate destinations here
// because an operator acts on one bot at a time: a session belongs to exactly one
// bot, and an unlink sent to the wrong one claims the row, finds no session, and
// leaves the device linked while the panel reports success. Keeping the tabs
// apart makes the target obvious before the button is pressed.
//
// Actions are unchanged and go through /api/admin/session-action, which queues
// the unlink/delete row the bot applies within ~15s.

const UNASSIGNED = '__unassigned';
const ALL = '__all';

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
  const [profiles, setProfiles] = useState([]);
  const [counts, setCounts] = useState({ byBot: {}, total: 0, active: 0 });
  const [botOnline, setBotOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(ALL);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // { session, action }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/sessions', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load devices');
      setSessions(d.sessions || []);
      setBots(d.bots || []);
      setProfiles(d.profiles || []);
      setCounts(d.counts || { byBot: {}, total: 0, active: 0 });
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
      // Deep link: /admin/sessions?bot=<id> opens that bot's tab.
      try {
        const wanted = new URLSearchParams(window.location.search).get('bot');
        if (wanted) setTab(wanted);
      } catch { /* no query string — keep the default tab */ }
      load();
    });
  }, [load, router]);

  // Keep the URL in step with the tab so a refresh (or a shared link) reopens the
  // same bot instead of dropping back to All.
  useEffect(() => {
    if (tab === ALL) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('bot', tab);
      window.history.replaceState(null, '', url);
    } catch { /* history is best-effort */ }
  }, [tab]);

  const botLabel = (id) => {
    const found = bots.find((b) => b.id === id) || profiles.find((b) => b.id === id);
    return found ? found.name : id;
  };

  const run = async (session, action) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/session-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // bot is the real profile id, or omitted for an unattributed session so
        // the server falls back to telemetry.
        body: JSON.stringify({ number: session.phoneNumber, action, bot: session.bot || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to run the action');
      toast.success(`${action === 'delete' ? 'Delete' : 'Logout'} requested for ${formatPhone(session.phoneNumber)} — the bot applies it within ~15s.`);
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
      label: 'Logout', icon: <Icons.LogOut size={15} />,
      onClick: () => setConfirm({
        session: s, action: 'unlink',
        title: `Log out ${formatPhone(s.phoneNumber)}?`,
        description: `${s.botName || 'This bot'} logs the device out of WhatsApp. The number can be paired again afterwards.`,
        confirmLabel: 'Log out device',
      }),
    },
    {
      label: 'Delete', icon: <Icons.Trash size={15} />, danger: true,
      onClick: () => setConfirm({
        session: s, action: 'delete',
        title: `Delete ${formatPhone(s.phoneNumber)}?`,
        description: 'This removes the session folder on the bot and the database row. It cannot be undone.',
        confirmLabel: 'Delete device',
      }),
    },
  ];

  // Tabs: All, then one per configured bot, then Unassigned when anything is
  // sitting outside a bot (a wiped profile, or a session the bots never reported).
  const tabs = useMemo(() => {
    const list = [{ key: ALL, label: 'All', count: counts.total || 0 }];
    for (const b of profiles) {
      list.push({
        key: b.id,
        label: b.name,
        count: counts.byBot?.[b.id] || 0,
        online: bots.find((x) => x.id === b.id)?.online,
      });
    }
    if ((counts.byBot?.[UNASSIGNED] || 0) > 0) {
      list.push({ key: UNASSIGNED, label: 'Unassigned', count: counts.byBot[UNASSIGNED] });
    }
    return list;
  }, [bots, counts, profiles]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (tab !== ALL && s.group !== tab) return false;
      if (!q) return true;
      return [s.phoneNumber, s.email, s.firstname, s.lastname, s.botName]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [sessions, search, tab]);

  const activeTab = tabs.find((t) => t.key === tab) || tabs[0];
  const onlineInView = rows.filter((r) => r.active).length;

  const columns = tab === ALL
    ? ['Phone', 'User', 'Bot', 'Status', 'Last seen', 'Actions']
    : ['Phone', 'User', 'Status', 'Last seen', 'Actions'];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <PageHeader
        title="Devices"
        description="Every paired WhatsApp number across all members, separated by the bot that holds it. Online = that bot has the session right now."
        icon={<Icons.Phone size={20} />}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setLoading(true); load(); }}>
            <span><Icons.Refresh size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Refresh</span>
          </button>
        }
      />

      {/* ── Bot tabs ── */}
      <Card style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="segmented scroll-x" role="tablist" aria-label="Filter devices by bot">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={tab === t.key ? 'is-active' : ''}
                style={{ minHeight: 44 }}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span
                  className="tnum"
                  style={{
                    marginLeft: 7, fontSize: 12, fontWeight: 700,
                    color: tab === t.key ? 'var(--brand)' : 'var(--dim)',
                  }}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <SearchInput
            id="devices-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phone, email or name"
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, color: 'var(--muted)' }}>
            {tab !== ALL && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, color: 'var(--ink)' }}>
                <Icons.Bot size={14} />
                {botLabel(tab)}
              </span>
            )}
            <span>{rows.length} shown</span>
            <span aria-hidden="true">·</span>
            <span style={{ color: onlineInView ? 'var(--good)' : 'var(--dim)' }}>{onlineInView} online</span>
            {(counts.active || 0) > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{counts.active} live across all bots</span>
              </>
            )}
          </div>
        </div>
      </Card>

      {error ? (
        <Card><ErrorState title="Could not load devices" message={error} onRetry={() => { setLoading(true); load(); }} /></Card>
      ) : loading ? (
        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icons.Phone size={26} />}
            title={search ? 'No matching devices' : 'Nothing paired on this bot yet'}
            description={
              search
                ? 'Try a different phone number, email or name.'
                : tab === ALL
                  ? 'When a member pairs a WhatsApp number it will appear here.'
                  : `${activeTab?.label || 'This bot'} has no paired numbers right now.`
            }
          />
        </Card>
      ) : (
        <Card style={{ padding: 0 }} className="anim-fade-up">
          <DataTable columns={columns}>
            {rows.map((s) => {
              const st = statusFor(s);
              return (
                <tr key={s.id}>
                  <td data-label="Phone">
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatPhone(s.phoneNumber)}</span>
                    {s.source === 'live' && (
                      <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 2 }}>no account row</div>
                    )}
                  </td>
                  <td data-label="User">
                    <div style={{ color: 'var(--ink-2)' }}>{s.email || (s.userId ? `User #${s.userId}` : '—')}</div>
                    {s.firstname && <div className="mono" style={{ fontSize: 12.5, color: 'var(--dim)' }}>{s.firstname} {s.lastname || ''}</div>}
                  </td>
                  {tab === ALL && (
                    <td data-label="Bot" className="mono" style={{ fontSize: 12.5, color: s.bot ? 'var(--brand)' : 'var(--dim)' }}>
                      {s.bot ? botLabel(s.bot) : 'Unassigned'}
                    </td>
                  )}
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
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--muted)' }}>
              Technical session details
            </summary>
            <div className="mono scroll-x" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7, color: 'var(--dim)' }}>
              {rows.map((s) => (
                <div key={`tech-${s.id}`} style={{ padding: '6px 0', borderTop: '1px solid var(--line-soft)' }}>
                  id={s.id} · user={s.userId ?? '—'} · raw_status={String(s.status ?? '—')} ·
                  bot={s.bot || '—'} · source={s.source} ·
                  connectedAt={s.connectedAt ? new Date(s.connectedAt).toISOString() : '—'} ·
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
        tone={confirm?.action === 'delete' ? 'danger' : 'default'}
      />
    </div>
  );
}
