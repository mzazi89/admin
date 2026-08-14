'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function Stars({ value }) {
  return (
    <span className="text-sm" style={{ color: '#facc15', letterSpacing: '2px' }}>
      {'★'.repeat(value)}{'☆'.repeat(5 - value)}
    </span>
  );
}

export default function AdminTestimonials() {
  const router = useRouter();
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/testimonials?status=${tab}`);
    if (!res.ok) return;
    const d = await res.json();
    setList(d.testimonials);
  }, [tab]);

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    }).catch(() => router.replace('/admin/login'));
  }, [load]);

  const act = async (id, fn) => {
    setBusy(true);
    try {
      const res = await fn(id);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Action failed');
      setMsg(d.message);
      setTimeout(() => setMsg(''), 2500);
      await load();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const approve = (id) => act(id, (i) => fetch('/api/admin/testimonials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i, approved: true }) }));
  const hide = (id) => act(id, (i) => fetch('/api/admin/testimonials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i, approved: false }) }));
  const del = (id) => { if (confirm('Delete this testimonial?')) act(id, (i) => fetch('/api/admin/testimonials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i }) })); };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12" style={{ minHeight: '70vh' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold" style={{ color: '#f0f4ff' }}>⭐ Testimonials</h1>
        <a href="/admin/dashboard" className="text-xs" style={{ color: '#60a5fa', textDecoration: 'none' }}>← Back to admin</a>
      </div>

      {msg && <p className="text-sm mb-4" style={{ color: '#4ade80' }}>{msg}</p>}

      <div className="flex gap-2 mb-6">
        {[['pending', 'Pending'], ['approved', 'Approved'], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              backgroundColor: tab === v ? 'rgba(37,99,235,0.15)' : 'transparent',
              color: tab === v ? '#60a5fa' : '#94a3b8',
              border: `1px solid ${tab === v ? 'rgba(37,99,235,0.4)' : '#1e3a8a'}`,
              cursor: 'pointer',
            }}>
            {l}
          </button>
        ))}
      </div>

      {!list ? (
        <p className="text-sm" style={{ color: '#64748b' }}>Loading…</p>
      ) : list.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: '#64748b' }}>No {tab} testimonials.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(t => (
            <div key={t.id} className="p-5 rounded-2xl" style={{ backgroundColor: '#060b16', border: '1px solid #1e3a8a' }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <strong className="text-sm" style={{ color: '#f0f4ff' }}>{t.name}</strong>
                  <Stars value={t.rating} />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ backgroundColor: t.approved ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)', color: t.approved ? '#4ade80' : '#fbbf24' }}>
                  {t.approved ? 'APPROVED' : 'PENDING'}
                </span>
              </div>
              <p className="text-sm mb-3" style={{ color: '#94a3b8' }}>{t.message}</p>
              <p className="text-[10px] mb-3" style={{ color: '#475569' }}>{new Date(t.created_at).toLocaleString()}</p>
              <div className="flex gap-2">
                {!t.approved && (
                  <button onClick={() => approve(t.id)} disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', cursor: 'pointer' }}>Approve</button>
                )}
                {t.approved && (
                  <button onClick={() => hide(t.id)} disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid #1e3a8a', color: '#94a3b8', cursor: 'pointer' }}>Hide</button>
                )}
                <button onClick={() => del(t.id)} disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
