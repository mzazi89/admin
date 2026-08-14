'use client';
import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fmtMtc, fmtMtcValue, mtcToKsh } from '@/lib/currency';

const EMPTY = { name: '', price: '', cpu: '', ram: '', disk: '', description: '', popular: false, accent: '#2563eb', active: true, sort_order: '', expires_after_hours: '' };

function fmtCpu(v)  { const n = parseInt(v); return n === 0 ? 'Unlimited CPU'  : `${n}% CPU`; }
function fmtRam(v)  { const n = parseInt(v); return n === 0 ? 'Unlimited RAM'  : n >= 1024 ? `${n / 1024} GB RAM`  : `${n} MB RAM`; }
function fmtDisk(v) { const n = parseInt(v); return n === 0 ? 'Unlimited Disk' : n >= 1024 ? `${n / 1024} GB Disk` : `${n} MB Disk`; }

const inputStyle = { backgroundColor: '#04070f', border: '1px solid #1e3a8a', color: '#f0f4ff', borderRadius: '0.75rem', padding: '0.625rem 1rem', width: '100%', fontSize: '0.875rem', outline: 'none' };
const labelStyle = { display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem', color: '#475569' };

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

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login'); };

  const navTabs = [
    { href: '/admin/dashboard', label: 'Overview' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/transactions', label: 'Transactions' },
    { href: '/admin/inquiries', label: 'Inquiries' },
    { href: '/admin/packages', label: 'Packages', active: true },
    { href: '/admin/vouchers', label: 'Vouchers & Recoveries' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgba(6,8,16,0.78)' }}>
      {/* Top bar */}
      <div style={{ backgroundColor: '#04070f', borderBottom: '1px solid #1e3a8a' }} className="sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: '#f0f4ff' }}>Admin Panel</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(220,38,38,0.15)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)' }}>Restricted</span>
          </div>
          <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', backgroundColor: 'rgba(248,113,113,0.05)' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Nav tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {navTabs.map(n => (
            <Link key={n.href} href={n.href} className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: n.active ? 'rgba(220,38,38,0.15)' : 'rgba(30,32,48,0.5)', color: n.active ? '#f87171' : '#64748b', border: n.active ? '1px solid rgba(220,38,38,0.3)' : '1px solid #1e3a8a' }}>
              {n.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-extrabold" style={{ color: '#f0f4ff' }}>Packages</h1>
          <div className="flex items-center gap-2">
            <button onClick={handleRestoreDefaults} disabled={restoring} className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{ color: '#94a3b8', border: '1px solid #1e3a8a', opacity: restoring ? 0.6 : 1 }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {restoring ? 'Adding…' : 'Restore Defaults'}
            </button>
            <button onClick={openAdd} className="px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Package
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
            {packages.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#374151' }}>No packages yet. Click "Add Package" to create one.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e3a8a' }}>
                      {['Name', 'Price', 'CPU', 'RAM', 'Disk', 'Popular', 'Active', 'Order', 'Actions'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg, i) => (
                      <tr key={pkg.id} style={{ borderBottom: i < packages.length - 1 ? '1px solid #1e3a8a' : 'none' }}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pkg.accent }} />
                            <span className="font-semibold" style={{ color: '#f0f4ff' }}>{pkg.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-bold" style={{ color: '#4ade80' }}>{fmtMtc(pkg.price)}</td>
                        <td className="px-5 py-4" style={{ color: '#94a3b8' }}>{fmtCpu(pkg.cpu)}</td>
                        <td className="px-5 py-4" style={{ color: '#94a3b8' }}>{fmtRam(pkg.ram)}</td>
                        <td className="px-5 py-4" style={{ color: '#94a3b8' }}>{fmtDisk(pkg.disk)}</td>
                        <td className="px-5 py-4">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: pkg.popular ? 'rgba(37,99,235,0.15)' : 'rgba(30,32,48,0.8)', color: pkg.popular ? '#60a5fa' : '#475569', border: `1px solid ${pkg.popular ? 'rgba(37,99,235,0.3)' : '#1e3a8a'}` }}>
                            {pkg.popular ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: pkg.active ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: pkg.active ? '#4ade80' : '#f87171', border: `1px solid ${pkg.active ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                            {pkg.active ? 'Active' : 'Hidden'}
                          </span>
                        </td>
                        <td className="px-5 py-4" style={{ color: '#64748b' }}>{pkg.sort_order}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(pkg)} className="text-xs px-3 py-1.5 rounded-lg font-medium"
                              style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)', backgroundColor: 'rgba(96,165,250,0.08)' }}>
                              Edit
                            </button>
                            <button onClick={() => setDeleteId(pkg.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium"
                              style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', backgroundColor: 'rgba(248,113,113,0.08)' }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={closeModal}>
          <div className="w-full max-w-lg rounded-2xl p-6 sm:p-8" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-6" style={{ color: '#f0f4ff' }}>{modal === 'add' ? 'Add Package' : 'Edit Package'}</h2>
            {error && <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>{error}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label style={labelStyle}>Package Name</label>
                  <input style={inputStyle} required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Pro" />
                </div>
                <div>
                  <label style={labelStyle}>Price (MTC/mo)</label>
                  <input style={inputStyle} type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="150" />
                </div>
                <div>
                  <label style={labelStyle}>Sort Order</label>
                  <input style={inputStyle} type="number" min="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} placeholder="5" />
                </div>
                <div>
                  <label style={labelStyle}>Expires After (hours, leave blank = never)</label>
                  <input style={inputStyle} type="number" min="1" value={form.expires_after_hours} onChange={e => setForm(f => ({ ...f, expires_after_hours: e.target.value }))} placeholder="e.g. 6" />
                </div>
                <div>
                  <label style={labelStyle}>CPU % (0 = Unlimited)</label>
                  <input style={inputStyle} type="number" min="0" required value={form.cpu} onChange={e => setForm(f => ({ ...f, cpu: e.target.value }))} placeholder="100" />
                </div>
                <div>
                  <label style={labelStyle}>RAM MB (0 = Unlimited)</label>
                  <input style={inputStyle} type="number" min="0" required value={form.ram} onChange={e => setForm(f => ({ ...f, ram: e.target.value }))} placeholder="2048" />
                </div>
                <div>
                  <label style={labelStyle}>Disk MB (0 = Unlimited)</label>
                  <input style={inputStyle} type="number" min="0" required value={form.disk} onChange={e => setForm(f => ({ ...f, disk: e.target.value }))} placeholder="10240" />
                </div>
                <div>
                  <label style={labelStyle}>Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.accent} onChange={e => setForm(f => ({ ...f, accent: e.target.value }))} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', border: '1px solid #1e3a8a', backgroundColor: '#04070f', cursor: 'pointer', padding: '2px' }} />
                    <input style={{ ...inputStyle, flex: 1 }} value={form.accent} onChange={e => setForm(f => ({ ...f, accent: e.target.value }))} placeholder="#2563eb" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label style={labelStyle}>Description</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '4rem' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what this plan is good for" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="popular" checked={!!form.popular} onChange={e => setForm(f => ({ ...f, popular: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: '#2563eb' }} />
                  <label htmlFor="popular" className="text-sm" style={{ color: '#94a3b8' }}>Mark as Popular</label>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="active" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: '#2563eb' }} />
                  <label htmlFor="active" className="text-sm" style={{ color: '#94a3b8' }}>Active (visible to users)</label>
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: '#04070f', border: `1px solid ${form.accent || '#1e3a8a'}` }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Preview</p>
                <p className="font-bold" style={{ color: '#f0f4ff' }}>{form.name || 'Package Name'}</p>
                <p className="font-extrabold text-xl" style={{ color: form.accent }}>{fmtMtc(form.price || 0)}<span className="text-xs font-normal ml-1" style={{ color: '#475569' }}>/mo</span></p>
                <p className="text-xs mt-1" style={{ color: '#64748b' }}>{fmtCpu(form.cpu || 0)} · {fmtRam(form.ram || 0)} · {fmtDisk(form.disk || 0)}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ color: '#94a3b8', border: '1px solid #1e3a8a' }}>Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : modal === 'add' ? 'Create Package' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: '#0f1117', border: '1px solid rgba(248,113,113,0.3)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2" style={{ color: '#f0f4ff' }}>Delete Package?</h3>
            <p className="text-sm mb-6" style={{ color: '#64748b' }}>This cannot be undone. Existing panels using this package are unaffected.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ color: '#94a3b8', border: '1px solid #1e3a8a' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
