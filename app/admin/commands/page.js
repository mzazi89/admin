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
      setNotice('Saved — the bot will use this in ~15 seconds.');
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
      setNotice('Deleted — the bot will stop using it in ~15 seconds.');
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
      setNotice(cmd.enabled ? 'Disabled — takes effect in ~15 seconds.' : 'Enabled — takes effect in ~15 seconds.');
      setTimeout(() => setNotice(''), 4000);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow mb-4">Bot registry</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Bot commands</h1>
        <p className="lede mt-3" style={{ maxWidth: 600, fontSize: '0.92rem' }}>
          {commands.length} commands hosted on mzazi.shop — saves go live on the bot within ~15 seconds.
        </p>
      </div>

      {notice && (
        <div className="tag tag-green mb-5" style={{ padding: '10px 14px', textTransform: 'none', letterSpacing: '0.02em', width: '100%' }}>
          {notice}
        </div>
      )}

      {error && (
        <div className="tag tag-red mb-5" style={{ padding: '10px 14px', textTransform: 'none', letterSpacing: '0.02em', width: '100%' }}>
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input placeholder="Search commands" value={q} onChange={(e) => setQ(e.target.value)} className="input mono" style={{ maxWidth: 260, fontSize: 13 }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" style={{ maxWidth: 180, width: 'auto', fontSize: 13 }}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button onClick={openAdd} className="btn btn-primary" style={{ marginLeft: 'auto' }}>Add command</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="scroll-x table-responsive">
          <table className="table-plain" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Command</th>
                <th>Category</th>
                <th>Description</th>
                <th>Flags</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: '48px 0', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
              )}
              {!loading && commands.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '48px 0', textAlign: 'center', color: '#4C535B' }}>No commands found. Add your first command.</td></tr>
              )}
              {commands.map((cmd) => (
                <tr key={cmd.id}>
                  <td data-label="Command">
                    <div className="mono" style={{ color: '#E9E7E2', fontWeight: 600 }}>.{cmd.name}</div>
                    {cmd.aliases.length > 0 && (
                      <div className="mono" style={{ color: '#4C535B', fontSize: 11, marginTop: 2 }}>aliases: {cmd.aliases.join(', ')}</div>
                    )}
                  </td>
                  <td data-label="Category" style={{ color: '#AEB5BD' }}>{cmd.category}</td>
                  <td data-label="Description" style={{ color: '#AEB5BD', maxWidth: 300, fontSize: 13 }}>{cmd.description}</td>
                  <td data-label="Flags">
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {cmd.ownerOnly && <span className="tag tag-red">Owner</span>}
                      {cmd.adminOnly && <span className="tag tag-amber">Admin</span>}
                      {cmd.groupOnly && <span className="tag">Group</span>}
                    </div>
                  </td>
                  <td data-label="Status">
                    <button onClick={() => toggle(cmd)} className="btn" style={{ fontSize: 10, padding: '5px 10px', borderColor: 'transparent', background: 'transparent', cursor: 'pointer' }}>
                      <span className={`tag ${cmd.enabled ? 'tag-green' : ''}`}>
                        <span className="dot" style={{ color: cmd.enabled ? '#3ECF8E' : '#4C535B', marginRight: 2 }} />
                        {cmd.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </button>
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(cmd)} className="btn btn-dark" style={{ fontSize: 10, padding: '6px 12px', marginRight: 6 }}>Edit</button>
                    <button onClick={() => del(cmd.name)} className="btn btn-danger" style={{ fontSize: 10, padding: '6px 12px' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#14181D', border: '1px solid #262C33', borderRadius: 6, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 26 }}>
            <div className="eyebrow mb-3">{modal.mode === 'add' ? 'New command' : 'Edit command'}</div>
            <h2 className="section-title mb-5" style={{ fontSize: '1.3rem' }}>
              {modal.mode === 'add' ? 'Add command' : `Edit .${modal.name}`}
            </h2>

            <div className="grid-2-responsive mb-4">
              <div>
                <label className="label">Name (a-z, 0-9, _ -)</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input mono" disabled={modal.mode === 'edit'} placeholder="mycommand" />
              </div>
              <div>
                <label className="label">Aliases (comma separated)</label>
                <input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} className="input" placeholder="mc, cmd" />
              </div>
              <div>
                <label className="label">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Usage hint</label>
                <input value={form.usage} onChange={(e) => setForm({ ...form, usage: e.target.value })} className="input mono" placeholder=".mycommand [arg]" />
              </div>
            </div>

            <label className="label">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" style={{ marginBottom: 16 }} placeholder="What this command does" />

            <div style={{ display: 'flex', gap: 18, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                ['ownerOnly', 'Owner only'],
                ['adminOnly', 'Admin only'],
                ['groupOnly', 'Groups only'],
                ['enabled', 'Enabled'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2" style={{ color: '#AEB5BD', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} style={{ accentColor: '#F2A93B' }} />
                  {label}
                </label>
              ))}
            </div>

            <label className="label">
              Handler code {modal.mode === 'edit' && <span style={{ color: '#4C535B' }}>— the command's current code is loaded, edit as needed</span>}
            </label>
            <textarea
              value={modal.loadingCode ? 'Loading current code…' : form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              rows={10}
              placeholder={modal.mode === 'edit' ? '// loading…' : "await mzazireply('Hello from the website!');"}
              readOnly={!!modal.loadingCode}
              className="input mono"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5, marginBottom: 18, resize: 'vertical', lineHeight: 1.6 }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} className="btn btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save command'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
