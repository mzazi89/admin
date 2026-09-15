'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, Input,
  Modal, PageHeader, SearchInput, Select, Skeleton, StatusIndicator, Textarea, Toggle,
  humaniseError, useToast,
  Icons,
} from '@/components/ui';

const EMPTY = {
  name: '', aliases: '', description: '', category: 'General', usage: '',
  ownerOnly: false, adminOnly: false, groupOnly: false, enabled: true, code: '',
};

// Commands the bot handles in its own code before the remote registry. Edits
// here are saved to the DB but do NOT change the running bot.
const ENGINE_LOCKED = new Set(['buy', 'pay', 'payment', 'plan', 'plans', 'subscription', 'pair', 'connect', 'mzazibot', 'verify']);
const ENGINE_TIP = 'Engine command — handled in bot code. Edits here are saved to the DB but do NOT change the bot.';

export default function CommandsPage() {
  const toast = useToast();

  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState(null); // null | { mode, name?, loadingCode? }
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingTo, setSyncingTo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmKind, setConfirmKind] = useState(null); // 'sync' | 'syncToSeed'
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category && category !== 'all') params.set('category', category);
      const res = await fetch(`/api/admin/bot-commands?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load commands');
      setCommands(data.commands || []);
      setError('');
    } catch (e) {
      setError(humaniseError(e, 'We could not load commands right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const categories = [...new Set(commands.map((c) => c.category))].sort();

  const openAdd = () => { setForm(EMPTY); setModal({ mode: 'add' }); };

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
      const data = await res.json().catch(() => ({}));
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
    } catch { /* leave the metadata form usable even if the code load failed */ }
    setModal((m) => (m ? { ...m, loadingCode: false } : m));
  };

  const payload = () => ({
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
  });

  const save = async () => {
    setSaving(true);
    try {
      const isEdit = modal.mode === 'edit';
      const res = await fetch(
        isEdit ? `/api/admin/bot-commands/${encodeURIComponent(modal.name)}` : '/api/admin/bot-commands',
        { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save command');
      setModal(null);
      toast.success('Saved — the bot will use this within ~15 seconds.');
      load();
    } catch (e) {
      toast.error(humaniseError(e, 'We could not save this command. Please try again.'));
    } finally {
      setSaving(false);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to toggle');
      toast.success(cmd.enabled ? 'Disabled — takes effect in ~15 seconds.' : 'Enabled — takes effect in ~15 seconds.');
      load();
    } catch (e) {
      toast.error(humaniseError(e, 'We could not change this command. Please try again.'));
    }
  };

  const del = async (name) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/bot-commands/${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success('Deleted — the bot will stop using it in ~15 seconds.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(humaniseError(e, 'We could not delete this command. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const syncFromSeed = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/bot-commands/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Sync failed.');
      toast.success(`Synced ${data.synced} commands from seed${data.failed ? ` (${data.failed} failed)` : ''}.`);
      setConfirmKind(null);
      load();
    } catch (e) {
      toast.error(humaniseError(e, 'The sync failed. Please try again.'));
    } finally {
      setSyncing(false);
    }
  };

  const syncToSeed = async () => {
    setSyncingTo(true);
    try {
      const res = await fetch('/api/admin/bot-commands/sync-to-seed', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Sync to seed failed.');
      toast.success(data.target === 'github'
        ? `Exported ${data.written} commands — committed to GitHub.`
        : `Exported ${data.written} commands to the seed file. Commit it to git.`);
      setConfirmKind(null);
    } catch (e) {
      toast.error(humaniseError(e, 'The sync to seed failed. Please try again.'));
    } finally {
      setSyncingTo(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader
        title="Commands"
        description={`${commands.length} commands hosted on the site — saves go live on the bot within ~15 seconds.`}
        icon={<Icons.Command size={20} />}
        actions={
          <>
            <Button variant="ghost" size="sm" icon={<Icons.Refresh size={15} />} onClick={() => setConfirmKind('sync')}>Sync from seed</Button>
            <Button variant="ghost" size="sm" icon={<Icons.Upload size={15} />} onClick={() => setConfirmKind('syncToSeed')}>Sync to seed</Button>
            <Button variant="primary" size="sm" icon={<Icons.Plus size={15} />} onClick={openAdd}>Add command</Button>
          </>
        }
      />

      <Card style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
          <SearchInput id="cmd-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search commands" />
          <Field id="cmd-category" label="" className="!mb-0">
            <Select id="cmd-category" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      {error ? (
        <Card><ErrorState title="Could not load commands" message={error} onRetry={load} /></Card>
      ) : loading ? (
        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={40} />)}
        </Card>
      ) : commands.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icons.Command size={26} />}
            title="No commands found"
            description="Add your first command, or clear the filters."
            action={<Button variant="primary" size="sm" icon={<Icons.Plus size={15} />} onClick={openAdd}>Add command</Button>}
          />
        </Card>
      ) : (
        <Card style={{ padding: 0 }} className="anim-fade-up">
          <DataTable columns={['Command', 'Description', 'Bot', 'Status', 'Actions']}>
            {commands.map((cmd) => (
              <tr key={cmd.id}>
                <td data-label="Command">
                  <div className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>.{cmd.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                    {cmd.category}{cmd.aliases.length ? ` · ${cmd.aliases.join(', ')}` : ''}
                    {ENGINE_LOCKED.has(cmd.name) && <span title={ENGINE_TIP} style={{ color: 'var(--blue)' }}> · engine</span>}
                  </div>
                </td>
                <td data-label="Description" style={{ color: 'var(--ink-2)', fontSize: 13.5, maxWidth: 340 }}>{cmd.description || '—'}</td>
                <td data-label="Bot" style={{ color: 'var(--muted)', fontSize: 13.5 }}>All bots</td>
                <td data-label="Status">
                  <button
                    type="button"
                    onClick={() => toggle(cmd)}
                    aria-label={`${cmd.enabled ? 'Disable' : 'Enable'} ${cmd.name}`}
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  >
                    <StatusIndicator
                      status={cmd.enabled ? 'good' : 'offline'}
                      label={cmd.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </button>
                </td>
                <td data-label="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button variant="dark" size="sm" icon={<Icons.Pencil size={14} />} onClick={() => openEdit(cmd)}>Edit</Button>
                    <Button variant="ghost" size="sm" icon={<Icons.Trash size={14} />} onClick={() => setDeleteTarget(cmd)} style={{ color: 'var(--bad)' }}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? `Edit .${modal.name}` : 'Add command'}
        description="Handler code is JavaScript run by the bot. Saves reach the bot within ~15 seconds."
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>Save command</Button>
          </>
        }
      >
        {modal && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Name (a-z, 0-9, _ -)" id="cmd-name">
                <Input id="cmd-name" className="mono" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={modal.mode === 'edit'} placeholder="mycommand" />
              </Field>
              <Field label="Aliases (comma separated)" id="cmd-aliases">
                <Input id="cmd-aliases" value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="mc, cmd" />
              </Field>
              <Field label="Category" id="cmd-cat">
                <Input id="cmd-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </Field>
              <Field label="Usage hint" id="cmd-usage">
                <Input id="cmd-usage" className="mono" value={form.usage} onChange={(e) => setForm({ ...form, usage: e.target.value })} placeholder=".mycommand [arg]" />
              </Field>
            </div>

            <Field label="Description" id="cmd-desc">
              <Input id="cmd-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this command does" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 4, margin: '4px 0 10px' }}>
              <Toggle id="cmd-owner" checked={form.ownerOnly} onChange={(v) => setForm({ ...form, ownerOnly: v })} label="Owner only" />
              <Toggle id="cmd-admin" checked={form.adminOnly} onChange={(v) => setForm({ ...form, adminOnly: v })} label="Admin only" />
              <Toggle id="cmd-group" checked={form.groupOnly} onChange={(v) => setForm({ ...form, groupOnly: v })} label="Groups only" />
              <Toggle id="cmd-enabled" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Enabled" />
            </div>

            <Field label="Handler code" id="cmd-code" hint={modal.mode === 'edit' ? 'The current code is loaded — edit as needed.' : undefined}>
              <Textarea
                id="cmd-code"
                className="mono"
                value={modal.loadingCode ? 'Loading current code…' : form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                rows={10}
                readOnly={!!modal.loadingCode}
                placeholder="await mzazireply('Hello from the website!');"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.6 }}
              />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => del(deleteTarget.name)}
        loading={busy}
        title={`Delete .${deleteTarget?.name}?`}
        description="The bot stops responding to this command within ~15 seconds. This cannot be undone."
        confirmLabel="Delete command"
      />

      <ConfirmDialog
        open={confirmKind === 'sync'}
        onClose={() => setConfirmKind(null)}
        onConfirm={syncFromSeed}
        loading={syncing}
        tone="default"
        title="Sync all commands from the seed file?"
        description="This overwrites every command row with the shipped version, including any manual edits made here."
        confirmLabel="Sync from seed"
      />

      <ConfirmDialog
        open={confirmKind === 'syncToSeed'}
        onClose={() => setConfirmKind(null)}
        onConfirm={syncToSeed}
        loading={syncingTo}
        tone="default"
        title="Sync all commands to the seed file?"
        description="This overwrites the shipped seed with the current live database state, including your manual edits."
        confirmLabel="Sync to seed"
      />
    </div>
  );
}
