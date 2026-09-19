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
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');

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

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 12000);
  };

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
      flash(`Generated ${(data.passwords || []).length} reseller password(s). Share them with buyers — they activate once by sending .panel <password> on WhatsApp.`);
      if (Array.isArray(data.all)) setRows(data.all); else load();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // Set a password yourself instead of having one generated. Whatever string you
  // choose is matched however the reseller types it, so case and punctuation are
  // both fine.
  const createCustom = async () => {
    setError('');
    const code = custom.trim();
    if (!code) { setError('Type the password you want to set first.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save the password');
      setFreshCodes([{ id: data.created?.id, code: data.created?.code || code }]);
      setCustom('');
      flash('Password set. Send it to your reseller — they activate once with .panel <password>.');
      if (Array.isArray(data.passwords)) setRows(data.passwords); else load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const act = async (action, row, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError('');
    setBusy(`${action}:${row.id}`);
    try {
      const res = await fetch('/api/admin/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: row.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That did not work');
      if (Array.isArray(data.passwords)) setRows(data.passwords); else load();
      if (action === 'disable') flash(`${row.code} disabled — it can no longer be activated.`);
      if (action === 'enable') flash(`${row.code} is usable again.`);
      if (action === 'reset') flash(`${row.code} released. It can be activated on a new number.`);
      if (action === 'delete') flash(`${row.code} deleted.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const copyCodes = () => {
    const text = freshCodes.map((c) => c.code).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    flash('Copied — paste it to your reseller.');
  };

  return (
    <div>
      <div className="d-flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="display text-xl font-bold">WhatsApp Panel Resellers</h1>
          <p className="lede mt-1" style={{ maxWidth: 560, fontSize: '0.92rem' }}>
            You set the password; the reseller activates once by sending <code>.panel &lt;password&gt;</code> on
            WhatsApp from their own number. After that they create panels (1GB–10GB / Unlimited) for
            clients for free. One password activates exactly one number.
          </p>
        </div>
      </div>

      {notice && (
        <div className="mt-4 px-4 py-3 text-sm" style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.3)', color: 'var(--good)', borderRadius: 8 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 px-4 py-3 text-sm" style={{ background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.3)', color: 'var(--bad)', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* Set a password yourself */}
      <div className="card mt-5 p-6">
        <h2 className="display text-sm font-bold" style={{ color: 'var(--ink)' }}>Set a password</h2>
        <p className="mt-2" style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 560 }}>
          Type the password you want to give this reseller. It is matched however they type it —
          upper or lower case, with spaces or punctuation, all fine. Then send it to them.
        </p>
        <div className="d-flex mt-4" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createCustom(); }}
            className="input mono"
            placeholder="e.g. MZAZI-RESELL-2024"
            style={{ minWidth: 240, flex: '1 1 240px', letterSpacing: '0.04em' }}
            aria-label="The password to set"
          />
          <button onClick={createCustom} className="btn btn-primary" disabled={saving} style={{ fontSize: 13.5 }}>
            {saving ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </div>

      {/* Generator */}
      <div className="card mt-5 p-6">
        <h2 className="display text-sm font-bold" style={{ color: 'var(--ink)' }}>Or generate random ones</h2>
        <p className="mt-2" style={{ color: 'var(--muted)', fontSize: 13 }}>
          Ten characters, no look-alike pairs, for selling in bulk (KES 400 each, manual sale).
        </p>
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
          <button onClick={generate} className="btn" disabled={generating} style={{ fontSize: 13.5 }}>
            {generating ? 'Generating…' : '＋ Generate'}
          </button>
        </div>

        {freshCodes.length > 0 && (
          <div className="mt-4" style={{ background: 'rgba(242,169,59,0.06)', border: '1px solid rgba(242,169,59,0.35)', borderRadius: 8, padding: '12px 14px' }}>
            <div className="d-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span className="mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--brand)' }}>
                NEW PASSWORDS — share them once (one activation each)
              </span>
              <button onClick={copyCodes} className="btn" style={{ fontSize: 13, padding: '6px 12px' }}>📋 Copy all</button>
            </div>
            <div className="mt-3" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {freshCodes.map((c) => (
                <div key={c.id} className="mono" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line-soft)', borderRadius: 6, padding: '10px 12px', fontSize: 15, letterSpacing: '0.08em', color: 'var(--ink)' }}>
                  {c.code}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card mt-5 p-6">
        <h2 className="display text-sm font-bold" style={{ color: 'var(--ink)' }}>
          Passwords <span style={{ color: 'var(--dim)' }}>({rows.length})</span>
        </h2>
        {loading ? (
          <p className="mt-4" style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : (
          <div className="table-wrap mt-4">
            <table className="table-responsive">
              <thead>
                <tr><th>#</th><th>Password</th><th>Status</th><th>Activated by</th><th>Activated</th><th>Created</th><th>Panels made</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} data-label="" className="py-8 text-center" style={{ color: 'var(--muted)' }}>No reseller passwords yet — set one above.</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td data-label="" className="mono" style={{ color: 'var(--dim)' }}>{i + 1}</td>
                    <td data-label="Password" className="mono" style={{ letterSpacing: '0.06em' }}>{r.code}</td>
                    <td data-label="Status">{r.status === 'active'
                      ? <span className="tag tag-green" title="Claimed by a number">CLAIMED</span>
                      : r.status === 'disabled'
                      ? <span className="tag" style={{ borderColor: 'rgba(229,72,77,0.5)', color: 'var(--bad)' }} title="Cannot be activated">DISABLED</span>
                      : <span className="tag" title="Waiting to be activated">READY</span>}
                    </td>
                    <td data-label="Activated by" className="mono">{r.activated_by || '—'}</td>
                    <td data-label="Activated" className="mono" style={{ fontSize: 13 }}>{r.activated_at ? new Date(r.activated_at).toLocaleString() : '—'}</td>
                    <td data-label="Created" className="mono" style={{ fontSize: 13 }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td data-label="Panels made" className="mono" style={{ color: r.panels_created > 0 ? 'var(--good)' : 'var(--dim)' }}>{r.panels_created || 0}</td>
                    <td data-label="Actions">
                      <div className="d-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {r.status === 'disabled' ? (
                          <button
                            className="btn" style={{ fontSize: 12, padding: '4px 10px' }}
                            disabled={busy === `enable:${r.id}`}
                            onClick={() => act('enable', r)}
                          >Enable</button>
                        ) : (
                          <button
                            className="btn" style={{ fontSize: 12, padding: '4px 10px' }}
                            disabled={busy === `disable:${r.id}`}
                            onClick={() => act('disable', r, `Disable ${r.code}?\n\nIt will no longer activate, and if a number has already claimed it that number stops being a reseller.`)}
                          >Disable</button>
                        )}
                        {r.status === 'active' && (
                          <button
                            className="btn" style={{ fontSize: 12, padding: '4px 10px' }}
                            disabled={busy === `reset:${r.id}`}
                            onClick={() => act('reset', r, `Release ${r.code} from ${r.activated_by}?\n\nThe number loses reseller access and the password can be activated again by someone else.`)}
                          >Release</button>
                        )}
                        <button
                          className="btn" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--bad)' }}
                          disabled={busy === `delete:${r.id}`}
                          onClick={() => act('delete', r, `Delete ${r.code} permanently?\n\nIf a number has claimed it, that number stops being a reseller. This cannot be undone.`)}
                        >Delete</button>
                      </div>
                    </td>
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
