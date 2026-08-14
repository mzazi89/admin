'use client';
import { useState, useEffect, useCallback } from 'react';

const EMPTY = {
  name: '',
  aliases: '',
  description: '',
  category: 'General',
  usage: '',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  enabled: true,
  code: '',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  background: '#02040a',
  color: '#e2e8f0',
  border: '1px solid #1e3a8a',
  fontSize: '14px',
  outline: 'none',
};
const btnPrimary = {
  background: 'linear-gradient(135deg,#f87171,#dc2626)',
  color: '#fff',
  border: 'none',
  padding: '10px 18px',
  borderRadius: '10px',
  fontWeight: 600,
  cursor: 'pointer',
};
const btnGhost = {
  background: 'rgba(30,32,48,0.5)',
  color: '#94a3b8',
  border: '1px solid #1e3a8a',
  padding: '8px 14px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '13px',
};

export default function CommandsPage() {
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', cmd }
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category && category !== 'all') params.set('category', category);
      const res = await fetch(`/api/admin/bot-commands?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCommands(data.commands || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const categories = [...new Set(commands.map((c) => c.category))].sort();

  const openAdd = () => {
    setForm(EMPTY);
    setModal({ mode: 'add' });
  };
  const openEdit = async (cmd) => {
    setForm({
      name: cmd.name,
      aliases: (cmd.aliases || []).join(', '),
      description: cmd.description || '',
      category: cmd.category || 'General',
      usage: cmd.usage || '',
      ownerOnly: cmd.ownerOnly,
      adminOnly: cmd.adminOnly,
      groupOnly: cmd.groupOnly,
      enabled: cmd.enabled,
      code: '',
    });
    setModal({ mode: 'edit', name: cmd.name, loadingCode: true });
    try {
      const res = await fetch(`/api/admin/bot-commands/${encodeURIComponent(cmd.name)}`);
      const data = await res.json();
      if (res.ok && data.command) {
        setForm((f) => ({
          ...f,
          aliases: (data.command.aliases || []).join(', '),
          description: data.command.description || '',
          category: data.command.category || 'General',
          usage: data.command.usage || '',
          ownerOnly: data.command.ownerOnly,
          adminOnly: data.command.adminOnly,
          groupOnly: data.command.groupOnly,
          enabled: data.command.enabled !== false,
          code: data.command.code || '',
        }));
      }
    } catch {}
    setModal((m) => ({ ...m, loadingCode: false }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        aliases: form.aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
        description: form.description.trim(),
        category: form.category.trim() || 'General',
        usage: form.usage.trim(),
        ownerOnly: form.ownerOnly,
        adminOnly: form.adminOnly,
        groupOnly: form.groupOnly,
        enabled: form.enabled,
        code: form.code,
      };
      if (modal.mode === 'add') {
        const res = await fetch('/api/admin/bot-commands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create');
      } else {
        const res = await fetch(`/api/admin/bot-commands/${encodeURIComponent(modal.name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update');
      }
      setModal(null);
      setNotice('✅ Saved — the bot will use this in ~15 seconds.');
      setTimeout(() => setNotice(''), 4000);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (name) => {
    if (!window.confirm(`Delete command "${name}"? The bot will stop responding to it within ~15 seconds.`)) return;
    try {
      const res = await fetch(`/api/admin/bot-commands/${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setNotice('✅ Deleted — the bot will stop using it in ~15 seconds.');
      setTimeout(() => setNotice(''), 4000);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggle = async (cmd) => {
    try {
      const res = await fetch(`/api/admin/bot-commands/${encodeURIComponent(cmd.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cmd.name,
          aliases: cmd.aliases || [],
          description: cmd.description || '',
          category: cmd.category || 'General',
          usage: cmd.usage || '',
          ownerOnly: cmd.ownerOnly,
          adminOnly: cmd.adminOnly,
          groupOnly: cmd.groupOnly,
          enabled: !cmd.enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle');
      setNotice(cmd.enabled ? '✅ Disabled — takes effect in ~15 seconds.' : '✅ Enabled — takes effect in ~15 seconds.');
      setTimeout(() => setNotice(''), 4000);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const page = (
    <div className="page-pad" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>🤖 Bot Commands</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        {commands.length} commands hosted on mzazi.shop — saves go live on the bot within ~15 seconds.
      </p>

      {notice && (
        <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {notice}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)', color: '#f87171', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Search commands…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, maxWidth: 180, width: 'auto' }}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button onClick={openAdd} style={{ ...btnPrimary, marginLeft: 'auto' }}>+ Add Command</button>
      </div>

      <div style={{ background: 'rgba(30,32,48,0.5)', border: '1px solid #1e3a8a', borderRadius: 16, overflow: 'hidden' }}>
        <div className="scroll-x">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 720 }}>
          <thead>
            <tr style={{ background: '#02040a', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Command</th>
              <th style={{ padding: '12px 16px' }}>Category</th>
              <th style={{ padding: '12px 16px' }}>Description</th>
              <th style={{ padding: '12px 16px' }}>Flags</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading…</td></tr>
            )}
            {!loading && commands.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No commands found. Add your first command.</td></tr>
            )}
            {commands.map((cmd) => (
              <tr key={cmd.id} style={{ borderTop: '1px solid #1e3a8a' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600 }}>.{cmd.name}</div>
                  {cmd.aliases.length > 0 && (
                    <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>aliases: {cmd.aliases.join(', ')}</div>
                  )}
                </td>
                <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{cmd.category}</td>
                <td style={{ padding: '12px 16px', color: '#94a3b8', maxWidth: 300 }}>{cmd.description}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {cmd.ownerOnly && <span style={{ background: 'rgba(220,38,38,0.15)', color: '#f87171', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>OWNER</span>}
                    {cmd.adminOnly && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>ADMIN</span>}
                    {cmd.groupOnly && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>GROUP</span>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => toggle(cmd)} style={{ ...btnGhost, padding: '4px 10px' }}>
                    <span style={{ color: cmd.enabled ? '#4ade80' : '#64748b', fontWeight: 700 }}>{cmd.enabled ? '● ENABLED' : '○ DISABLED'}</span>
                  </button>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(cmd)} style={btnGhost}>Edit</button>{' '}
                  <button onClick={() => del(cmd.name)} style={{ ...btnGhost, color: '#f87171' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#02040a', border: '1px solid #1e3a8a', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {modal.mode === 'add' ? '➕ Add Command' : `✏️ Edit .${modal.name}`}
            </h2>

            <div className="grid-2-responsive" style={{ marginBottom: 12 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4, display: 'block' }}>Name (a-z, 0-9, _ -)</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} disabled={modal.mode === 'edit'} placeholder="mycommand" />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4, display: 'block' }}>Aliases (comma separated)</label>
                <input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} style={inputStyle} placeholder="mc, cmd" />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4, display: 'block' }}>Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4, display: 'block' }}>Usage hint</label>
                <input value={form.usage} onChange={(e) => setForm({ ...form, usage: e.target.value })} style={inputStyle} placeholder=".mycommand [arg]" />
              </div>
            </div>

            <label style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4, display: 'block' }}>Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }} placeholder="What this command does" />

            <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                ['ownerOnly', 'Owner only'],
                ['adminOnly', 'Admin only'],
                ['groupOnly', 'Groups only'],
                ['enabled', 'Enabled'],
              ].map(([key, label]) => (
                <label key={key} style={{ color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>

            <label style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4, display: 'block' }}>
              Handler code {modal.mode === 'edit' && <span style={{ color: '#475569' }}>— the command's current code is loaded, edit as needed</span>}
            </label>
            <textarea
              value={modal.loadingCode ? 'Loading current code…' : form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              rows={10}
              placeholder={modal.mode === 'edit' ? '// loading…' : "await mzazireply('Hello from the website! 🎉');"}
              readOnly={!!modal.loadingCode}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13, marginBottom: 16, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={btnGhost}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Command'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return page;
}
