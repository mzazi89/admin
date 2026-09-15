'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtKes } from '@/lib/currency';
import {
  Alert, Badge, Button, Card, CardHeader, DataTable, EmptyState, ErrorState, Field, Input,
  PageHeader, Skeleton, humaniseError, useToast,
  Icons,
} from '@/components/ui';

export default function AdminCoupons() {
  const router = useRouter();
  const toast = useToast();

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/vouchers');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load coupons');
      setVouchers(d.vouchers || []);
    } catch (e) {
      setError(humaniseError(e, 'We could not load coupons right now. Please try again.'));
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

  // The API accepts exactly two fields on create and has no update/delete route.
  const canSubmit = code.length === 6 && !!amount && parseFloat(amount) > 0 && !creating;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), amount: parseFloat(amount) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to create coupon');
      toast.success(`Coupon ${code.trim().toUpperCase()} activated for ${fmtKes(amount)}.`);
      setCode('');
      setAmount('');
      load();
    } catch (err) {
      toast.error(humaniseError(err, 'We could not create this coupon. Please try again.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader
        title="Coupons"
        description="Wallet credit codes redeemable once by a member."
        icon={<Icons.Ticket size={20} />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18, marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {/* Create form */}
          <Card style={{ padding: 20 }}>
            <CardHeader title="New coupon" description="6 characters, letters and numbers." icon={<Icons.Plus size={17} />} />
            <form onSubmit={handleCreate}>
              <Field label="Code" id="cpn-code" required hint={`${code.length}/6 characters`}>
                <Input
                  id="cpn-code"
                  className="mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  maxLength={6}
                  required
                  style={{ letterSpacing: '0.3em', fontSize: 16, fontWeight: 600 }}
                />
              </Field>
              <Field label="Amount (KES)" id="cpn-amount" required>
                <Input id="cpn-amount" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" required />
              </Field>
              <Button type="submit" variant="primary" block loading={creating} loadingText="Activating…" disabled={!canSubmit} icon={<Icons.Check size={16} />}>
                Activate code
              </Button>
            </form>
          </Card>

          {/* Summary */}
          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <Alert kind="info" title="What this API supports">
              Coupons can be created and listed only. The API has no update, disable or delete route, so no such actions are shown.
            </Alert>
            <div className="grid-cards">
              <div className="card" style={{ padding: 18 }}>
                <div className="stat-num">{vouchers.length}</div>
                <div className="stat-label">Total coupons</div>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat-num" style={{ color: 'var(--good)' }}>{vouchers.filter((v) => v.status === 'active').length}</div>
                <div className="stat-label">Active (unused)</div>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat-num" style={{ color: 'var(--ink-2)' }}>{vouchers.filter((v) => v.status === 'used').length}</div>
                <div className="stat-label">Used</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <CardHeader title="All coupons" description={`${vouchers.length} total`} style={{ marginBottom: 0 }} />
        </div>

        {error ? (
          <ErrorState title="Could not load coupons" message={error} onRetry={load} />
        ) : loading ? (
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}
          </div>
        ) : vouchers.length === 0 ? (
          <EmptyState icon={<Icons.Ticket size={26} />} title="No coupons yet" description="Create a coupon with the form above to get started." />
        ) : (
          <DataTable columns={['Code', 'Discount', 'Uses', 'Expiry', 'Status']}>
            {vouchers.map((v) => (
              <tr key={v.id}>
                <td data-label="Code" className="mono" style={{ fontWeight: 600, letterSpacing: '0.18em', color: 'var(--ink)' }}>{v.code}</td>
                <td data-label="Discount" style={{ color: 'var(--good)', fontWeight: 600 }}>{fmtKes(v.amount)}</td>
                <td data-label="Uses">{v.status === 'used' ? '1 / 1' : '0 / 1'}</td>
                <td data-label="Expiry" className="mono" style={{ fontSize: 12.5, color: 'var(--dim)' }}>—</td>
                <td data-label="Status"><Badge tone={v.status === 'active' ? 'good' : v.status === 'used' ? 'neutral' : 'warn'}>{v.status}</Badge></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
