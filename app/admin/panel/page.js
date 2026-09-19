'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Admin: manage Pterodactyl panel users + servers.
// Delete flow: pick a user → their servers are listed with checkboxes →
// select which to delete → "Delete selected servers & user" removes the
// servers first, then the user (Pterodactyl refuses to delete a user who
// still has servers).
//
// More than one panel can be configured (Settings → Pterodactyl panels). The
// chosen panel is threaded through every request as panel_id, so a user is always
// listed, and deleted, on the panel the admin was actually looking at. With no
// panels configured the server falls back to the legacy Settings pair, which is
// why panel_id is simply omitted in that case rather than invented.
export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [serversByUser, setServersByUser] = useState({});
  const [selectedByUser, setSelectedByUser] = useState({});
  const [openUser, setOpenUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [panels, setPanels] = useState([]);
  const [panelId, setPanelId] = useState('');
  const [activePanel, setActivePanel] = useState(null);
  const router = useRouter();

  // Appended to every request. Empty when nothing is selected — which the server
  // reads as "the default panel".
  const panelQuery = () => (panelId ? `&panel_id=${encodeURIComponent(panelId)}` : '');

  const load = (forPanel = panelId) => {
    const q = forPanel ? `&panel_id=${encodeURIComponent(forPanel)}` : '';
    setLoading(true);
    fetch(`/api/admin/panel?action=users${q}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setNotice(d.error || 'Failed to load users');
        setUsers([]);
        setLoading(false);
        return;
      }
      setUsers(d.users || []);
      if (d.panel) setActivePanel(d.panel);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetch('/api/admin/me').then(async (r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      // The panel list first: which panel to show is decided before any user is
      // fetched, otherwise the first request would always be against the default.
      let initial = '';
      try {
        const res = await fetch('/api/admin/pterodactyl/panels');
        const d = await res.json().catch(() => ({}));
        if (res.ok) {
          const list = d.panels || [];
          setPanels(list);
          const def = list.find((p) => p.is_default) || list[0];
          initial = def ? String(def.id) : '';
          setPanelId(initial);
        }
      } catch {}
      load(initial);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchPanel = (value) => {
    setPanelId(value);
    // Everything on screen belonged to the other panel.
    setUsers([]);
    setServersByUser({});
    setSelectedByUser({});
    setOpenUser(null);
    setNotice('');
    setActivePanel(null);
    load(value);
  };

  const loadServers = async (userId) => {
    if (serversByUser[userId]) return serversByUser[userId];
    setBusy(`s:${userId}`);
    setNotice('');
    const res = await fetch(`/api/admin/panel?action=servers&user_id=${userId}${panelQuery()}`);
    const d = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setNotice(d.error || 'Failed to load servers'); return []; }
    const servers = d.servers || [];
    setServersByUser((prev) => ({ ...prev, [userId]: servers }));
    setSelectedByUser((prev) => ({ ...prev, [userId]: new Set(servers.map((s) => s.id)) }));
    return servers;
  };

  const toggleUser = async (user) => {
    if (openUser === user.id) { setOpenUser(null); return; }
    setOpenUser(user.id);
    await loadServers(user.id);
  };

  const toggleServer = (userId, serverId) => {
    setSelectedByUser((prev) => {
      const set = new Set(prev[userId] || []);
      if (set.has(serverId)) set.delete(serverId);
      else set.add(serverId);
      return { ...prev, [userId]: set };
    });
  };

  const apiDelete = async (payload, successMsg) => {
    setBusy('del');
    setNotice('');
    // The panel travels with the delete. Without it the server would act on the
    // default panel, which with several configured could be a different host than
    // the one whose users are on screen. When no panels are configured there is
    // nothing to send — the legacy Settings pair is the only panel there is.
    const body = panelId ? { ...payload, panel_id: panelId } : payload;
    const res = await fetch('/api/admin/panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setNotice(d.error || 'Delete failed'); return false; }
    const failed = d.failedServers || [];
    setNotice(`${successMsg}${failed.length ? ` (${failed.length} server delete(s) failed: ${failed.map((f) => f.error).join('; ')})` : ''}`);
    return true;
  };

  const deleteUser = async (user) => {
    let servers = serversByUser[user.id];
    if (!servers) {
      setOpenUser(user.id);
      servers = await loadServers(user.id);
    }
    if (!servers.length) {
      if (!window.confirm(`Delete Pterodactyl user "${user.username}"? They have no servers.`)) return;
      const ok = await apiDelete({ action: 'delete', user_id: user.id, server_ids: [], delete_user: true }, `✅ User ${user.username} deleted.`);
      if (ok) { setUsers((prev) => prev.filter((u) => u.id !== user.id)); setOpenUser(null); }
      return;
    }
    const ids = [...(selectedByUser[user.id] || [])];
    if (!ids.length) {
      if (!window.confirm(`No servers selected for "${user.username}". Delete the user anyway? (Pterodactyl will refuse if they still have servers.)`)) return;
    } else {
      if (!window.confirm(`Delete ${ids.length} server(s) for "${user.username}", then delete the user?`)) return;
    }
    const ok = await apiDelete({ action: 'delete', user_id: user.id, server_ids: ids, delete_user: true }, `✅ Deleted ${ids.length} server(s) and user ${user.username}.`);
    if (ok) { setUsers((prev) => prev.filter((u) => u.id !== user.id)); setOpenUser(null); }
  };

  const deleteServer = async (userId, server) => {
    if (!window.confirm(`Delete server "${server.name}"?`)) return;
    const ok = await apiDelete({ action: 'delete', user_id: userId, server_ids: [server.id], delete_user: false }, `✅ Server "${server.name}" deleted.`);
    if (ok) {
      setServersByUser((prev) => ({ ...prev, [userId]: (prev[userId] || []).filter((s) => s.id !== server.id) }));
    }
  };

  const fmtLimit = (limits, key) => {
    if (!limits) return '—';
    const v = parseInt(limits[key], 10);
    if (v === 0) return '∞';
    if (key === 'memory') return v >= 1024 ? `${v / 1024}GB` : `${v}MB`;
    if (key === 'disk') return v >= 1024 ? `${v / 1024}GB` : `${v}MB`;
    return `${v}%`;
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="mb-8">
        <div className="eyebrow mb-4">Pterodactyl</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Manage panel</h1>
        <p className="lede mt-3" style={{ maxWidth: 620, fontSize: '0.92rem' }}>
          Panel users and their servers. Deleting a user lists their servers first — select which to delete, then confirm. Servers are removed before the user (the panel blocks deleting a user who still has servers).
        </p>
      </div>

      {panels.length > 1 && (
        <div className="card card-pad mb-6" style={{ padding: '16px 18px' }}>
          <label className="label" htmlFor="panel-picker" style={{ display: 'block', marginBottom: 6 }}>
            Panel
          </label>
          <select
            id="panel-picker"
            className="input"
            value={panelId}
            onChange={(e) => switchPanel(e.target.value)}
            disabled={busy === 'del'}
          >
            {panels.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}{p.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>
            You are managing the users of this panel only. Switch here to reach another.
          </p>
        </div>
      )}

      {panels.length === 0 && (
        <div className="tag mb-6" style={{ padding: '10px 14px', width: '100%', textTransform: 'none', letterSpacing: '0.02em', color: 'var(--muted)' }}>
          Using the panel from <a href="/admin/settings" style={{ color: 'var(--brand)' }}>Settings</a>.
          To manage more than one panel from here, add them under Settings → Pterodactyl panels.
        </div>
      )}

      {panels.length === 1 && activePanel && (
        <div className="mono mb-6" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Panel: {activePanel.name}{activePanel.url ? ` · ${activePanel.url}` : ''}
        </div>
      )}

      {notice && (
        <div className="tag mb-6" style={{
          padding: '10px 14px', width: '100%', textTransform: 'none', letterSpacing: '0.02em',
          backgroundColor: notice.startsWith('✅') ? 'rgba(62,207,142,0.06)' : 'rgba(229,72,77,0.06)',
          borderColor: notice.startsWith('✅') ? 'rgba(62,207,142,0.35)' : 'rgba(229,72,77,0.35)',
          color: notice.startsWith('✅') ? 'var(--good)' : 'var(--bad)',
        }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <div className="card card-pad" style={{ padding: '26px', textAlign: 'center', color: 'var(--muted)' }}>
          No panel users found{activePanel?.name ? ` on ${activePanel.name}` : ''}. (Add a panel, or check its URL and API key, under <a href="/admin/settings" style={{ color: 'var(--brand)' }}>Settings</a>.)
        </div>
      ) : (
        <div className="card card-pad" style={{ padding: '22px' }}>
          <div className="flex justify-between items-center mb-4">
            <span className="mono" style={{ fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {users.length} user{users.length === 1 ? '' : 's'}
            </span>
            <button onClick={load} disabled={busy === 'del'} className="btn" style={{ fontSize: 12.5, padding: '6px 12px' }}>🔄 Refresh</button>
          </div>

          <div className="space-y-3">
            {users.map((u) => {
              const servers = serversByUser[u.id] || [];
              const isOpen = openUser === u.id;
              const selected = selectedByUser[u.id] || new Set();
              const allSelected = servers.length > 0 && servers.every((s) => selected.has(s.id));
              return (
                <div key={u.id} className="tag" style={{ display: 'block', width: '100%', padding: 0, borderRadius: 12, borderColor: isOpen ? 'rgba(245,166,35,0.45)' : 'var(--line-soft)', overflow: 'hidden' }}>
                  {/* user row */}
                  <div className="flex justify-between items-center" style={{ padding: '14px 16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                        {u.username}
                        {u.root_admin && <span className="tag" style={{ marginLeft: 8, fontSize: 12, padding: '1px 6px', color: 'var(--brand)' }}>ADMIN</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.first_name || ''} {u.last_name || ''} · {u.email}
                      </div>
                    </div>
                    <div className="flex" style={{ gap: 8, flexShrink: 0 }}>
                      <button onClick={() => toggleUser(u)} disabled={busy === `s:${u.id}`} className="btn" style={{ fontSize: 12, padding: '6px 10px' }}>
                        {busy === `s:${u.id}` ? '…' : isOpen ? '▴ Servers' : `▾ Servers${servers.length ? ` (${servers.length})` : ''}`}
                      </button>
                      <button onClick={() => deleteUser(u)} disabled={busy === 'del'} className="btn btn-danger" style={{ fontSize: 12, padding: '6px 10px' }}>
                        Delete user
                      </button>
                    </div>
                  </div>

                  {/* servers of this user */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--line-soft)', padding: '12px 16px' }}>
                      {servers.length === 0 ? (
                        <div className="mono" style={{ fontSize: 12.5, color: 'var(--muted)', padding: '6px 0' }}>No servers on this user.</div>
                      ) : (
                        <div className="space-y-2">
                          {servers.map((s) => (
                            <div key={s.id} className="flex justify-between items-center" style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                              <label className="flex items-center" style={{ gap: 10, minWidth: 0, cursor: 'pointer', margin: 0 }}>
                                <input
                                  type="checkbox"
                                  checked={selected.has(s.id)}
                                  onChange={() => toggleServer(u.id, s.id)}
                                  style={{ accentColor: 'var(--brand)' }}
                                />
                                <span style={{ minWidth: 0 }}>
                                  <span className="mono" style={{ fontSize: 13, color: 'var(--ink)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {s.name}
                                  </span>
                                  <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                                    #{s.id}{s.node ? ` · node: ${s.node}` : ''} · {fmtLimit(s.limits, 'cpu')} CPU · {fmtLimit(s.limits, 'memory')} RAM · {fmtLimit(s.limits, 'disk')} disk
                                  </span>
                                </span>
                              </label>
                              <button onClick={() => deleteServer(u.id, s)} disabled={busy === 'del'} className="btn btn-danger" style={{ fontSize: 12, padding: '4px 8px', flexShrink: 0 }}>
                                Delete
                              </button>
                            </div>
                          ))}

                          <div className="flex justify-between items-center" style={{ paddingTop: 8 }}>
                            <button
                              onClick={() => setSelectedByUser((prev) => ({ ...prev, [u.id]: allSelected ? new Set() : new Set(servers.map((s) => s.id)) }))}
                              className="btn"
                              style={{ fontSize: 12, padding: '6px 10px' }}
                            >
                              {allSelected ? 'Unselect all' : 'Select all'}
                            </button>
                            <button
                              onClick={() => deleteUser(u)}
                              disabled={busy === 'del'}
                              className="btn btn-danger"
                              style={{ fontSize: 12, padding: '6px 12px' }}
                            >
                              🗑 Delete selected servers & user
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
