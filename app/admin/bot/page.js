'use client';
import { useState, useEffect, useCallback } from 'react';

const card = {
  background: 'rgba(30,32,48,0.5)',
  border: '1px solid #1e3a8a',
  borderRadius: 16,
  padding: 20,
};
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  background: '#02040a',
  color: '#e2e8f0',
  border: '1px solid #1e3a8a',
  fontSize: '14px',
  outline: 'none',
};
const btnPrimary = {
  background: 'linear-gradient(135deg,#f87171,#dc2626)',
  color: '#fff',
  border: 'none',
  padding: '10px 18px',
  borderRadius: '10px',
  fontWeight: 600,
  cursor: 'pointer',
};
const btnGhost = {
  background: 'rgba(30,32,48,0.5)',
  color: '#94a3b8',
  border: '1px solid #1e3a8a',
  padding: '8px 14px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '13px',
};

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
      setNotice(`🔑 Bot API key saved. The bot will authenticate on its next sync (or restart the bot to apply immediately).`);
      load();
    } catch (e) {
      setNotice(`❌ ${e.message}`);
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
      setNotice(`❌ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const online = !!status?.online;
  const statusColor = online ? '#4ade80' : '#f87171';

  return (
    <div className="page-pad" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>🤖 Bot Control</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        Live status from the running bot (heartbeat every 30s) and remote control actions.
      </p>

      {notice && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {notice}
        </div>
      )}

      {/* Status card */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: `0 0 10px ${statusColor}` }} />
          <h2 style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700 }}>{online ? 'Bot Online' : 'Bot Offline'}</h2>
          {status?.lastSeenAgoSeconds !== null && (
            <span style={{ color: '#64748b', fontSize: 13 }}>— last seen {fmtAgo(status?.lastSeenAgoSeconds)}</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {[
            ['Version', status?.version || '—'],
            ['Uptime', status?.uptimeSeconds ? fmtUptime(status.uptimeSeconds) : '—'],
            ['Telegram', status?.telegramOnline ? '✅ Online' : '❌ Offline'],
            ['WhatsApp sessions', String(status?.whatsappSessions ?? '—')],
            ['Command count', String(status?.commandCount ?? '—')],
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#02040a', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{label}</div>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 13, color: '#64748b' }}>
          Last command sync: {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'never'}
          {status?.lastSyncError && <span style={{ color: '#f87171' }}> — ⚠️ {status.lastSyncError}</span>}
        </div>
      </div>

      {/* Bot API key */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔑 Bot API Key</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
          Shared secret between the website and the bot. {apiKeyCfg.configured
            ? <span style={{ color: '#4ade80', fontWeight: 600 }}>✓ configured</span>
            : <span style={{ color: '#f87171', fontWeight: 600 }}>⚠ not set — the bot cannot download its commands!</span>}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={apiKeyCfg.configured ? 'Type a new key to replace…' : 'Paste the BOT_API_KEY from your bot\'s .env'}
            style={{ ...inputStyle, maxWidth: 380 }}
          />
          <button onClick={saveApiKey} disabled={busy || !apiKeyInput.trim()} style={{ ...btnPrimary, opacity: busy || !apiKeyInput.trim() ? 0.5 : 1 }}>
            {busy ? 'Saving…' : 'Save Key'}
          </button>
          {apiKeyCfg.configured && (
            <button
              onClick={() => { navigator.clipboard.writeText(apiKeyCfg.key); setNotice('🔑 Key copied — paste it into the bot\'s .env if needed.'); }}
              style={btnGhost}
            >
              Copy key
            </button>
          )}
        </div>
      </div>

      {/* Control panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🔄 Sync Commands</h3>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>Force the bot to re-fetch the command registry from the website.</p>
          <button onClick={() => issue('sync', {}, 'Sync requested')} disabled={busy || !online} style={{ ...btnPrimary, opacity: busy || !online ? 0.5 : 1 }}>
            {busy ? 'Sending…' : 'Sync Now'}
          </button>
        </div>

        <div style={card}>
          <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📢 Broadcast</h3>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={3}
            placeholder="Message to send to all groups of every WhatsApp session…"
            style={{ ...inputStyle, marginBottom: 10, resize: 'vertical' }}
          />
          <button onClick={() => issue('broadcast', { message: msg }, 'Broadcast queued')} disabled={busy || !online || !msg.trim()} style={{ ...btnPrimary, opacity: busy || !online || !msg.trim() ? 0.5 : 1 }}>
            {busy ? 'Sending…' : 'Broadcast'}
          </button>
        </div>

        <div style={card}>
          <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>✏️ Change Bot Name</h3>
          <input
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="New WhatsApp profile name…"
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <button onClick={() => issue('botname', { name: botName }, 'Rename queued')} disabled={busy || !online || !botName.trim()} style={{ ...btnPrimary, opacity: busy || !online || !botName.trim() ? 0.5 : 1 }}>
            {busy ? 'Sending…' : 'Rename Bot'}
          </button>
        </div>
      </div>

      {/* History */}
      <div style={card}>
        <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🕓 Control History</h3>
        {controls.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>No controls issued yet.</p>
        ) : (
          <div className="scroll-x">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Action</th>
                <th style={{ padding: '8px 10px' }}>Payload</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px' }}>Result</th>
                <th style={{ padding: '8px 10px' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid #1e3a8a' }}>
                  <td style={{ padding: '8px 10px', color: '#e2e8f0', fontWeight: 600 }}>{c.action}</td>
                  <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{JSON.stringify(c.payload).slice(0, 60)}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ color: c.status === 'done' ? '#4ade80' : c.status === 'failed' ? '#f87171' : '#fbbf24', fontWeight: 600 }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '8px 10px', color: '#94a3b8', maxWidth: 220 }}>{c.result || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</td>
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
