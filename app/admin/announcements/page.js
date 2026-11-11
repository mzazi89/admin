'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, PageHeader, Textarea, Toggle, humaniseError, useToast, Icons } from '@/components/ui';

// MZAZI ADMIN — announcements.
// Anything published here appears in the app's Notifications screen and the
// customer dashboard, so it is deliberately one short form and a list.
export default function AdminAnnouncements() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', body: '', level: 'info' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [target, setTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/announcements');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setRows(d.announcements || []);
    } catch (e) { setError(humaniseError(e, 'Could not load announcements.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const publish = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) { setFormError('Give the announcement a title.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not publish');
      toast.success('Announcement published to the app.');
      setForm({ title: '', body: '', level: 'info' });
      load();
    } catch (err) { setFormError(humaniseError(err, 'Could not publish that.')); }
    finally { setSaving(false); }
  };

  const toggle = async (row) => {
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, action: 'toggle' }),
      });
      if (!res.ok) throw new Error('Could not change visibility');
      setRows((l) => l.map((r) => (r.id === row.id ? { ...r, active: !r.active } : r)));
      toast.success(row.active ? 'Hidden from the app.' : 'Visible in the app again.');
    } catch (e) { toast.error(humaniseError(e, 'Could not change visibility')); }
  };

  const remove = async () => {
    if (!target) return;
    try {
      const res = await fetch(`/api/admin/announcements?id=${target.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete');
      setRows((l) => l.filter((r) => r.id !== target.id));
      toast.success('Deleted.');
    } catch (e) { toast.error(humaniseError(e, 'Could not delete')); }
    finally { setTarget(null); }
  };

  return (
    <div>
      <PageHeader title="Announcements" description="Pushed to the mobile app and the customer dashboard." />

      <Card>
        <form onSubmit={publish} className="grid gap-3">
          <Field label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Scheduled maintenance on Saturday" maxLength={120} />
          </Field>
          <Field label="Message">
            <Textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What is happening, when, and what customers should do." />
          </Field>
          <div className="flex items-end gap-3">
            <Field label="Tone">
              <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                <option value="info">Info</option>
                <option value="success">Good news</option>
                <option value="warning">Warning</option>
              </select>
            </Field>
            <Button type="submit" disabled={saving}>{saving ? 'Publishing…' : 'Publish announcement'}</Button>
          </div>
          {formError && <p style={{ color: 'var(--bad)', margin: 0 }}>{formError}</p>}
        </form>
      </Card>

      <div style={{ marginTop: 16 }}>
        {error ? <ErrorState message={error} onRetry={load} />
          : loading ? <Card><p className="text-muted">Loading…</p></Card>
          : rows.length === 0 ? <EmptyState icon={<Icons.Info size={24} />} title="No announcements yet" description="Publish one above and it lands in the app immediately." />
          : rows.map((r) => (
            <Card key={r.id} style={{ marginBottom: 8 }}>
              <div className="flex items-start justify-between gap-4">
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <strong>{r.title}</strong>
                    <Badge tone={r.level === 'warning' ? 'warn' : r.level === 'success' ? 'good' : 'brand'}>{r.level}</Badge>
                    {!r.active && <Badge tone="neutral">Hidden</Badge>}
                  </div>
                  {r.body && <p className="text-muted" style={{ margin: '4px 0 0' }}>{r.body}</p>}
                  <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <Toggle checked={r.active} onChange={() => toggle(r)} label="Visible" />
                  <Button variant="ghost" onClick={() => setTarget(r)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
      </div>

      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} onConfirm={remove} title="Delete this announcement?" description="It disappears from the app for everyone." confirmLabel="Delete" />
    </div>
  );
}
