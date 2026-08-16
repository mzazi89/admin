'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then(r => { if (r.ok) router.replace('/admin/dashboard'); });
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) router.push('/admin/dashboard');
      else setError(data.error || 'Invalid credentials');
    } catch { setError('Connection error. Please try again.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-stretch">
      {/* ── Left: auth card ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <Logo size={40} withText />

          <div className="eyebrow mt-12 mb-5">Restricted access</div>
          <h1 className="headline" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>
            Admin<br />Portal
          </h1>
          <p className="lede mt-4 mb-10" style={{ maxWidth: 380 }}>
            Authorized staff only. All admin activity is logged and monitored.
          </p>

          <div className="card card-pad" style={{ padding: '28px' }}>
            {error && (
              <div className="tag tag-red mb-5" style={{ padding: '9px 12px', width: '100%', textTransform: 'none', letterSpacing: '0.02em' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label" htmlFor="admin-email">Admin email</label>
                <input id="admin-email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@mzazi.shop" className="input" autoComplete="username" />
              </div>
              <div>
                <label className="label" htmlFor="admin-password">Password</label>
                <input id="admin-password" type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••" className="input" autoComplete="current-password" />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
                {loading ? 'Authenticating…' : 'Access panel'}
              </button>
            </form>
          </div>

          <p className="mono mt-6" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4C535B' }}>
            Mzazi Tech Inc · 2026
          </p>
        </div>
      </div>

      {/* ── Right: editorial rail (desktop only) ── */}
      <div className="hidden lg:flex w-1/2 items-center justify-center relative"
        style={{ borderLeft: '1px solid #1B2026', backgroundColor: 'rgba(15,18,21,0.45)' }}>
        <div className="max-w-md px-10">
          <div className="eyebrow mb-6">Ops console</div>
          <p className="section-title" style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.2rem)', lineHeight: 1.2 }}>
            One database. One source of truth. Every panel, voucher, order and conversation in a single view.
          </p>
          <div className="mt-10 space-y-4">
            {[
              ['Neon DB', 'shared live with the public site'],
              ['Live sync', 'bot commands and settings within ~15s'],
              ['Full audit', 'transactions, sessions, inquiries'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-4">
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: '#F2A93B', whiteSpace: 'nowrap' }}>{k}</span>
                <span style={{ fontSize: 13, color: '#79818A' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
