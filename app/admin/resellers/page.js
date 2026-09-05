'use client';
import { useState, useEffect, useCallback } from 'react';

export default function ResellersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [count, setCount] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [freshCodes, setFreshCodes] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/resellers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRows(data.passwords || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setError('');
    setGenerating(true);
    setFreshCodes([]);
    try {
      const res = await fetch('/api/admin/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parseInt(count) || 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      setFreshCodes(data.passwords || []);
      setNotice(`Generated ${(data.passwords || []).length} reseller password(s). Share them with buyers — they activate once by sending .panel <password> on WhatsApp.`);
      setTimeout(() => setNotice(''), 12000);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyCodes = () => {
    const text = freshCodes.map((c) => c.code).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    setNotice('Codes copied — paste them to your buyer.');
    setTimeout(() => setNotice(''), 5000);
  };

  return (
    <div>
      <div className="d-flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="display text-xl font-bold">WhatsApp Panel Resellers</h1>
          <p className="lede mt-1" style={{ maxWidth: 560, fontSize: '0.92rem' }}>
            Generate passwords you sell (KES 400 each, manual sale). A buyer activates once by sending <code>.panel &lt;password&gt;</code> on WhatsApp — after that they create panels (1GB–10GB / Unlimited) for clients for free.
          </p>
        </div>
      </div>

      {notice && (
        <div className="mt-4 px-4 py-3 text-sm" style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.3)', color: '#3ECF8E', borderRadius: 8 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 px-4 py-3 text-sm" style={{ background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.3)', color: '#E5484D', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* Generator */}
      <div className="card mt-5 p-6">
        <h2 className="display text-sm font-bold" style={{ color: '#E9E7E2' }}>Generate passwords</h2>
        <div className="d-flex mt-4" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="input"
            style={{ width: 90 }}
            aria-label="How many passwords"
          />
          <button onClick={generate} className="btn btn-primary" disabled={generating} style={{ fontSize: 13 }}>
            {generating ? 'Generating…' : '＋ Generate'}
          </button>
        </div>

        {freshCodes.length > 0 && (
          <div className="mt-4" style={{ background: 'rgba(242,169,59,0.06)', border: '1px solid rgba(242,169,59,0.35)', borderRadius: 8, padding: '12px 14px' }}>
            <div className="d-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span className="mono text-[10px] uppercase tracking-[0.14em]" style={{ color: '#F2A93B' }}>
                NEW PASSWORDS — share them once (one activation each)
              </span>
              <button onClick={copyCodes} className="btn" style={{ fontSize: 12, padding: '6px 12px' }}>📋 Copy all</button>
            </div>
            <div className="mt-3" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {freshCodes.map((c) => (
                <div key={c.id} className="mono" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid #1B2026', borderRadius: 6, padding: '10px 12px', fontSize: 15, letterSpacing: '0.08em', color: '#E9E7E2' }}>
                  {c.code}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card mt-5 p-6">
        <h2 className="display text-sm font-bold" style={{ color: '#E9E7E2' }}>
          Passwords <span style={{ color: '#4C535B' }}>({rows.length})</span>
        </h2>
        {loading ? (
          <p className="mt-4" style={{ color: '#79818A' }}>Loading…</p>
        ) : (
          <div className="table-wrap mt-4">
            <table>
              <thead>
                <tr><th>#</th><th>Code</th><th>Status</th><th>Activated by</th><th>Activated</th><th>Created</th><th>Panels made</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center" style={{ color: '#79818A' }}>No reseller passwords yet — generate some above.</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ color: '#4C535B' }}>{i + 1}</td>
                    <td className="mono" style={{ letterSpacing: '0.06em' }}>{r.code}</td>
                    <td>{r.status === 'active'
                      ? <span className="tag tag-green">ACTIVE</span>
                      : <span className="tag">UNUSED</span>}
                    </td>
                    <td className="mono">{r.activated_by || '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.activated_at ? new Date(r.activated_at).toLocaleString() : '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td className="mono" style={{ color: r.panels_created > 0 ? '#3ECF8E' : '#4C535B' }}>{r.panels_created || 0}</td>
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
