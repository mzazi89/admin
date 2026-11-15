'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Toggle, humaniseError, useToast, Icons } from '@/components/ui';

// MZAZI ADMIN — the data-bundle shelf.
//
// Prices move with Safaricom's wholesale rates, so editing must take seconds:
// every field is editable in place and saves on blur, no modal, no reload.
// Orders sit underneath because the first question after a failed sale is
// always "what did Safaricom say", and the answer is in the response column.

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

export default function AdminData() {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', size_mb: '', validity_days: 1, price: '', cost: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/data');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setPlans(d.plans || []); setOrders(d.orders || []);
    } catch (e) { setError(humaniseError(e, 'Could not load the catalogue.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(id, patch) {
    try {
      const res = await fetch('/api/admin/data', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
      setPlans((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    } catch (e) { toast.error(humaniseError(e, 'Could not save.')); }
  }

  async function add(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, size_mb: Number(form.size_mb), price: Number(form.price), cost: Number(form.cost) || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not add');
      setForm({ name: '', size_mb: '', validity_days: 1, price: '', cost: '' });
      toast.success('Bundle added');
      load();
    } catch (e2) { toast.error(humaniseError(e2, 'Could not add that bundle.')); }
  }

  async function remove(id) {
    if (!window.confirm('Remove this bundle from the shelf?')) return;
    await fetch(`/api/admin/data?id=${id}`, { method: 'DELETE' });
    setPlans((rows) => rows.filter((r) => r.id !== id));
  }

  return (
    <div className="stack">
      <PageHeader
        title="Data bundles"
        subtitle="What customers can buy on /data, and every order Safaricom has answered."
        actions={<Button variant="ghost" onClick={load} icon={<Icons.Refresh size={15} />}>Refresh</Button>}
      />

      {error && <Card><p style={{ color: 'var(--danger)' }}>{error}</p></Card>}

      <Card>
        <h3 className="card-title">Add a bundle</h3>
        <form onSubmit={add} className="grid-form">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="1.5GB Daily" required /></Field>
          <Field label="Size (MB)"><Input type="number" value={form.size_mb} onChange={(e) => setForm({ ...form, size_mb: e.target.value })} placeholder="1500" required /></Field>
          <Field label="Validity (days)"><Input type="number" value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: e.target.value })} /></Field>
          <Field label="Price (KES)"><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></Field>
          <Field label="Cost (KES)" hint="Optional — what Safaricom charges you, for margin"><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button type="submit" icon={<Icons.Plus size={15} />}>Add</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="card-title">On the shelf ({plans.length})</h3>
        {loading ? <p className="muted">Loading…</p> : plans.length === 0 ? (
          <EmptyState title="Nothing on sale" body="Add a bundle above — the shop stays hidden until there is at least one." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Size</th><th>Validity</th><th>Price</th><th>Cost</th><th>Live</th><th /></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td><input className="cell-input" defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && save(p.id, { name: e.target.value })} /></td>
                    <td><input className="cell-input" type="number" defaultValue={p.size_mb} onBlur={(e) => +e.target.value !== p.size_mb && save(p.id, { size_mb: +e.target.value })} /></td>
                    <td><input className="cell-input" type="number" defaultValue={p.validity_days} onBlur={(e) => +e.target.value !== p.validity_days && save(p.id, { validity_days: +e.target.value })} /></td>
                    <td><input className="cell-input" type="number" defaultValue={p.price} onBlur={(e) => +e.target.value !== p.price && save(p.id, { price: +e.target.value })} /></td>
                    <td><input className="cell-input" type="number" defaultValue={p.cost ?? ''} onBlur={(e) => +e.target.value !== p.cost && save(p.id, { cost: +e.target.value })} /></td>
                    <td><Toggle checked={p.active} onChange={(v) => save(p.id, { active: v })} /></td>
                    <td><Button size="sm" variant="ghost" onClick={() => remove(p.id)} icon={<Icons.Trash size={14} />} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="card-title">Recent orders</h3>
        {orders.length === 0 ? <p className="muted">No orders yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Plan</th><th>Phone</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{new Date(o.created_at).toLocaleString('en-KE')}</td>
                    <td>{o.plan || '—'}</td>
                    <td className="mono">{o.phone}</td>
                    <td>{money(o.amount)}</td>
                    <td><Badge tone={o.status === 'fulfilled' ? 'good' : o.status === 'failed' ? 'bad' : 'warn'}>{o.status}</Badge></td>
                    <td className="mono" title={o.response || ''}>{o.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
