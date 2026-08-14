'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fmtMtc, fmtMtcValue, mtcToKsh } from '@/lib/currency';

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

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login'); };

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
        setMessage({ type: 'success', text: `Voucher ${code.trim().toUpperCase()} activated for ${fmtMtc(amount)}` });
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

  const navTabs = [
    { href: '/admin/dashboard', label: 'Overview' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/transactions', label: 'Transactions' },
    { href: '/admin/inquiries', label: 'Inquiries' },
    { href: '/admin/packages', label: 'Packages' },
    { href: '/admin/vouchers', label: 'Vouchers & Recoveries', active: true },
  ];

  const statusColor = (s) => s === 'active' ? '#4ade80' : s === 'used' ? '#64748b' : '#fb923c';
  const statusBg = (s) => s === 'active' ? 'rgba(74,222,128,0.1)' : s === 'used' ? 'rgba(100,116,139,0.1)' : 'rgba(251,146,60,0.1)';

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
          <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>Sign Out</button>
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

        <h1 className="text-2xl font-extrabold mb-6" style={{ color: '#f0f4ff' }}>Vouchers &amp; Recoveries</h1>

        {/* Alert */}
        {message && (
          <div className="mb-6 p-4 rounded-xl text-sm" style={{
            backgroundColor: message.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: message.type === 'success' ? '#4ade80' : '#f87171',
          }}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Create Voucher Form */}
          <div className="lg:col-span-1 rounded-2xl p-6" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#475569' }}>Create &amp; Activate Voucher</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#64748b' }}>Voucher Code (6 characters)</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-mono tracking-widest"
                  style={{ backgroundColor: '#04070f', border: '1px solid #1e3a8a', color: '#f0f4ff' }}
                  required
                />
                <p className="mt-1 text-xs" style={{ color: '#374151' }}>{code.length}/6 characters</p>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#64748b' }}>Amount (MTC)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: '#04070f', border: '1px solid #1e3a8a', color: '#f0f4ff' }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={creating || code.length !== 6 || !amount}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#fff',
                  opacity: (creating || code.length !== 6 || !amount) ? 0.5 : 1,
                  cursor: (creating || code.length !== 6 || !amount) ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? 'Activating...' : 'Activate Code'}
              </button>
            </form>

            <div className="mt-6 p-3 rounded-xl text-xs" style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', color: '#64748b', lineHeight: 1.6 }}>
              <span style={{ color: '#4ade80', fontWeight: 600 }}>How it works:</span><br />
              Enter any 6-character code (letters/numbers), set the amount in MTC, then click Activate Code. The code is immediately usable by one member to credit their wallet.
            </div>
          </div>

          {/* Stats */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
            {[
              { label: 'Total Vouchers', value: vouchers.length, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
              { label: 'Active (unused)', value: vouchers.filter(v => v.status === 'active').length, color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
              { label: 'Used', value: vouchers.filter(v => v.status === 'used').length, color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-5" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
                <div className="text-3xl font-extrabold mb-1" style={{ color: c.color }}>{c.value}</div>
                <div className="text-xs" style={{ color: '#64748b' }}>{c.label}</div>
              </div>
            ))}
            <div className="sm:col-span-3 rounded-2xl p-5" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
              <div className="text-2xl font-extrabold mb-1" style={{ color: '#a78bfa' }}>
                {fmtMtc(vouchers.filter(v => v.status === 'used').reduce((s, v) => s + parseFloat(v.amount), 0))}
              </div>
              <div className="text-xs" style={{ color: '#64748b' }}>Total redeemed via vouchers</div>
            </div>
          </div>
        </div>

        {/* Vouchers Table */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #1e3a8a' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>All Vouchers ({vouchers.length})</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vouchers.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: '#374151' }}>No vouchers created yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e3a8a' }}>
                    {['Code', 'Amount', 'Status', 'Used By', 'Used At', 'Created'].map(h => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v, i) => (
                    <tr key={v.id} style={{ borderBottom: i < vouchers.length - 1 ? '1px solid #1e3a8a' : 'none' }}>
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-sm tracking-widest" style={{ color: '#f0f4ff' }}>{v.code}</span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold" style={{ color: '#4ade80' }}>
                        {fmtMtc(v.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: statusBg(v.status), color: statusColor(v.status), border: `1px solid ${statusColor(v.status)}40` }}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: '#94a3b8' }}>{v.used_by_email || '—'}</td>
                      <td className="px-5 py-4 text-xs" style={{ color: '#475569' }}>
                        {v.used_at ? new Date(v.used_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-4 text-xs" style={{ color: '#475569' }}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
