'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtKes } from '@/lib/currency';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal,
  PageHeader, Textarea, Toggle, humaniseError, useToast, Icons,
} from '@/components/ui';

const EMPTY = { name: '', variant: 'normal', version: '', description: '', price: '', downloadUrl: '', active: true };

// MZAZI ADMIN — bot files.
//
// Upload the artefact once; the website's catalogue reads this table, so
// publishing here is the whole release process. Bytes are stored base64 in
// Postgres (Vercel's filesystem is read-only at runtime).
export default function AdminBotFiles() {
  const toast = useToast();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // the file being edited, or null
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('upload'); // 'upload' | 'link'
  const [payload, setPayload] = useState(null); // { name, mime, content, size }
  const [target, setTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/bot-files');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load bot files');
      setFiles(d.files || []);
    } catch (e) {
      setError(humaniseError(e, 'We could not load bot files right now.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pickFile = async (file) => {
    if (!file) { setPayload(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('That file is over 5 MB — host it and use the link instead.');
      setPayload(null);
      return;
    }
    const buf = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    setFormError('');
    setPayload({ name: file.name, mime: file.type || 'application/octet-stream', content: btoa(binary), size: file.size });
    if (!form.name.trim()) setForm((f) => ({ ...f, name: file.name.replace(/\.[^.]+$/, '') }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setPayload(null);
    setMode('upload');
    setFormError('');
    setOpen(true);
  };

  const openEdit = (f) => {
    setEditing(f);
    setForm({
      name: f.name || '',
      variant: f.variant || 'normal',
      version: f.version || '',
      description: f.description || '',
      price: f.price != null ? String(f.price) : '',
      downloadUrl: f.download_url || '',
      active: f.active !== false,
    });
    setPayload(null);
    setMode(f.download_url ? 'link' : 'upload');
    setFormError('');
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Give the file a product name.'); return; }
    const usingUpload = mode === 'upload';
    const link = form.downloadUrl.trim();
    // Editing keeps whatever is already stored unless a replacement is chosen,
    // so "no file picked" is only an error when adding.
    if (usingUpload && !payload && !editing) { setFormError('Choose the file to upload.'); return; }
    if (!usingUpload) {
      if (!link) { setFormError('Paste the download link.'); return; }
      if (!/^https?:\/\//i.test(link)) { setFormError('The download link must start with http:// or https://'); return; }
    }

    setSaving(true);
    try {
      const changes = {
        name: form.name.trim(),
        variant: form.variant,
        version: form.version.trim() || null,
        description: form.description.trim() || null,
        price: Number(form.price) || 0,
        ...(usingUpload
          ? (payload ? { content: payload.content, file_name: payload.name, mime: payload.mime } : {})
          : { downloadUrl: link, file_name: link.split('/').pop()?.slice(0, 120) || null }),
        active: form.active,
      };

      const res = await fetch('/api/admin/bot-files', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...changes } : changes),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save the file');
      toast.success(editing ? `${form.name} updated.` : `${form.name} is live in the catalogue.`);
      setOpen(false);
      setForm(EMPTY);
      setPayload(null);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(humaniseError(err, 'We could not save that file.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (file) => {
    setBusyId(file.id);
    try {
      const res = await fetch('/api/admin/bot-files', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: file.id, action: 'toggle' }),
      });
      if (!res.ok) throw new Error('Could not change availability');
      setFiles((list) => list.map((f) => (f.id === file.id ? { ...f, active: !f.active } : f)));
      toast.success(file.active ? 'Hidden from the catalogue.' : 'Published to the catalogue.');
    } catch (err) {
      toast.error(humaniseError(err, 'Could not change availability'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!target) return;
    setBusyId(target.id);
    try {
      const res = await fetch(`/api/admin/bot-files?id=${target.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete');
      setFiles((list) => list.filter((f) => f.id !== target.id));
      toast.success('File deleted.');
    } catch (err) {
      toast.error(humaniseError(err, 'Could not delete that file'));
    } finally {
      setBusyId(null);
      setTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Bot files"
        description="BugBot and standard bot packages sold on the catalogue — uploaded here, or linked if you host them elsewhere."
        actions={<Button onClick={openCreate} icon={<Icons.Plus size={16} />}>Add file</Button>}
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <Card><p className="text-muted">Loading…</p></Card>
      ) : files.length === 0 ? (
        <EmptyState
          icon={<Icons.Bot size={24} />}
          title="No bot files yet"
          description="Upload a file or paste a download link, and it goes on sale in the catalogue immediately."
          action={<Button onClick={openCreate}>Add the first file</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {files.map((f) => (
            <Card key={f.id} className="min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong style={{ overflowWrap: 'anywhere' }}>{f.name}</strong>
                    <Badge tone={f.variant === 'bugbot' ? 'warn' : 'brand'}>
                      {f.variant === 'bugbot' ? 'BugBot' : 'Standard'}
                    </Badge>
                    {!f.active && <Badge tone="neutral">Hidden</Badge>}
                  </div>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>
                    {f.version ? `v${f.version} · ` : ''}{f.price > 0 ? fmtKes(f.price) : 'Free'} · {f.downloads} downloads
                    {f.download_url ? '' : ' · no link set'}
                  </p>
                  {f.download_url && (
                    <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                      <a
                        href={f.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted"
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {f.download_url.length > 64 ? `${f.download_url.slice(0, 64)}…` : f.download_url}
                      </a>
                    </p>
                  )}
                  {f.description && <p className="text-muted" style={{ margin: '6px 0 0' }}>{f.description}</p>}
                </div>
                <div
                  className="flex w-full items-center justify-between gap-2 border-t pt-3 sm:w-auto sm:justify-end sm:border-0 sm:pt-0"
                  style={{ flexShrink: 0, borderColor: 'var(--line-soft)' }}
                >
                  <Toggle checked={f.active} onChange={() => toggle(f)} disabled={busyId === f.id} label="Published" />
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" onClick={() => openEdit(f)} disabled={busyId === f.id} icon={<Icons.Pencil size={14} />}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setTarget(f)} disabled={busyId === f.id}>Delete</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setFormError(''); }} title={editing ? "Edit bot file" : "Add bot file"}>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Product name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="BugBot Reporter" maxLength={80} />
          </Field>

          <Field label="Variant" required>
            <select className="input" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })}>
              <option value="normal">Standard bot</option>
              <option value="bugbot">BugBot</option>
            </select>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Version">
              <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.4.2" maxLength={24} />
            </Field>
            <Field label="Price (KES)">
              <Input type="number" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0 = free" />
            </Field>
          </div>

          <Field label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the file does, what is included, requirements." />
          </Field>

          <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
            <Button
              type="button"
              variant={mode === 'upload' ? 'primary' : 'ghost'}
              onClick={() => setMode('upload')}
              size="sm"
            >
              Upload a file
            </Button>
            <Button
              type="button"
              variant={mode === 'link' ? 'primary' : 'ghost'}
              onClick={() => setMode('link')}
              size="sm"
            >
              Use a link
            </Button>
          </div>

          {mode === 'upload' ? (
            <>
              <Field label="File (zip, js, json — max 5 MB)" required>
                <input
                  type="file"
                  className="input"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                  accept=".zip,.js,.json,.rar,.tar,.gz,.txt"
                />
              </Field>
              <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
                Stored in the database and served from this site, so there is no outside host to keep
                alive. Buyers still go through the download route, which checks they paid.
              </p>
              {payload && (
                <p className="text-muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  {payload.name} · {(payload.size / 1024).toFixed(0)} KB ready
                </p>
              )}
            </>
          ) : (
            <>
              <Field
                label="Download link"
                required
                hint="Where the buyer gets the file — Drive, Dropbox, a GitHub release asset, your own host. Must start with https://"
              >
                <Input
                  type="url"
                  value={form.downloadUrl}
                  onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
                  placeholder="https://drive.google.com/file/d/…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
                Nothing is uploaded. Check the link opens without a sign-in, or buyers will not be able
                to collect what they bought.
              </p>
            </>
          )}

          <div className="flex items-center gap-2">
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Publish immediately" />
          </div>

          {formError && <p style={{ color: 'var(--bad)', margin: 0 }}>{formError}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Publish file'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={remove}
        title="Delete this bot file?"
        description={`${target?.name || 'This file'} will disappear from the catalogue. Existing buyers lose access to it.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
