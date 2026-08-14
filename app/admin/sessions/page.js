'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Admin: all paired WhatsApp sessions (all users) with pause/resume/unlink/delete.
export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();

  const load = () => {
    fetch('/api/admin/sessions').then(async (r) => {
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setSessions(d.sessions || []);
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

  const run = async (number, action) => {
    if (action === 'unlink' && !window.confirm(`Unlink ${number}? The bot will log it out of WhatsApp (can be paired again).`)) return;
    if (action === 'delete' && !window.confirm(`Delete ${number}? This removes the session folder on the bot and the database row.`)) return;
    setBusy(`${number}:${action}`);
    setNotice('');
    try {
      const res = await fetch('/api/admin/session-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, action }),
      });
      const d = await res.json();
      if (!res.ok) { setNotice(`❌ ${d.error || 'Failed'}`); setBusy(''); return; }
      const label = { unlink: 'Unlinking', delete: 'Deleting' }[action];
      setNotice(`⏳ ${label} ${number}… (bot applies within ~15s)`);
      setTimeout(load, 15000);
    } catch {
      setNotice('❌ Connection error.');
      setBusy('');
    }
  };

  const statusColor = (active) =>
    active
      ? { backgroundColor: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }
      : { backgroundColor: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: '#f0f4ff' }}>📱 WhatsApp Sessions</h1>
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>
            All paired numbers across every user. Active = the session folders the bot currently holds on disk.
            Unlink logs the device out; Delete removes it from the bot&apos;s session folder and the database.
          </p>
        </div>
        <button onClick={() => { setLoading(true); load(); }}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: 'none', cursor: 'pointer' }}>
          ⟳ Refresh
        </button>
      </div>

      {notice && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.3)', color: '#60a5fa' }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : sessions.length === 0 ? (
        <div className="p-8 text-center text-sm rounded-xl" style={{ backgroundColor: '#060b16', border: '1px solid #1e3a8a', color: '#64748b' }}>
          No WhatsApp sessions found yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl scroll-x" style={{ backgroundColor: '#060b16', border: '1px solid #1e3a8a' }}>
          <table className="table-responsive w-full text-sm min-w-[720px]">
            <thead>
              <tr style={{ borderBottom: '1px solid #1e3a8a', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Owner</th>
                <th className="px-4 py-3 text-left">Linked</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(30,58,138,0.35)' }}>
                  <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>{s.id}</td>
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: '#f0f4ff' }}>{s.phoneNumber}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={statusColor(s.active)}>
                      {s.active ? 'Active' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                    {s.email || `#${s.userId ?? '?'}`}
                    {s.firstname && <div className="text-xs" style={{ color: '#475569' }}>{s.firstname} {s.lastname || ''}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>
                    {s.connectedAt ? new Date(s.connectedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => run(s.phoneNumber, 'unlink')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', backgroundColor: 'rgba(96,165,250,0.06)', cursor: 'pointer' }}>
                        Unlink
                      </button>
                      <button onClick={() => run(s.phoneNumber, 'delete')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.06)', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
