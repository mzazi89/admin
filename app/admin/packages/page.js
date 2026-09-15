'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtKes } from '@/lib/currency';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader,
  SkeletonCards, Textarea, Toggle, humaniseError, useToast,
  Icons,
} from '@/components/ui';

const EMPTY = {
  name: '', price: '', cpu: '', ram: '', disk: '', description: '',
  popular: false, accent: '', active: true, sort_order: '', expires_after_hours: '',
};

function fmtCpu(v)  { const n = parseInt(v); return n === 0 ? 'Unlimited CPU'  : `${n}% CPU`; }
function fmtRam(v)  { const n = parseInt(v); return n === 0 ? 'Unlimited RAM'  : n >= 1024 ? `${n / 1024} GB RAM`  : `${n} MB RAM`; }
function fmtDisk(v) { const n = parseInt(v); return n === 0 ? 'Unlimited Disk' : n >= 1024 ? `${n / 1024} GB Disk` : `${n} MB Disk`; }
function fmtDuration(v) {
  if (v === null || v === undefined || v === '') return 'No expiry';
  const n = parseInt(v);
  return n > 0 ? `Runs for ${n}h` : 'No expiry';
}

export default function AdminPackages() {
  const router = useRouter();
  const toast = useToast();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/packages');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load packages');
      setPackages(d.packages || []);
    } catch (e) {
      setError(humaniseError(e, 'We could not load packages right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => { setForm(EMPTY); setFormError(''); setModal('add'); };
  const openEdit = (pkg) => {
    setForm({
      ...pkg,
      price: String(pkg.price ?? ''),
      cpu: String(pkg.cpu ?? ''),
      ram: String(pkg.ram ?? ''),
      disk: String(pkg.disk ?? ''),
      sort_order: String(pkg.sort_order ?? ''),
      accent: pkg.accent || '',
      expires_after_hours: pkg.expires_after_hours != null ? String(pkg.expires_after_hours) : '',
    });
    setFormError('');
    setModal('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const isEdit = modal === 'edit';
    const url = isEdit ? `/api/admin/packages/${form.id}` : '/api/admin/packages';
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to save package');
      toast.success(isEdit ? 'Package updated.' : 'Package created.');
      setModal(null);
      load();
    } catch (err) {
      setFormError(humaniseError(err, 'We could not save this package. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      await fetch('/api/admin/packages/restore-defaults', { method: 'POST' });
      toast.success('Default packages restored.');
      setRestoreOpen(false);
      load();
    } catch (e) {
      toast.error(humaniseError(e, 'We could not restore defaults. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/packages/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete package');
      }
      toast.success('Package deleted.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(humaniseError(e, 'We could not delete this package. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader
        title="Packages"
        description="Hosting plans offered on the site. Edit a plan or reset the catalogue to the shipped defaults."
        icon={<Icons.Sparkles size={20} />}
        actions={
          <>
            <Button variant="ghost" size="sm" icon={<Icons.Refresh size={15} />} onClick={() => setRestoreOpen(true)}>Restore defaults</Button>
            <Button variant="primary" size="sm" icon={<Icons.Plus size={15} />} onClick={openAdd}>Add package</Button>
          </>
        }
      />

      {error ? (
        <Card><ErrorState title="Could not load packages" message={error} onRetry={load} /></Card>
      ) : loading ? (
        <SkeletonCards count={4} height={200} />
      ) : packages.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icons.Sparkles size={26} />}
            title="No packages yet"
            description="Add a package to start selling hosting plans."
            action={<Button variant="primary" size="sm" icon={<Icons.Plus size={15} />} onClick={openAdd}>Add package</Button>}
          />
        </Card>
      ) : (
        <div className="grid-cards anim-fade-up">
          {packages.map((pkg) => (
            <article key={pkg.id} className={`card ${pkg.popular ? 'card-accent' : ''}`} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, flex: '0 0 10px', borderRadius: '50%', background: pkg.accent || 'var(--brand)' }} />
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>{pkg.name}</h3>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {pkg.popular && <Badge tone="brand">Popular</Badge>}
                  <Badge tone={pkg.active ? 'good' : 'bad'}>{pkg.active ? 'Active' : 'Hidden'}</Badge>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{fmtKes(pkg.price)}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>/mo</span>
              </div>

              {pkg.description && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55 }}>{pkg.description}</p>}

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                {[fmtCpu(pkg.cpu), fmtRam(pkg.ram), fmtDisk(pkg.disk), fmtDuration(pkg.expires_after_hours)].map((line) => (
                  <li key={line} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: 'var(--ink-2)' }}>
                    <span aria-hidden="true" style={{ color: 'var(--good)', display: 'inline-flex' }}><Icons.Check size={14} /></span>{line}
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                <Button variant="dark" size="sm" icon={<Icons.Pencil size={14} />} onClick={() => openEdit(pkg)}>Edit</Button>
                <Button variant="ghost" size="sm" icon={<Icons.Trash size={14} />} onClick={() => setDeleteTarget(pkg)} style={{ color: 'var(--bad)' }}>Delete</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Edit package' : 'Add package'}
        description="Prices are in KES. 0 means unlimited for CPU, RAM and Disk."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>{modal === 'edit' ? 'Save changes' : 'Create package'}</Button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          {formError && (
            <div style={{ marginBottom: 14 }}>
              <ErrorState title="Could not save" message={formError} minHeight={0} />
            </div>
          )}
          <Field label="Package name" id="pkg-name" required>
            <Input id="pkg-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard" required />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <Field label="Price (KES/mo)" id="pkg-price" required>
              <Input id="pkg-price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="150" required />
            </Field>
            <Field label="Sort order" id="pkg-sort">
              <Input id="pkg-sort" type="number" min="0" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} placeholder="5" />
            </Field>
            <Field label="Expires after (hours, blank = never)" id="pkg-exp">
              <Input id="pkg-exp" type="number" min="1" value={form.expires_after_hours} onChange={(e) => setForm((f) => ({ ...f, expires_after_hours: e.target.value }))} placeholder="e.g. 6" />
            </Field>
            <Field label="CPU % (0 = unlimited)" id="pkg-cpu">
              <Input id="pkg-cpu" type="number" min="0" value={form.cpu} onChange={(e) => setForm((f) => ({ ...f, cpu: e.target.value }))} placeholder="100" />
            </Field>
            <Field label="RAM MB (0 = unlimited)" id="pkg-ram">
              <Input id="pkg-ram" type="number" min="0" value={form.ram} onChange={(e) => setForm((f) => ({ ...f, ram: e.target.value }))} placeholder="2048" />
            </Field>
            <Field label="Disk MB (0 = unlimited)" id="pkg-disk">
              <Input id="pkg-disk" type="number" min="0" value={form.disk} onChange={(e) => setForm((f) => ({ ...f, disk: e.target.value }))} placeholder="10240" />
            </Field>
          </div>
          <Field label="Accent colour" id="pkg-accent" hint="A CSS colour, e.g. #7c3aed or var(--brand).">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, flex: '0 0 34px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: form.accent || 'var(--brand)' }} />
              <Input id="pkg-accent" value={form.accent} onChange={(e) => setForm((f) => ({ ...f, accent: e.target.value }))} placeholder="var(--brand)" />
            </div>
          </Field>
          <Field label="Description" id="pkg-desc">
            <Textarea id="pkg-desc" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe what this plan is good for" />
          </Field>
          <Toggle id="pkg-popular" checked={!!form.popular} onChange={(v) => setForm((f) => ({ ...f, popular: v }))} label="Mark as popular" />
          <Toggle id="pkg-active" checked={!!form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Active (visible to users)" />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget.id)}
        loading={busy}
        title={`Delete ${deleteTarget?.name || 'package'}?`}
        description="This removes the package from the catalogue. Existing panels are unaffected. It cannot be undone."
        confirmLabel="Delete package"
      />

      <ConfirmDialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onConfirm={handleRestore}
        loading={busy}
        title="Restore default packages?"
        description="This deletes every package and re-creates the four shipped defaults. Existing panels are unaffected."
        confirmLabel="Restore defaults"
      />
    </div>
  );
}
