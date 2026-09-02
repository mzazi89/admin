'use client';
import { useState, useEffect, useCallback } from 'react';

const EMPTY = { name: '', price: '', ram: '', cpu: '', disk: '', bandwidth: '', location: '', os: '', description: '', active: true };
const SPEC_FIELDS = [
  { key: 'ram', label: 'RAM', placeholder: '2 GB' },
  { key: 'cpu', label: 'CPU', placeholder: '2 vCPU' },
  { key: 'disk', label: 'Disk', placeholder: '40 GB NVMe' },
  { key: 'bandwidth', label: 'Bandwidth', placeholder: '1 TB' },
  { key: 'location', label: 'Location', placeholder: 'Nairobi, KE' },
  { key: 'os', label: 'OS', placeholder: 'Ubuntu 22.04' },
];

export default function VpsPage() {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState(null);   // package being pooled
  const [instances, setInstances] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [reveal, setReveal] = useState({});

  // new-instance form — droplet fields (the only requirements)
  const [inst, setInst] = useState({ host: '', username: '', password: '', droplet_id: '', hostname: '', region: '', os: '', cpu: '' });
  const INST_FIELDS = [
    { key: 'host', label: '🌐 IP address', ph: '174.138.21.94', req: true },
    { key: 'username', label: '🆔 Username', ph: 'root', req: true },
    { key: 'password', label: '🔐 Password', ph: 'strong password', req: true },
    { key: 'droplet_id', label: '🔢 ID droplet', ph: '595490433' },
    { key: 'hostname', label: '🧩 Hostname', ph: 'SanzShop' },
    { key: 'region', label: '🌍 Region', ph: 'SGP1' },
    { key: 'os', label: '💿 OS', ph: 'UBUNTU-24-04-X64' },
    { key: 'cpu', label: '🖥️ CPU type', ph: 'Regular' },
  ];

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/vps/packages', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setPackages(d.packages || []); }
    } catch {}
  }, []);

  const loadInstances = useCallback(async (packageId) => {
    try {
      const res = await fetch(`/api/admin/vps/instances?package_id=${packageId}`, { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setInstances(d.instances || []); }
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selected) loadInstances(selected.id); }, [selected, loadInstances]);

  const flash = (msg) => { setNotice(msg); setError(''); setTimeout(() => setNotice(''), 5000); };

  const savePackage = async () => {
    setError('');
    if (!form.name.trim() || !Number(form.price)) { setError('Name and price are required.'); return; }
    try {
      const res = await fetch(editingId ? `/api/admin/vps/packages/${editingId}` : '/api/admin/vps/packages', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Save failed'); return; }
      flash(editingId ? '✅ Package updated.' : '✅ Package created — add instances to its pool.');
      setShowForm(false); setEditingId(null); setForm(EMPTY);
      load();
    } catch { setError('Network error'); }
  };

  const deletePackage = async (p) => {
    if (!window.confirm(`Delete package "${p.name}"? This removes its unsold instances.`)) return;
    const res = await fetch(`/api/admin/vps/packages/${p.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Delete failed'); return; }
    flash('🗑 Package deleted.');
    if (selected?.id === p.id) setSelected(null);
    load();
  };

  const toggleActive = async (p) => {
    const res = await fetch(`/api/admin/vps/packages/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, active: p.active === false ? true : false, price: Number(p.price) }),
    });
    if (res.ok) { flash(p.active === false ? '✅ Package live on the store.' : '⏸ Package hidden from the store.'); load(); }
  };

  const addInstance = async () => {
    setError('');
    if (!inst.host.trim() || !inst.username.trim() || !inst.password.trim()) { setError('IP address, username and password are required.'); return; }
    const res = await fetch('/api/admin/vps/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_id: selected.id, instances: [{ ...inst }] }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Add failed'); return; }
    setInst({ host: '', username: '', password: '', droplet_id: '', hostname: '', region: '', os: '', cpu: '' });
    flash(`✅ ${data.added} instance added to the pool.`);
    loadInstances(selected.id);
  };

  const deleteInstance = async (id) => {
    if (!window.confirm('Remove this available instance from the pool?')) return;
    const res = await fetch(`/api/admin/vps/instances?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Delete failed'); return; }
    flash('🗑 Instance removed.');
    loadInstances(selected.id);
    load();
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display">VPS Store</h1>
          <p className="lede mt-2" style={{ maxWidth: 620 }}>
            Packages shown on <span className="mono">mzazi.shop/vps</span>. Buyers pay (M-PESA / Airtel / Till / Card) and are
            instantly assigned the next available instance from that package's credential pool.
          </p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(EMPTY); }} className="btn btn-primary" style={{ fontSize: 13, padding: '10px 18px' }}>
          {showForm && !editingId ? '✕ Close' : '＋ New package'}
        </button>
      </div>

      {notice && (
        <div className="mt-4 px-4 py-3 text-sm" style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.3)', color: '#3ECF8E', borderRadius: 8 }}>
          {notice}
        </div>
      )}
      {error && <div className="mt-4 px-4 py-3 text-sm" style={{ background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.3)', color: '#E5484D', borderRadius: 8 }}>{error}</div>}

      {/* ── Package form ── */}
      {showForm && (
        <div className="card p-6 mt-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: '#E9E7E2' }}>{editingId ? `Edit package #${editingId}` : 'New VPS package'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input className="input" placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" type="number" placeholder="Price (KES) *" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            <input className="input" placeholder="Short tagline (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            {SPEC_FIELDS.map(f => (
              <input key={f.key} className="input" placeholder={f.label} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 text-xs" style={{ color: '#AEB5BD', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active !== false} onChange={e => setForm({ ...form, active: e.target.checked })} />
              Live on store
            </label>
            <button onClick={savePackage} className="btn btn-primary" style={{ fontSize: 13, padding: '9px 18px' }}>
              {editingId ? 'Save changes' : 'Create package'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY); }} className="btn" style={{ fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Packages table ── */}
      <div className="card mt-6">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Package</th><th>Specs</th><th>Price</th><th>Pool</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center" style={{ color: '#79818A' }}>No packages yet — create your first VPS package.</td></tr>
              )}
              {packages.map(p => (
                <tr key={p.id} style={{ opacity: p.active === false ? 0.55 : 1 }}>
                  <td>
                    <p className="font-semibold" style={{ color: '#E9E7E2' }}>{p.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#79818A' }}>{p.os || 'Linux'} · {p.location || '—'}</p>
                  </td>
                  <td>
                    <p className="text-[11px]" style={{ color: '#AEB5BD' }}>{[p.ram, p.cpu, p.disk, p.bandwidth].filter(Boolean).join(' · ') || '—'}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#4C535B' }}>{p.orders} sale(s)</p>
                  </td>
                  <td className="mono font-semibold" style={{ color: '#F2A93B' }}>KES {Number(p.price).toLocaleString()}</td>
                  <td>
                    <span className="tag tag-green"><span className="dot" style={{ color: '#3ECF8E' }} />{p.stock} free</span>{' '}
                    <span className="tag">{p.sold} sold</span>
                  </td>
                  <td>
                    <button onClick={() => toggleActive(p)} className="tag" style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}>
                      <span className="dot" style={{ color: p.active === false ? '#E5484D' : '#3ECF8E' }} />
                      {p.active === false ? 'Hidden' : 'Live'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => { setSelected(p); loadInstances(p.id); }} className="btn btn-dark" style={{ fontSize: 10, padding: '6px 10px', marginRight: 4 }}>Manage pool</button>
                    <button onClick={() => { setEditingId(p.id); setForm({ ...p, price: String(Number(p.price)) }); setShowForm(true); }} className="btn" style={{ fontSize: 10, padding: '6px 10px', marginRight: 4 }}>Edit</button>
                    <button onClick={() => deletePackage(p)} className="btn btn-danger" style={{ fontSize: 10, padding: '6px 10px' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Credential pool manager ── */}
      {selected && (
        <div className="card p-6 mt-6" style={{ border: '1px solid rgba(242,169,59,0.25)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="text-sm font-bold" style={{ color: '#E9E7E2' }}>Credential pool — {selected.name}</h2>
              <p className="text-[11px] mt-0.5" style={{ color: '#79818A' }}>
                Add real VPS instances (host / user / password). Each sale auto-assigns the next available one.
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="btn" style={{ fontSize: 11 }}>✕ Close</button>
          </div>

          {/* add form — droplet requirements */}
          <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
            {INST_FIELDS.map(f => (
              <input key={f.key} className="input" style={{ fontSize: 12 }} placeholder={`${f.label}${f.req ? ' *' : ''}`}
                value={inst[f.key]} onChange={e => setInst({ ...inst, [f.key]: e.target.value })} />
            ))}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={addInstance} className="btn btn-primary" style={{ fontSize: 12, padding: '9px 16px' }}>＋ Add instance</button>
            <span className="text-[11px]" style={{ color: '#4C535B' }}>Only these fields are required · SSH port defaults to 22</span>
          </div>
          {error && <p className="text-xs mb-3" style={{ color: '#E5484D' }}>{error}</p>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Instance</th><th>Password</th><th>Status</th><th>Buyer</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {instances.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center" style={{ color: '#79818A' }}>No instances yet — add a droplet above. Buyers can't order until stock &gt; 0.</td></tr>
                )}
                {instances.map(i => {
                  const isSold = i.status === 'sold';
                  const meta = [i.hostname, i.region, i.os, i.cpu, i.droplet_id ? `ID ${i.droplet_id}` : ''].filter(Boolean).join(' · ');
                  return (
                    <tr key={i.id} style={{ opacity: isSold ? 0.8 : 1 }}>
                      <td className="mono" style={{ color: '#4C535B' }}>#{i.id}</td>
                      <td>
                        <p className="mono font-semibold text-[12px]" style={{ color: '#E9E7E2' }}>
                          🌐 {i.host} <span style={{ color: '#4C535B', fontWeight: 400 }}>· 🆔 {i.username}</span>
                        </p>
                        {meta && <p className="mono text-[10px] mt-1" style={{ color: '#79818A' }}>{meta}</p>}
                      </td>
                      <td className="mono" style={{ color: '#AEB5BD' }}>
                        <button onClick={() => setReveal(r => ({ ...r, [i.id]: !r[i.id] }))} className="btn" style={{ fontSize: 10, padding: '2px 8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                          {reveal[i.id] ? i.password : '••••••••••'}
                        </button>
                      </td>
                      <td>
                        <span className={isSold ? 'tag tag-amber' : 'tag tag-green'}>
                          <span className="dot" style={{ color: isSold ? '#F2A93B' : '#3ECF8E' }} />
                          {isSold ? 'Sold' : 'Available'}
                        </span>
                      </td>
                      <td className="text-[11px]" style={{ color: '#79818A' }}>
                        {isSold ? (i.buyer_email || `user #${i.sold_to}`) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!isSold && (
                          <button onClick={() => deleteInstance(i.id)} className="btn btn-danger" style={{ fontSize: 10, padding: '4px 8px' }}>Remove</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
