'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Admin: all paired WhatsApp sessions (all users) with pause/resume/unlink/delete.
export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();

  // With one bot there is nothing to disambiguate and the Bot column is hidden,
  // so a single-bot deployment looks exactly as it did before.
  const multipleBots = bots.length > 1;
  const botName = (id) => {
    const found = bots.find((b) => b.id === id);
    return found ? found.name : id;
  };

  const load = () => {
    fetch('/api/admin/sessions').then(async (r) => {
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setSessions(d.sessions || []);
      setBots(d.bots || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (session, action) => {
    const number = session.phoneNumber;
    // Naming the bot in the confirmation matters: with two bots the operator is
    // about to log a device out of one of them, and the rows look otherwise
    // identical. The server also resolves the owner from telemetry, so a wrong
    // guess here cannot misroute the action — this is so the operator knows
    // which bot they are acting on.
    const onBot = multipleBots && session.bot ? ` from ${botName(session.bot)}` : '';
    if (action === 'unlink' && !window.confirm(`Unlink ${number}${onBot}? The bot will log it out of WhatsApp (can be paired again).`)) return;
    if (action === 'delete' && !window.confirm(`Delete ${number}${onBot}? This removes the session folder on the bot and the database row.`)) return;
    setBusy(`${number}:${action}`);
    setNotice('');
    try {
      const res = await fetch('/api/admin/session-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, action, bot: session.bot || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setNotice(d.error || 'Failed'); setBusy(''); return; }
      const label = { unlink: 'Unlinking', delete: 'Deleting' }[action];
      setNotice(`${label} ${number}… (bot applies within ~15s)`);
      setTimeout(load, 15000);
    } catch {
      setNotice('Connection error.');
      setBusy('');
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow mb-4">Pairings</div>
          <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>WhatsApp sessions</h1>
          <p className="lede mt-3" style={{ maxWidth: 640, fontSize: '0.9rem' }}>
            All paired numbers across every user. Active = the session folders the bot currently holds on disk.
            Unlink logs the device out; Delete removes it from the bot&apos;s session folder and the database.
          </p>
        </div>
        <button onClick={() => { setLoading(true); load(); }} className="btn btn-ghost" style={{ fontSize: 11 }}>
          Refresh
        </button>
      </div>

      {notice && (
        <div className="tag mb-5" style={{ padding: '10px 14px', width: '100%', textTransform: 'none', letterSpacing: '0.02em', color: '#AEB5BD' }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : sessions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="mono" style={{ color: '#4C535B' }}>No WhatsApp sessions found yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="scroll-x table-responsive">
              <table className="table-plain" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Number</th>
                    <th>Status</th>
                    {multipleBots && <th>Bot</th>}
                    <th>Owner</th>
                    <th>Linked</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="mono" style={{ color: '#4C535B', fontSize: 12 }}>{s.id}</td>
                      <td className="mono" style={{ fontWeight: 600, letterSpacing: '0.06em', color: '#E9E7E2' }}>{s.phoneNumber}</td>
                      <td>
                        <span className={`tag ${s.active ? 'tag-green' : ''}`}>
                          <span className="dot" style={{ color: s.active ? '#3ECF8E' : '#4C535B', marginRight: 2 }} />
                          {s.active ? 'Active' : 'Offline'}
                        </span>
                      </td>
                      {multipleBots && (
                        <td className="mono" style={{ fontSize: 11, color: s.bot ? '#F2A93B' : '#4C535B' }}>
                          {s.bot ? botName(s.bot) : '—'}
                        </td>
                      )}
                      <td style={{ color: '#AEB5BD' }}>
                        {s.email || `#${s.userId ?? '?'}`}
                        {s.firstname && <div className="mono" style={{ fontSize: 11, color: '#4C535B' }}>{s.firstname} {s.lastname || ''}</div>}
                      </td>
                      <td className="mono" style={{ color: '#4C535B', fontSize: 12 }}>
                        {s.connectedAt ? new Date(s.connectedAt).toLocaleString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => run(s, 'unlink')} className="btn btn-dark" style={{ fontSize: 10, padding: '6px 12px', marginRight: 6 }}>
                          Unlink
                        </button>
                        <button onClick={() => run(s, 'delete')} className="btn btn-danger" style={{ fontSize: 10, padding: '6px 12px' }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile rows */}
          <div className="md:hidden space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="card" style={{ padding: '16px' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="mono" style={{ fontSize: 11, color: '#4C535B' }}>#{s.id}</span>
                  <span className={`tag ${s.active ? 'tag-green' : ''}`} style={{ fontSize: 9.5, padding: '2px 8px' }}>
                    {s.active ? 'Active' : 'Offline'}
                  </span>
                </div>

                {multipleBots && (
                  <div className="mono mb-2" style={{ fontSize: 10.5, color: s.bot ? '#F2A93B' : '#4C535B' }}>
                    {s.bot ? botName(s.bot) : 'bot unknown'}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="mono" style={{ fontWeight: 700, fontSize: 15, color: '#E9E7E2', margin: 0, overflowWrap: 'anywhere' }}>{s.phoneNumber}</p>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(s.phoneNumber); setNotice(`Copied ${s.phoneNumber}`); setTimeout(() => setNotice(''), 2500); }}
                    className="btn btn-dark flex-shrink-0"
                    style={{ fontSize: 10, padding: '6px 12px' }}>
                    Copy
                  </button>
                </div>

                <div className="mono space-y-1 mb-3" style={{ fontSize: 11, color: '#79818A' }}>
                  <div className="truncate">
                    <span style={{ color: '#AEB5BD' }}>{s.email || `user #${s.userId ?? '?'}`}</span>
                    {s.firstname ? ` — ${s.firstname} ${s.lastname || ''}` : ''}
                  </div>
                  <div>{s.connectedAt ? `Linked ${new Date(s.connectedAt).toLocaleString()}` : 'Not connected'}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => run(s, 'unlink')} className="btn btn-ghost" style={{ fontSize: 10, padding: '9px' }}>Unlink</button>
                  <button onClick={() => run(s, 'delete')} className="btn btn-danger" style={{ fontSize: 10, padding: '9px' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
