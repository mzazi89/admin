'use client';
import { useState, useEffect } from 'react';
import TypingHeading from '@/components/TypingHeading';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(6,8,16,0.78)' }}>
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(239,68,68,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 40px rgba(220,38,38,0.3)' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <TypingHeading as="h1" text="Admin Portal" speed={55} className="text-2xl font-extrabold" style={{ color: '#f0f4ff' }} />
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>Restricted access — Mzazi Tech Inc.</p>
        </div>
        <div className="rounded-2xl p-8" style={{ backgroundColor: '#0f1117', border: '1px solid #1e3a8a' }}>
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#94a3b8' }}>Admin Email</label>
              <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@mzazi.shop" className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: '#04070f', border: '1px solid #1e3a8a', color: '#f0f4ff' }}
                onFocus={e => e.target.style.borderColor = '#dc2626'} onBlur={e => e.target.style.borderColor = '#1e3a8a'} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#94a3b8' }}>Password</label>
              <input type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••" className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: '#04070f', border: '1px solid #1e3a8a', color: '#f0f4ff' }}
                onFocus={e => e.target.style.borderColor = '#dc2626'} onBlur={e => e.target.style.borderColor = '#1e3a8a'} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm mt-2"
              style={{ background: loading ? '#1e3a8a' : 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: loading ? 'none' : '0 0 30px rgba(220,38,38,0.3)', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Authenticating...' : 'Access Admin Panel'}
            </button>
          </form>
        </div>
        <p className="text-center mt-6 text-xs" style={{ color: '#374151' }}>All admin activity is logged and monitored.</p>
      </div>
    </div>
  );
}
