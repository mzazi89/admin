'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fmtKes } from '@/lib/currency';

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      loadVouchers();
    });
  }, []);

  const loadVouchers = async () => {
    const r = await fetch('/api/admin/vouchers');
    if (r.ok) { const d = await r.json(); setVouchers(d.vouchers || []); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (code.trim().length !== 6) {
      setMessage({ type: 'error', text: 'Code must be exactly 6 characters.' });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid amount.' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Voucher ${code.trim().toUpperCase()} activated for ${fmtKes(amount)}` });
        setCode('');
        setAmount('');
        loadVouchers();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create voucher.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setCreating(false);
    }
  };

  const tagFor = (s) => s === 'active' ? 'tag-green' : s === 'used' ? '' : 'tag-amber';

  const usedTotal = vouchers.filter(v => v.status === 'used').reduce((s, v) => s + parseFloat(v.amount), 0);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow mb-4">Credits</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Vouchers &amp; recoveries</h1>
      </div>

      {message && (
        <div className="tag mb-6" style={{
          padding: '11px 14px', width: '100%', textTransform: 'none', letterSpacing: '0.02em',
          backgroundColor: message.type === 'success' ? 'rgba(62,207,142,0.06)' : 'rgba(229,72,77,0.06)',
          borderColor: message.type === 'success' ? 'rgba(62,207,142,0.35)' : 'rgba(229,72,77,0.35)',
          color: message.type === 'success' ? '#3ECF8E' : '#E5484D',
        }}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Create form */}
        <div className="card card-pad lg:col-span-1" style={{ padding: '24px' }}>
          <p className="eyebrow mb-5">New voucher</p>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label" htmlFor="v-code">Code (6 characters)</label>
              <input
                id="v-code"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                className="input mono"
                style={{ letterSpacing: '0.3em', fontSize: 16, fontWeight: 600 }}
                required
              />
              <p className="mono mt-1.5" style={{ fontSize: 10, color: '#4C535B' }}>{code.length}/6 characters</p>
            </div>
            <div>
              <label className="label" htmlFor="v-amount">Amount (KES)</label>
              <input
                id="v-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="input"
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating || code.length !== 6 || !amount}
              className="btn btn-primary w-full"
              style={{ opacity: (creating || code.length !== 6 || !amount) ? 0.5 : 1 }}
            >
              {creating ? 'Activating…' : 'Activate code'}
            </button>
          </form>

          <div className="mt-6 p-3.5" style={{ backgroundColor: '#0F1215', border: '1px solid #1B2026', borderRadius: 4, fontSize: 12.5, color: '#79818A', lineHeight: 1.65 }}>
            <span className="mono" style={{ color: '#3ECF8E', fontWeight: 600 }}>How it works</span>
            <br />
            Enter any 6-character code (letters/numbers), set the amount in KES, then activate. The code is immediately usable by one member to credit their wallet.
          </div>
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-5 content-start">
          <div className="card" style={{ padding: '22px 20px' }}>
            <div className="stat-num">{vouchers.length}</div>
            <div className="stat-label">Total vouchers</div>
          </div>
          <div className="card" style={{ padding: '22px 20px' }}>
            <div className="stat-num" style={{ color: '#3ECF8E' }}>{vouchers.filter(v => v.status === 'active').length}</div>
            <div className="stat-label">Active (unused)</div>
          </div>
          <div className="card" style={{ padding: '22px 20px' }}>
            <div className="stat-num" style={{ color: '#AEB5BD' }}>{vouchers.filter(v => v.status === 'used').length}</div>
            <div className="stat-label">Used</div>
          </div>
          <div className="sm:col-span-3 card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div className="stat-num" style={{ color: '#F2A93B' }}>{fmtKes(usedTotal)}</div>
            <div className="stat-label">Total redeemed via vouchers</div>
          </div>
        </div>
      </div>

      {/* Vouchers table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid #262C33' }}>
          <p className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#79818A' }}>
            All vouchers ({vouchers.length})
          </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="spinner" /></div>
        ) : vouchers.length === 0 ? (
          <p className="mono text-center py-12" style={{ color: '#4C535B' }}>No vouchers created yet</p>
        ) : (
          <div className="scroll-x table-responsive">
            <table className="table-plain" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Used by</th>
                  <th>Used at</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => (
                  <tr key={v.id}>
                    <td data-label="Code" className="mono" style={{ fontWeight: 600, letterSpacing: '0.18em', color: '#E9E7E2' }}>{v.code}</td>
                    <td data-label="Amount" style={{ color: '#3ECF8E', fontWeight: 600 }}>{fmtKes(v.amount)}</td>
                    <td data-label="Status"><span className={`tag ${tagFor(v.status)}`}>{v.status}</span></td>
                    <td data-label="Used by" style={{ color: '#AEB5BD' }}>{v.used_by_email || '—'}</td>
                    <td data-label="Used at" className="mono" style={{ fontSize: 12, color: '#4C535B' }}>{v.used_at ? new Date(v.used_at).toLocaleString() : '—'}</td>
                    <td data-label="Created" className="mono" style={{ fontSize: 12, color: '#4C535B' }}>{new Date(v.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
