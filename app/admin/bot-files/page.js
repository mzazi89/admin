'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtKes } from '@/lib/currency';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal,
  PageHeader, Textarea, Toggle, humaniseError, useToast, Icons,
} from '@/components/ui';

const EMPTY = { name: '', variant: 'normal', version: '', description: '', price: '', active: true };

const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

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
  const [form, setForm] = useState(EMPTY);
  const [payload, setPayload] = useState(null); // { name, mime, content, size }
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
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
    if (file.size > 5 * 1024 * 1024) { setFormError('Files must be 5 MB or smaller.'); return; }
    const buf = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    setPayload({ name: file.name, mime: file.type || 'application/octet-stream', content: btoa(binary), size: file.size });
    setFormError('');
    if (!form.name) setForm((f) => ({ ...f, name: file.name.replace(/\.[^.]+$/, '') }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Give the file a product name.'); return; }
    if (!payload) { setFormError('Choose the file to upload.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/bot-files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          variant: form.variant,
          version: form.version.trim() || null,
          description: form.description.trim() || null,
          price: Number(form.price) || 0,
          file_name: payload.name,
          mime: payload.mime,
          content: payload.content,
          active: form.active,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Upload failed');
      toast.success(`${form.name} is live in the catalogue.`);
      setOpen(false);
      setForm(EMPTY);
      setPayload(null);
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
        description="BugBot and standard bot packages sold on the catalogue."
        actions={<Button onClick={() => setOpen(true)} icon={<Icons.Plus size={16} />}>Upload file</Button>}
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <Card><p className="text-muted">Loading…</p></Card>
      ) : files.length === 0 ? (
        <EmptyState
          icon={<Icons.Bot size={24} />}
          title="No bot files yet"
          description="Upload a BugBot or standard bot package and it appears in the website catalogue immediately."
          action={<Button onClick={() => setOpen(true)}>Upload the first file</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {files.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <strong>{f.name}</strong>
                    <Badge tone={f.variant === 'bugbot' ? 'warn' : 'brand'}>
                      {f.variant === 'bugbot' ? 'BugBot' : 'Standard'}
                    </Badge>
                    {!f.active && <Badge tone="neutral">Hidden</Badge>}
                  </div>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>
                    {f.version ? `v${f.version} · ` : ''}{kb(f.size_bytes)} · {f.price > 0 ? fmtKes(f.price) : 'Free'} · {f.downloads} downloads
                  </p>
                  {f.description && <p className="text-muted" style={{ margin: '6px 0 0' }}>{f.description}</p>}
                </div>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <Toggle checked={f.active} onChange={() => toggle(f)} disabled={busyId === f.id} label="Published" />
                  <Button variant="ghost" onClick={() => setTarget(f)} disabled={busyId === f.id}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setFormError(''); }} title="Upload bot file">
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

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
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

          <Field label="File (zip, js, json — max 5 MB)" required>
            <input
              type="file"
              className="input"
              onChange={(e) => pickFile(e.target.files?.[0])}
              accept=".zip,.js,.json,.rar,.tar,.gz,.txt"
            />
          </Field>
          {payload && <p className="text-muted" style={{ margin: 0 }}>{payload.name} · {kb(payload.size)} ready to upload</p>}

          <div className="flex items-center gap-2">
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Publish immediately" />
          </div>

          {formError && <p style={{ color: 'var(--bad)', margin: 0 }}>{formError}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Uploading…' : 'Upload file'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={remove}
        title="Delete this bot file?"
        description={`${target?.name || 'This file'} will disappear from the catalogue. Existing buyers keep their download only if you re-upload it.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
