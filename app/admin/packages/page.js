'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fmtKes } from '@/lib/currency';

const EMPTY = { name: '', price: '', cpu: '', ram: '', disk: '', description: '', popular: false, accent: '#2563eb', active: true, sort_order: '', expires_after_hours: '' };

function fmtCpu(v)  { const n = parseInt(v); return n === 0 ? 'Unlimited CPU'  : `${n}% CPU`; }
function fmtRam(v)  { const n = parseInt(v); return n === 0 ? 'Unlimited RAM'  : n >= 1024 ? `${n / 1024} GB RAM`  : `${n} MB RAM`; }
function fmtDisk(v) { const n = parseInt(v); return n === 0 ? 'Unlimited Disk' : n >= 1024 ? `${n / 1024} GB Disk` : `${n} MB Disk`; }

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | 'add' | 'edit'
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError]       = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
  }, []);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/packages').then(r => r.json()).then(d => {
      setPackages(d.packages || []);
      setLoading(false);
    });
  };

  const handleRestoreDefaults = async () => {
    setRestoring(true);
    try {
      await fetch('/api/admin/packages/restore-defaults', { method: 'POST' });
      load();
    } catch {}
    setRestoring(false);
  };

  const openAdd  = () => { setForm(EMPTY); setError(''); setModal('add'); };
  const openEdit = (pkg) => { setForm({ ...pkg, price: String(pkg.price), cpu: String(pkg.cpu), ram: String(pkg.ram), disk: String(pkg.disk), sort_order: String(pkg.sort_order), expires_after_hours: pkg.expires_after_hours != null ? String(pkg.expires_after_hours) : '' }); setError(''); setModal('edit'); };
  const closeModal = () => { setModal(null); setError(''); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    const isEdit = modal === 'edit';
    const url  = isEdit ? `/api/admin/packages/${form.id}` : '/api/admin/packages';
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return; }
      closeModal(); load();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/admin/packages/${id}`, { method: 'DELETE' });
      setDeleteId(null); load();
    } catch {}
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow mb-4">Catalogue</div>
          <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Packages</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRestoreDefaults} disabled={restoring} className="btn btn-ghost"
            style={{ fontSize: 11, padding: '10px 16px', opacity: restoring ? 0.6 : 1 }}>
            {restoring ? 'Adding…' : 'Restore defaults'}
          </button>
          <button onClick={openAdd} className="btn btn-primary" style={{ fontSize: 11, padding: '10px 16px' }}>
            Add package
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="spinner" /></div>
      ) : (
        <div className="card overflow-hidden">
          {packages.length === 0 ? (
            <div className="text-center py-16 mono" style={{ color: '#4C535B' }}>No packages yet — add one to get started.</div>
          ) : (
            <div className="scroll-x table-responsive">
              <table className="table-plain" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price</th>
                    <th>CPU</th>
                    <th>RAM</th>
                    <th>Disk</th>
                    <th>Popular</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map(pkg => (
                    <tr key={pkg.id}>
                      <td data-label="Name">
                        <span className="flex items-center gap-2.5">
                          <span className="flex-shrink-0" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pkg.accent }} />
                          <span style={{ fontWeight: 600, color: '#E9E7E2' }}>{pkg.name}</span>
                        </span>
                      </td>
                      <td data-label="Price" style={{ color: '#3ECF8E', fontWeight: 600 }}>{fmtKes(pkg.price)}</td>
                      <td data-label="CPU" style={{ color: '#AEB5BD', fontSize: 13 }}>{fmtCpu(pkg.cpu)}</td>
                      <td data-label="RAM" style={{ color: '#AEB5BD', fontSize: 13 }}>{fmtRam(pkg.ram)}</td>
                      <td data-label="Disk" style={{ color: '#AEB5BD', fontSize: 13 }}>{fmtDisk(pkg.disk)}</td>
                      <td data-label="Popular"><span className={`tag ${pkg.popular ? 'tag-amber' : ''}`}>{pkg.popular ? 'Yes' : 'No'}</span></td>
                      <td data-label="Status"><span className={`tag ${pkg.active ? 'tag-green' : 'tag-red'}`}>{pkg.active ? 'Active' : 'Hidden'}</span></td>
                      <td data-label="Order" className="mono" style={{ fontSize: 12, color: '#4C535B' }}>{pkg.sort_order}</td>
                      <td data-label="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(pkg)} className="btn btn-dark"
                          style={{ fontSize: 10, padding: '6px 12px', marginRight: 6 }}>Edit</button>
                        <button onClick={() => setDeleteId(pkg.id)} className="btn btn-danger"
                          style={{ fontSize: 10, padding: '6px 12px' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={closeModal}>
          <div className="w-full max-w-lg card" style={{ padding: 24 }} onClick={e => e.stopPropagation()}>
            <div className="eyebrow mb-4">{modal === 'add' ? 'New entry' : 'Edit entry'}</div>
            <h2 className="section-title mb-6" style={{ fontSize: '1.3rem' }}>{modal === 'add' ? 'Add package' : 'Edit package'}</h2>
            {error && <div className="tag tag-red mb-5" style={{ padding: '9px 12px', width: '100%', textTransform: 'none', letterSpacing: '0.02em' }}>{error}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid-2-responsive">
                <div className="sm:col-span-2">
                  <label className="label">Package name</label>
                  <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Pro" />
                </div>
                <div>
                  <label className="label">Price (KES/mo)</label>
                  <input className="input" type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="150" />
                </div>
                <div>
                  <label className="label">Sort order</label>
                  <input className="input" type="number" min="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} placeholder="5" />
                </div>
                <div>
                  <label className="label">Expires after (hours, blank = never)</label>
                  <input className="input" type="number" min="1" value={form.expires_after_hours} onChange={e => setForm(f => ({ ...f, expires_after_hours: e.target.value }))} placeholder="e.g. 6" />
                </div>
                <div>
                  <label className="label">CPU % (0 = unlimited)</label>
                  <input className="input" type="number" min="0" required value={form.cpu} onChange={e => setForm(f => ({ ...f, cpu: e.target.value }))} placeholder="100" />
                </div>
                <div>
                  <label className="label">RAM MB (0 = unlimited)</label>
                  <input className="input" type="number" min="0" required value={form.ram} onChange={e => setForm(f => ({ ...f, ram: e.target.value }))} placeholder="2048" />
                </div>
                <div>
                  <label className="label">Disk MB (0 = unlimited)</label>
                  <input className="input" type="number" min="0" required value={form.disk} onChange={e => setForm(f => ({ ...f, disk: e.target.value }))} placeholder="10240" />
                </div>
                <div>
                  <label className="label">Accent color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.accent} onChange={e => setForm(f => ({ ...f, accent: e.target.value }))} style={{ width: 40, height: 40, border: '1px solid #262C33', backgroundColor: '#0F1215', cursor: 'pointer', padding: 2 }} />
                    <input className="input" style={{ flex: 1 }} value={form.accent} onChange={e => setForm(f => ({ ...f, accent: e.target.value }))} placeholder="#2563eb" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea className="input" style={{ resize: 'vertical', minHeight: '4rem' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what this plan is good for" />
                </div>
                <label className="flex items-center gap-3" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" id="popular" checked={!!form.popular} onChange={e => setForm(f => ({ ...f, popular: e.target.checked }))} style={{ accentColor: '#F2A93B' }} />
                  <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AEB5BD' }}>Mark as popular</span>
                </label>
                <label className="flex items-center gap-3" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" id="active" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ accentColor: '#F2A93B' }} />
                  <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AEB5BD' }}>Active (visible to users)</span>
                </label>
              </div>

              {/* Live preview */}
              <div className="rounded-md p-4 mt-2" style={{ backgroundColor: '#0F1215', border: `1px solid ${form.accent || '#262C33'}` }}>
                <p className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4C535B' }}>Preview</p>
                <p style={{ fontWeight: 700, color: '#E9E7E2', margin: 0 }}>{form.name || 'Package Name'}</p>
                <p className="stat-num" style={{ fontSize: '1.4rem', color: form.accent, margin: '6px 0' }}>
                  {fmtKes(form.price || 0)}<span className="mono" style={{ fontSize: '0.45em', fontWeight: 400, color: '#4C535B', marginLeft: 6 }}>/mo</span>
                </p>
                <p className="mono" style={{ fontSize: 11, color: '#79818A', margin: 0 }}>{fmtCpu(form.cpu || 0)} · {fmtRam(form.ram || 0)} · {fmtDisk(form.disk || 0)}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1" style={{ opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : modal === 'add' ? 'Create package' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm card" style={{ padding: 24, borderColor: 'rgba(229,72,77,0.4)' }} onClick={e => e.stopPropagation()}>
            <div className="eyebrow mb-4">Destructive</div>
            <h3 className="section-title mb-2" style={{ fontSize: '1.2rem' }}>Delete package?</h3>
            <p className="lede mb-6" style={{ fontSize: '0.9rem' }}>This cannot be undone. Existing panels using this package are unaffected.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
