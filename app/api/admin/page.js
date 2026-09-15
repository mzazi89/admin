'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ToastProvider, useToast } from '@/components/api/Toast';
import { humaniseError } from '@/components/ui';

const TABS = ['Overview', 'Users', 'API Keys', 'Endpoints', 'Providers', 'Requests', 'Rate Limits'];

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleString();
}

function AdminInner() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('Overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [keys, setKeys] = useState(null);
  const [endpoints, setEndpoints] = useState(null);
  const [requests, setRequests] = useState(null);
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState(null);
  const [page, setPage] = useState(1);
  const [reqFilter, setReqFilter] = useState('all'); // all | failed | provider
  const [busy, setBusy] = useState(false);

  const api = async (url, opts = {}) => {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const loadAll = useCallback(async () => {
    try {
      const [s, u, k, e, settingsData, p] = await Promise.all([
        api('/api/admin/api/stats'),
        api('/api/admin/api/users?per_page=50'),
        api('/api/admin/api/keys?per_page=50'),
        api('/api/admin/api/endpoints'),
        api('/api/admin/api/settings'),
        api('/api/admin/api/providers'),
      ]);
      setStats(s);
      setUsers(u);
      setKeys(k);
      setEndpoints(e);
      setSettings(settingsData.settings || {});
      setProviders(p);
    } catch (err) {
      if (String(err.message).includes('401') || err.message === 'Authentication required') {
        router.replace('/admin/login');
      } else {
        toast(humaniseError(err, 'We could not load the admin dashboard. Please try again.'), 'error');
      }
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const q = new URLSearchParams({ page: String(page), per_page: '20' });
      if (reqFilter === 'failed') q.set('status', 'failed');
      if (reqFilter === 'provider') q.set('provider_failure', '1');
      const r = await api(`/api/admin/api/requests?${q}`);
      setRequests(r);
    } catch (err) { toast(humaniseError(err, 'We could not load the request log. Please try again.'), 'error'); }
  }, [page, reqFilter]);

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      loadAll();
    }).catch(() => router.replace('/admin/login'));
  }, []);

  useEffect(() => { if (tab === 'Requests') loadRequests(); }, [tab, loadRequests]);

  const act = async (fn, successMsg) => {
    setBusy(true);
    try { await fn(); if (successMsg) toast(successMsg); await loadAll(); }
    catch (err) { toast(humaniseError(err, 'We could not complete that action. Please try again.'), 'error'); }
    setBusy(false);
  };

  const updateSetting = async (key, value) => {
    await act(async () => {
      const res = await fetch('/api/admin/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
    }, `Rate limit updated: ${key}`);
  };

  if (!stats) return (
    <div className="container-site py-24 text-center">
      <div className="spinner mx-auto mb-4" />
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading admin panel…</p>
    </div>
  );

  const card = (label, value, color = 'var(--blue-bright)') => (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
    </div>
  );

  return (
    <div className="container-site py-12" style={{ minHeight: '70vh' }}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold"><span className="gradient-text">MZAZI API Admin</span></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dim)' }}>Manage users, keys, endpoints, rate limits and request logs.</p>
        </div>
        <Link href="/admin/dashboard" className="text-xs font-semibold" style={{ color: 'var(--blue-bright)', textDecoration: 'none' }}>
          Site admin →
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: tab === t ? 'rgba(37,99,235,0.15)' : 'transparent',
              color: tab === t ? 'var(--blue-bright)' : 'var(--dim)',
              border: `1px solid ${tab === t ? 'rgba(37,99,235,0.4)' : 'var(--blue-deep)'}`,
              cursor: 'pointer',
            }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {card('Total Requests', stats.stats.total_requests.toLocaleString())}
            {card('Requests Today', stats.stats.requests_today.toLocaleString(), 'var(--blue-soft)')}
            {card('Success / Failed', `${stats.stats.successful.toLocaleString()} / ${stats.stats.failed.toLocaleString()}`, 'var(--good)')}
            {card('Avg Response', stats.stats.avg_response_ms !== null ? `${Number(stats.stats.avg_response_ms).toFixed(1)}ms` : '—', 'var(--warn)')}
            {card('Users (active)', `${stats.users.total} · ${stats.users.active} active`, 'var(--brand-soft)')}
            {card('Suspended / Banned', `${stats.users.suspended} / ${stats.users.banned}`, 'var(--bad)')}
            {card('API Keys (active)', `${stats.keys.total} · ${stats.keys.active}`, 'var(--good)')}
            {card('Endpoints (live)', `${stats.endpoints.total} · ${stats.endpoints.active}`, '#f472b6')}
          </div>
          <div className="card p-6">
            <h2 className="font-bold mb-3" style={{ color: 'var(--ink)' }}>Subscriptions by plan</h2>
            <div className="flex flex-wrap gap-2">
              {stats.subscriptions.by_plan.map(p => (
                <span key={p.plan} className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--blue-bright)', border: '1px solid rgba(37,99,235,0.25)' }}>
                  {p.plan}: {p.count}
                </span>
              ))}
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: 'var(--bg)', color: 'var(--dim)', border: '1px solid var(--blue-deep)' }}>
                Provider failures: {stats.stats.provider_failures.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="card p-6">
            <h2 className="font-bold mb-4" style={{ color: 'var(--ink)' }}>Recent requests (platform)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-responsive">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--blue-deep)' }}>
                    {['Request', 'User', 'Endpoint', 'Status', 'Time', 'When'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_requests.map(r => (
                    <tr key={r.request_id} style={{ borderBottom: '1px solid var(--bg)' }}>
                      <td data-label="" className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>{r.request_id}</td>
                      <td data-label="User" className="px-3 py-2.5 text-xs" style={{ color: 'var(--dim)' }}>{r.user_email || '—'}</td>
                      <td data-label="Endpoint" className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--ink-2)' }}>{r.endpoint}</td>
                      <td data-label="Status" className="px-3 py-2.5 text-xs font-bold" style={{ color: r.status_code < 400 ? 'var(--good)' : 'var(--bad)' }}>{r.status_code}</td>
                      <td data-label="Time" className="px-3 py-2.5 text-xs" style={{ color: 'var(--dim)' }}>{r.response_time_ms}ms</td>
                      <td data-label="When" className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'Users' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-responsive">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--blue-deep)' }}>
                  {['User', 'Plan', 'Status', 'Keys', 'Requests', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td data-label="" className="px-4 py-3">
                      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{u.fullname || u.firstname || u.email}</p>
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{u.email}</p>
                    </td>
                    <td data-label="Plan" className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(37,99,235,0.12)', color: 'var(--blue-bright)' }}>{u.plan || 'FREE'}</span>
                    </td>
                    <td data-label="Status" className="px-4 py-3 text-xs font-bold" style={{ color: u.status === 'active' ? 'var(--good)' : u.status === 'suspended' ? 'var(--warn)' : 'var(--bad)' }}>
                      {u.status.toUpperCase()}
                    </td>
                    <td data-label="Keys" className="px-4 py-3 text-xs" style={{ color: 'var(--dim)' }}>{u.key_count}</td>
                    <td data-label="Requests" className="px-4 py-3 text-xs" style={{ color: 'var(--dim)' }}>{u.request_count}</td>
                    <td data-label="Joined" className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{fmtDate(u.created_at)}</td>
                    <td data-label="Actions" className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <select
                          defaultValue=""
                          onChange={e => {
                            const action = e.target.value;
                            if (!action) return;
                            act(async () => {
                              const res = await fetch(`/api/admin/api/users/${u.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action }),
                              });
                              const d = await res.json();
                              if (!res.ok) throw new Error(d.error || 'Failed');
                            }, `User ${action === 'suspend' ? 'suspended' : action === 'ban' ? 'banned' : 'restored'}`);
                            e.target.value = '';
                          }}
                          className="px-2 py-1 rounded-md text-[11px] outline-none"
                          style={{ backgroundColor: 'rgba(2,4,9,0.45)', border: '1px solid var(--blue-deep)', color: 'var(--dim)' }}>
                          <option value="">Status…</option>
                          <option value="suspend">Suspend</option>
                          <option value="ban">Ban</option>
                          <option value="restore">Restore</option>
                        </select>
                        <select
                          defaultValue=""
                          onChange={e => {
                            const plan = e.target.value;
                            if (!plan) return;
                            act(async () => {
                              const res = await fetch(`/api/admin/api/users/${u.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'set_plan', plan }),
                              });
                              const d = await res.json();
                              if (!res.ok) throw new Error(d.error || 'Failed');
                            }, `Plan → ${plan}`);
                            e.target.value = '';
                          }}
                          className="px-2 py-1 rounded-md text-[11px] outline-none"
                          style={{ backgroundColor: 'rgba(2,4,9,0.45)', border: '1px solid var(--blue-deep)', color: 'var(--dim)' }}>
                          <option value="">Plan…</option>
                          <option value="FREE">Free</option>
                          <option value="PREMIUM">Premium</option>
                          <option value="BUSINESS">Business</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'API Keys' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-responsive">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--blue-deep)' }}>
                  {['Key', 'User', 'Plan', 'Status', 'Requests', 'Last Used', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.keys.map(k => (
                  <tr key={k.id} style={{ borderBottom: '1px solid var(--bg)', opacity: k.status === 'revoked' ? 0.55 : 1 }}>
                    <td data-label="" className="px-4 py-3">
                      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{k.name}</p>
                      <p className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{k.key_prefix}</p>
                    </td>
                    <td data-label="User" className="px-4 py-3 text-xs" style={{ color: 'var(--dim)' }}>{k.user_email || '—'}</td>
                    <td data-label="Plan" className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(37,99,235,0.12)', color: 'var(--blue-bright)' }}>{k.plan}</span>
                    </td>
                    <td data-label="Status" className="px-4 py-3 text-xs font-bold" style={{ color: k.status === 'active' ? 'var(--good)' : 'var(--bad)' }}>{k.status.toUpperCase()}</td>
                    <td data-label="Requests" className="px-4 py-3 text-xs" style={{ color: 'var(--dim)' }}>{k.request_count}</td>
                    <td data-label="Last Used" className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{fmtDate(k.last_used_at)}</td>
                    <td data-label="Actions" className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {k.status === 'active' ? (
                          <button disabled={busy} onClick={() => act(async () => {
                            const res = await fetch('/api/admin/api/keys', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: k.id, action: 'revoke' }),
                            });
                            const d = await res.json();
                            if (!res.ok) throw new Error(d.error || 'Failed');
                          }, 'Key revoked')}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold"
                            style={{ border: '1px solid rgba(248,113,113,0.3)', color: 'var(--bad)', cursor: 'pointer' }}>
                            Revoke
                          </button>
                        ) : (
                          <button disabled={busy} onClick={() => act(async () => {
                            const res = await fetch('/api/admin/api/keys', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: k.id, action: 'restore' }),
                            });
                            const d = await res.json();
                            if (!res.ok) throw new Error(d.error || 'Failed');
                          }, 'Key restored')}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold"
                            style={{ border: '1px solid rgba(74,222,128,0.3)', color: 'var(--good)', cursor: 'pointer' }}>
                            Restore
                          </button>
                        )}
                        <button disabled={busy} onClick={() => {
                          if (!confirm(`Delete key "${k.name}"?`)) return;
                          act(async () => {
                            const res = await fetch('/api/admin/api/keys', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: k.id, action: 'delete' }),
                            });
                            const d = await res.json();
                            if (!res.ok) throw new Error(d.error || 'Failed');
                          }, 'Key deleted');
                        }}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold"
                          style={{ border: '1px solid rgba(248,113,113,0.3)', color: 'var(--bad)', cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Endpoints' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-responsive">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--blue-deep)' }}>
                  {['Path', 'Category', 'Provider', 'Status', 'Toggle'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {endpoints.endpoints.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td data-label="" className="px-4 py-3">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-2" style={{ backgroundColor: 'var(--blue-deep)', color: 'var(--blue-soft)' }}>{e.method}</span>
                      <code className="text-xs font-mono" style={{ color: 'var(--ink-2)' }}>{e.path}</code>
                    </td>
                    <td data-label="Category" className="px-4 py-3 text-xs" style={{ color: 'var(--dim)' }}>{e.category}</td>
                    <td data-label="Provider" className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                      {(providers?.providers?.find(p => p.name === e.provider)?.display_name) || e.provider || '—'}
                    </td>
                    <td data-label="Status" className="px-4 py-3">
                      <span className="text-xs font-bold" style={{ color: e.is_active ? 'var(--good)' : 'var(--muted)' }}>
                        {e.is_active ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </td>
                    <td data-label="Toggle" className="px-4 py-3">
                      <button disabled={busy} onClick={() => act(async () => {
                        const res = await fetch('/api/admin/api/endpoints', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: e.id, is_active: !e.is_active }),
                        });
                        const d = await res.json();
                        if (!res.ok) throw new Error(d.error || 'Failed');
                      }, `${e.path} ${e.is_active ? 'disabled' : 'enabled'}`)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                          backgroundColor: e.is_active ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)',
                          color: e.is_active ? 'var(--bad)' : 'var(--good)',
                          border: `1px solid ${e.is_active ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`,
                          cursor: 'pointer',
                        }}>
                        {e.is_active ? 'DISABLE' : 'ENABLE'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Providers' && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-responsive">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--blue-deep)' }}>
                    {['Provider', 'Base URL', 'Status', 'Avg (ms)', 'Failures', 'Last OK', 'Last error', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(providers?.providers || []).map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                      <td data-label="" className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--ink)' }}>{p.display_name || p.name}</td>
                      <td data-label="Base URL" className="px-4 py-3 font-mono text-[10px] break-all" style={{ color: 'var(--muted)' }}>{p.base_url}</td>
                      <td data-label="Status" className="px-4 py-3">
                        <span className="text-xs font-bold" style={{ color: p.status === 'active' ? 'var(--good)' : 'var(--bad)' }}>{p.status.toUpperCase()}</span>
                      </td>
                      <td data-label="Avg (ms)" className="px-4 py-3 text-xs" style={{ color: 'var(--dim)' }}>{p.avg_response_ms !== null ? Number(p.avg_response_ms).toFixed(0) : '—'}</td>
                      <td data-label="Failures" className="px-4 py-3 text-xs" style={{ color: p.total_failures > 0 ? 'var(--bad)' : 'var(--dim)' }}>{p.total_failures}/{p.total_requests}</td>
                      <td data-label="Last OK" className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{p.last_success_at ? new Date(p.last_success_at).toLocaleString() : '—'}</td>
                      <td data-label="Last error" className="px-4 py-3 text-xs" style={{ color: p.last_error ? 'var(--warn)' : 'var(--muted)' }}>{p.last_error || '—'}</td>
                      <td data-label="Actions" className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button disabled={busy} onClick={() => act(async () => {
                            const res = await fetch('/api/admin/api/providers', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'check', id: p.id }),
                            });
                            const d = await res.json();
                            if (!res.ok) throw new Error(d.error || 'Check failed');
                            if (!d.ok) throw new Error(`Provider unreachable: ${d.error || 'no response'} (${d.ms}ms)`);
                          }, `Health check OK (${p.name})`)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold"
                            style={{ border: '1px solid rgba(37,99,235,0.3)', color: 'var(--blue-bright)', cursor: 'pointer' }}>
                            Check
                          </button>
                          <select defaultValue="" onChange={e => {
                            const st = e.target.value; if (!st) return;
                            act(async () => {
                              const res = await fetch('/api/admin/api/providers', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: p.id, status: st }),
                              });
                              const d = await res.json();
                              if (!res.ok) throw new Error(d.error || 'Update failed');
                            }, `Provider ${st}`);
                            e.target.value = '';
                          }}
                            className="px-2 py-1 rounded-md text-[11px] outline-none"
                            style={{ backgroundColor: 'rgba(2,4,9,0.45)', border: '1px solid var(--blue-deep)', color: 'var(--dim)' }}>
                            <option value="">Status…</option>
                            <option value="active">Active</option>
                            <option value="offline">Offline</option>
                            <option value="disabled">Disabled</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Health checks run automatically on every provider call; the Check button forces a live probe.
          </p>
        </div>
      )}

      {tab === 'Requests' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[['all', 'All'], ['failed', 'Failed'], ['provider', 'Provider failures']].map(([v, l]) => (
              <button key={v} onClick={() => { setReqFilter(v); setPage(1); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{
                  backgroundColor: reqFilter === v ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: reqFilter === v ? 'var(--blue-bright)' : 'var(--dim)',
                  border: `1px solid ${reqFilter === v ? 'rgba(37,99,235,0.4)' : 'var(--blue-deep)'}`,
                  cursor: 'pointer',
                }}>
                {l}
              </button>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-responsive">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--blue-deep)' }}>
                    {['Request', 'User', 'Key', 'Endpoint', 'Status', 'Time', 'Error', 'IP', 'When'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests?.requests?.length === 0 ? (
                    <tr><td colSpan={9} data-label="" className="px-3 py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>No requests found.</td></tr>
                  ) : (
                    requests?.requests?.map(r => (
                      <tr key={r.request_id} style={{ borderBottom: '1px solid var(--bg)' }}>
                        <td data-label="" className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>{r.request_id}</td>
                        <td data-label="User" className="px-3 py-2.5 text-xs" style={{ color: 'var(--dim)' }}>{r.user_email || '—'}</td>
                        <td data-label="Key" className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{r.key_name || '—'}</td>
                        <td data-label="Endpoint" className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--ink-2)' }}>{r.endpoint}</td>
                        <td data-label="Status" className="px-3 py-2.5 text-xs font-bold" style={{ color: r.status_code < 400 ? 'var(--good)' : 'var(--bad)' }}>{r.status_code}</td>
                        <td data-label="Time" className="px-3 py-2.5 text-xs" style={{ color: 'var(--dim)' }}>{r.response_time_ms}ms</td>
                        <td data-label="Error" className="px-3 py-2.5 text-xs" style={{ color: r.error_code ? 'var(--warn)' : 'var(--muted)' }}>{r.error_code || '—'}</td>
                        <td data-label="IP" className="px-3 py-2.5 font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{r.ip || '—'}</td>
                        <td data-label="When" className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{fmtDate(r.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {requests && requests.meta.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                Page {requests.meta.page} of {requests.meta.total_pages} · {requests.meta.total} requests
              </span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ border: '1px solid var(--blue-deep)', color: page <= 1 ? 'var(--muted)' : 'var(--dim)', cursor: 'pointer' }}>← Prev</button>
                <button disabled={page >= (requests.meta.total_pages || 1)} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ border: '1px solid var(--blue-deep)', color: page >= (requests.meta.total_pages || 1) ? 'var(--muted)' : 'var(--dim)', cursor: 'pointer' }}>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Rate Limits' && (
        <div className="max-w-xl space-y-3">
          {['rate_limit.FREE', 'rate_limit.PREMIUM', 'rate_limit.BUSINESS', 'rate_limit.ADMIN'].map(k => (
            <div key={k} className="card p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold font-mono" style={{ color: 'var(--ink)' }}>{k}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  Current: {settings[k]?.value ?? '—'} requests/day {settings[k]?.value === '-1' ? '(unlimited)' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  key={k + settings[k]?.value}
                  id={`input-${k}`}
                  type="number"
                  defaultValue={settings[k]?.value ?? ''}
                  placeholder="requests/day"
                  className="w-36 px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: 'rgba(2,4,9,0.45)', border: '1px solid var(--blue-deep)', color: 'var(--ink)' }}
                />
                <button disabled={busy} onClick={() => {
                  const el = document.getElementById(`input-${k}`);
                  updateSetting(k, el.value);
                }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,var(--blue-deep),var(--blue-deep))', cursor: 'pointer' }}>
                  Save
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Use -1 for unlimited. Changes apply immediately to new requests.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ApiAdminPage() {
  return (
    <ToastProvider>
      <AdminInner />
    </ToastProvider>
  );
}
