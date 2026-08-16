'use client';
import { useState, useEffect, useCallback } from 'react';

function fmtAgo(sec) {
  if (sec === null || sec === undefined) return 'never';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m ago`;
}
function fmtUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

export default function BotControlPage() {
  const [status, setStatus] = useState(null);
  const [controls, setControls] = useState([]);
  const [apiKeyCfg, setApiKeyCfg] = useState({ configured: false, key: '' });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [msg, setMsg] = useState('');
  const [botName, setBotName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [sRes, cRes, kRes] = await Promise.all([
        fetch('/api/admin/bot-status'),
        fetch('/api/admin/bot-control'),
        fetch('/api/admin/bot-config'),
      ]);
      if (sRes.ok) {
        const s = await sRes.json();
        setStatus(s.statuses?.[0] || null);
      }
      if (cRes.ok) {
        const c = await cRes.json();
        setControls(c.controls || []);
      }
      if (kRes.ok) {
        const k = await kRes.json();
        setApiKeyCfg({ configured: !!k.configured, key: k.key || '' });
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const saveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch('/api/admin/bot-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save key');
      setApiKeyCfg({ configured: true, key: apiKeyInput.trim() });
      setApiKeyInput('');
      setNotice('Bot API key saved. The bot will authenticate on its next sync (or restart the bot to apply immediately).');
      load();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const issue = async (action, payload = {}, successMsg) => {
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch('/api/admin/bot-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue control');
      setNotice(`${successMsg || 'Control issued'} — the bot picks it up within ~15 seconds.`);
      setMsg('');
      setBotName('');
      load();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const online = !!status?.online;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow mb-4">Runtime</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Bot control</h1>
        <p className="lede mt-3" style={{ maxWidth: 620, fontSize: '0.92rem' }}>
          Live status from the running bot (heartbeat every 30s) and remote control actions.
        </p>
      </div>

      {notice && (
        <div className="tag mb-5" style={{
          padding: '10px 14px', width: '100%', textTransform: 'none', letterSpacing: '0.02em',
          backgroundColor: notice.includes('Error') || notice.includes('Failed') ? 'rgba(229,72,77,0.06)' : 'rgba(62,207,142,0.06)',
          borderColor: notice.includes('Error') || notice.includes('Failed') ? 'rgba(229,72,77,0.35)' : 'rgba(62,207,142,0.35)',
          color: notice.includes('Error') || notice.includes('Failed') ? '#E5484D' : '#3ECF8E',
        }}>
          {notice}
        </div>
      )}

      {/* Status panel */}
      <div className="card mb-5" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-5">
          <span className="dot" style={{ width: 10, height: 10, backgroundColor: online ? '#3ECF8E' : '#E5484D' }} />
          <h2 className="section-title" style={{ fontSize: '1.15rem', margin: 0 }}>{online ? 'Bot online' : 'Bot offline'}</h2>
          {status?.lastSeenAgoSeconds !== null && (
            <span className="mono" style={{ color: '#4C535B', fontSize: 11 }}>— last seen {fmtAgo(status?.lastSeenAgoSeconds)}</span>
          )}
        </div>
        <div className="grid-2-responsive" style={{ gap: 1, backgroundColor: '#1B2026', border: '1px solid #262C33', borderRadius: 4, overflow: 'hidden' }}>
          {[
            ['Version', status?.version || '—'],
            ['Uptime', status?.uptimeSeconds ? fmtUptime(status.uptimeSeconds) : '—'],
            ['Telegram', status?.telegramOnline ? 'Online' : 'Offline'],
            ['WhatsApp sessions', String(status?.whatsappSessions ?? '—')],
            ['Command count', String(status?.commandCount ?? '—')],
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#14181D', padding: '14px 16px' }}>
              <div className="mono" style={{ color: '#4C535B', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
              <div className="mono" style={{ color: '#E9E7E2', fontWeight: 600, fontSize: 14 }}>{value}</div>
            </div>
          ))}
        </div>
        <p className="mono mt-4" style={{ fontSize: 11, color: '#4C535B', margin: 0 }}>
          Last command sync: {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'never'}
          {status?.lastSyncError && <span style={{ color: '#E5484D' }}> — {status.lastSyncError}</span>}
        </p>
      </div>

      {/* API key */}
      <div className="card mb-5" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-1">
          <h3 className="section-title" style={{ fontSize: '1rem', margin: 0 }}>Bot API key</h3>
          {apiKeyCfg.configured
            ? <span className="tag tag-green" style={{ fontSize: 9.5, padding: '2px 8px' }}>Configured</span>
            : <span className="tag tag-red" style={{ fontSize: 9.5, padding: '2px 8px' }}>Not set — bot cannot download commands</span>}
        </div>
        <p className="lede mb-4" style={{ fontSize: '0.88rem', maxWidth: 640 }}>
          Shared secret between the website and the bot.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={apiKeyCfg.configured ? 'Type a new key to replace…' : "Paste the BOT_API_KEY from your bot's .env"}
            className="input mono"
            style={{ maxWidth: 420, fontSize: 13 }}
          />
          <button onClick={saveApiKey} disabled={busy || !apiKeyInput.trim()} className="btn btn-primary" style={{ opacity: busy || !apiKeyInput.trim() ? 0.5 : 1 }}>
            {busy ? 'Saving…' : 'Save key'}
          </button>
          {apiKeyCfg.configured && (
            <button
              onClick={() => { navigator.clipboard.writeText(apiKeyCfg.key); setNotice('Key copied — paste it into the bot\'s .env if needed.'); }}
              className="btn btn-ghost"
            >
              Copy key
            </button>
          )}
        </div>
      </div>

      {/* Control panel — asymmetric: sync + rename side by side, broadcast full width */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div className="card" style={{ padding: '22px' }}>
          <div className="eyebrow mb-3" style={{ fontSize: 10 }}>Registry</div>
          <h3 className="section-title mb-2" style={{ fontSize: '1rem' }}>Sync commands</h3>
          <p className="lede mb-4" style={{ fontSize: '0.85rem' }}>Force the bot to re-fetch the command registry from the website.</p>
          <button onClick={() => issue('sync', {}, 'Sync requested')} disabled={busy || !online} className="btn btn-primary" style={{ opacity: busy || !online ? 0.5 : 1 }}>
            {busy ? 'Sending…' : 'Sync now'}
          </button>
        </div>

        <div className="card" style={{ padding: '22px' }}>
          <div className="eyebrow mb-3" style={{ fontSize: 10 }}>Identity</div>
          <h3 className="section-title mb-2" style={{ fontSize: '1rem' }}>Change bot name</h3>
          <input
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="New WhatsApp profile name"
            className="input"
            style={{ marginBottom: 12, fontSize: 13.5 }}
          />
          <button onClick={() => issue('botname', { name: botName }, 'Rename queued')} disabled={busy || !online || !botName.trim()} className="btn btn-primary" style={{ opacity: busy || !online || !botName.trim() ? 0.5 : 1 }}>
            {busy ? 'Sending…' : 'Rename bot'}
          </button>
        </div>

        <div className="card md:col-span-2" style={{ padding: '22px' }}>
          <div className="eyebrow mb-3" style={{ fontSize: 10 }}>Outreach</div>
          <h3 className="section-title mb-2" style={{ fontSize: '1rem' }}>Broadcast</h3>
          <p className="lede mb-3" style={{ fontSize: '0.85rem' }}>Message to send to all groups of every WhatsApp session.</p>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={3}
            placeholder="Message to send to all groups of every WhatsApp session…"
            className="input"
            style={{ marginBottom: 12, resize: 'vertical', fontSize: 13.5 }}
          />
          <button onClick={() => issue('broadcast', { message: msg }, 'Broadcast queued')} disabled={busy || !online || !msg.trim()} className="btn btn-primary" style={{ opacity: busy || !online || !msg.trim() ? 0.5 : 1 }}>
            {busy ? 'Sending…' : 'Broadcast'}
          </button>
        </div>
      </div>

      {/* Control history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #262C33' }}>
          <p className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#79818A', margin: 0 }}>
            Control history
          </p>
        </div>
        {controls.length === 0 ? (
          <p className="mono py-8 text-center" style={{ color: '#4C535B' }}>No controls issued yet.</p>
        ) : (
          <div className="scroll-x table-responsive">
            <table className="table-plain" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Payload</th>
                  <th>Status</th>
                  <th>Result</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Action" className="mono" style={{ color: '#E9E7E2', fontWeight: 600 }}>{c.action}</td>
                    <td data-label="Payload" className="mono" style={{ color: '#AEB5BD', fontSize: 12 }}>{JSON.stringify(c.payload).slice(0, 60)}</td>
                    <td data-label="Status">
                      <span className={`tag ${c.status === 'done' ? 'tag-green' : c.status === 'failed' ? 'tag-red' : 'tag-amber'}`}>{c.status}</span>
                    </td>
                    <td data-label="Result" style={{ color: '#AEB5BD', maxWidth: 220, fontSize: 13 }}>{c.result || '—'}</td>
                    <td data-label="When" className="mono" style={{ color: '#4C535B', fontSize: 12 }}>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</td>
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
