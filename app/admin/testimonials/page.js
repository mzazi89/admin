'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function Stars({ value }) {
  return (
    <span className="mono" style={{ color: '#F2A93B', letterSpacing: '3px', fontSize: 12 }} aria-label={`${value} out of 5 stars`}>
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
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow mb-4">Social proof</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Testimonials</h1>
      </div>

      {msg && (
        <div className="tag tag-green mb-5" style={{ padding: '9px 12px', textTransform: 'none', letterSpacing: '0.02em' }}>
          {msg}
        </div>
      )}

      {/* Segmented filter */}
      <div className="flex gap-2 mb-6">
        {[['pending', 'Pending'], ['approved', 'Approved'], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className="mono btn"
            style={{
              fontSize: 11, padding: '8px 16px',
              backgroundColor: tab === v ? '#F2A93B' : 'transparent',
              color: tab === v ? '#14100A' : '#79818A',
              border: `1px solid ${tab === v ? '#F2A93B' : '#262C33'}`,
              cursor: 'pointer',
            }}>
            {l}
          </button>
        ))}
      </div>

      {!list ? (
        <div className="flex items-center justify-center py-16"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="mono" style={{ color: '#4C535B' }}>No {tab} testimonials.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '8px 24px' }}>
          {list.map((t, i) => (
            <div key={t.id} className="py-5" style={{ borderTop: i === 0 ? 'none' : '1px solid #1B2026' }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-3">
                  <strong className="section-title" style={{ fontSize: '0.95rem' }}>{t.name}</strong>
                  <Stars value={t.rating} />
                </div>
                <span className={`tag ${t.approved ? 'tag-green' : 'tag-amber'}`}>
                  {t.approved ? 'Approved' : 'Pending'}
                </span>
              </div>
              <p className="lede mb-2" style={{ fontSize: '0.92rem', maxWidth: 640 }}>{t.message}</p>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="mono" style={{ fontSize: 10.5, color: '#4C535B', margin: 0 }}>
                  {new Date(t.created_at).toLocaleString()}
                </p>
                <div className="flex gap-2">
                  {!t.approved && (
                    <button onClick={() => approve(t.id)} disabled={busy} className="btn btn-primary"
                      style={{ fontSize: 10, padding: '7px 14px' }}>Approve</button>
                  )}
                  {t.approved && (
                    <button onClick={() => hide(t.id)} disabled={busy} className="btn btn-ghost"
                      style={{ fontSize: 10, padding: '7px 14px' }}>Hide</button>
                  )}
                  <button onClick={() => del(t.id)} disabled={busy} className="btn btn-danger"
                    style={{ fontSize: 10, padding: '7px 14px' }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
