'use client';
import { useState, useEffect } from 'react';
import StarRating from './StarRating';
import Link from 'next/link';


function TestimonialCard({ testimonial }) {
  const date = new Date(testimonial.created_at).toLocaleDateString('en-KE', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const initials = testimonial.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div
      style={{
        backgroundColor: 'rgba(22,24,42,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1e3a8a',
        borderRadius: '16px',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,99,235,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ color: '#2563eb', fontSize: '32px', lineHeight: 1, opacity: 0.6 }}>"</div>
      <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.7', flex: 1 }}>{testimonial.message}</p>
      <StarRating value={testimonial.rating} readonly />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px', borderTop: '1px solid #1e3a8a' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '14px', color: '#fff', flexShrink: 0,
        }}>{initials}</div>
        <div>
          <div style={{ color: '#f0f4ff', fontWeight: 600, fontSize: '14px' }}>{testimonial.name}</div>
          <div style={{ color: '#475569', fontSize: '12px' }}>{date}</div>
        </div>
      </div>
    </div>
  );
}

function TestimonialForm({ onSubmitted }) {
  const [form, setForm] = useState({ name: '', rating: 0, message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.rating) { setError('Please select a star rating.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      setSuccess(true);
      setForm({ name: '', rating: 0, message: '' });
      if (onSubmitted) onSubmitted(data.testimonial);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  if (success) {
    return (
      <div style={{ backgroundColor: 'rgba(22,24,42,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(37,99,235,0.4)', borderRadius: '16px', padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
        <h3 style={{ color: '#f0f4ff', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Thank You!</h3>
        <p style={{ color: '#64748b' }}>Your testimonial has been submitted successfully. It will appear after a quick approval.</p>
        <button onClick={() => setSuccess(false)} style={{ marginTop: '20px', padding: '10px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          Add Another
        </button>
      </div>
    );
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    backgroundColor: 'rgba(2,4,9,0.70)', backdropFilter: 'blur(6px)',
    border: '1px solid #1e3a8a', color: '#f0f4ff', fontSize: '15px',
    outline: 'none', transition: 'border-color 0.2s',
  };

  return (
    <form onSubmit={handleSubmit} style={{ backgroundColor: 'rgba(22,24,42,0.85)', backdropFilter: 'blur(8px)', border: '1px solid #1e3a8a', borderRadius: '16px', padding: '32px' }}>
      <h3 style={{ color: '#f0f4ff', fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Share Your Experience</h3>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', fontSize: '14px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Name *</label>
        <input type="text" placeholder="e.g. John Kamau" value={form.name} required
          onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#2563eb'}
          onBlur={e => e.target.style.borderColor = '#1e3a8a'} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Rating *</label>
        <StarRating value={form.rating} onChange={r => setForm({ ...form, rating: r })} />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Testimonial *</label>
        <textarea placeholder="Tell others about your experience with MZAZI TECH..." value={form.message} required rows={5}
          onChange={e => setForm({ ...form, message: e.target.value })}
          style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
          onFocus={e => e.target.style.borderColor = '#2563eb'}
          onBlur={e => e.target.style.borderColor = '#1e3a8a'} />
        <div style={{ color: '#475569', fontSize: '12px', marginTop: '6px', textAlign: 'right' }}>{form.message.length} / 1000</div>
      </div>

      <button type="submit" disabled={loading} style={{
        width: '100%', padding: '14px', borderRadius: '12px',
        background: loading ? '#1e3a8a' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        color: loading ? '#64748b' : '#fff', fontWeight: 700, fontSize: '16px',
        border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
        boxShadow: loading ? 'none' : '0 0 24px rgba(37,99,235,0.35)', transition: 'all 0.2s',
      }}>
        {loading ? 'Submitting…' : 'Submit Testimonial'}
      </button>
    </form>
  );
}

const INITIAL_LIMIT = 6;
const MORE_LIMIT = 10;

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = async (offset, limit) => {
    const res = await fetch(`/api/testimonials?offset=${offset}&limit=${limit}`);
    const data = await res.json();
    return data;
  };

  useEffect(() => {
    fetchPage(0, INITIAL_LIMIT)
      .then(data => {
        setTestimonials(data.testimonials || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await fetchPage(testimonials.length, MORE_LIMIT);
      setTestimonials(prev => [...prev, ...(data.testimonials || [])]);
      setTotal(data.total || total);
    } catch {}
    finally { setLoadingMore(false); }
  };

  const handleNewTestimonial = (t) => {
    setTestimonials(prev => [t, ...prev]);
    setTotal(prev => prev + 1);
  };

  const avgRating = testimonials.length
    ? (testimonials.reduce((s, t) => s + t.rating, 0) / testimonials.length).toFixed(1)
    : null;

  const hasMore = testimonials.length < total;

  return (
    <section style={{ backgroundColor: 'transparent', padding: '80px 0', position: 'relative' }}>
      <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '99px', marginBottom: '20px',
            backgroundColor: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)',
          }}>
            <span style={{ color: '#facc15', fontSize: '16px' }}>★</span>
            <span style={{ color: '#60a5fa', fontSize: '14px', fontWeight: 600 }}>
              {avgRating ? `${avgRating} avg rating · ` : ''}{total} {total === 1 ? 'review' : 'reviews'}
            </span>
          </div>
          <h2 style={{ color: '#f0f4ff', fontSize: '36px', fontWeight: 800, marginBottom: '12px' }}>What Our Clients Say</h2>
          <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '480px', margin: '0 auto' }}>
            Real experiences from real customers worldwide.
          </p>
          <div style={{ marginTop: '16px' }}>
            <Link href="/testimonials" style={{ color: '#60a5fa', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
              View all reviews →
            </Link>
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '40px 0' }}>Loading testimonials…</div>
        ) : testimonials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', backgroundColor: 'rgba(22,24,42,0.85)', backdropFilter: 'blur(8px)', border: '1px solid #1e3a8a', borderRadius: '16px', marginBottom: '48px', color: '#64748b' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
            <p>No testimonials yet — be the first to share your experience!</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              {testimonials.map(t => <TestimonialCard key={t.id} testimonial={t} />)}
            </div>

            {/* See More */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '12px 36px', borderRadius: '12px',
                    backgroundColor: 'rgba(37,99,235,0.1)',
                    color: '#60a5fa', border: '1px solid rgba(37,99,235,0.35)',
                    fontWeight: 600, fontSize: '15px', cursor: loadingMore ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.backgroundColor = 'rgba(37,99,235,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(37,99,235,0.1)'; }}
                >
                  {loadingMore ? 'Loading…' : `See More (${total - testimonials.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}

        {/* Submit form */}
        <div style={{ maxWidth: '600px', margin: '32px auto 0' }}>
          <TestimonialForm onSubmitted={handleNewTestimonial} />
        </div>
      </div>
    </section>
  );
}
