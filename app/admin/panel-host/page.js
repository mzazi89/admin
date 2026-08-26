'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Panel Hosting — deploy a full Pterodactyl panel (panel + node + egg) onto a
// VPS over SSH. Panel URL is optional — leave empty to use the VPS IP.
export default function PanelHost() {
  const router = useRouter();
  const [form, setForm] = useState({
    host: '', port: '22', username: 'root', password: '', privateKey: '',
    panelUrl: '', adminUser: 'admin', adminPass: '', adminEmail: 'admin@localhost.local',
    nodeName: 'Node 1', locationShort: 'LOC', locationLong: 'Main location',
    nodeMemory: '2048', nodeDisk: '20480', eggUrl: '',
  });
  const [phase, setPhase] = useState('idle'); // idle | deploying | polling | done | failed
  const [log, setLog] = useState([]);
  const [summary, setSummary] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    fetch('/api/admin/me').then((r) => { if (!r.ok) router.replace('/admin/login'); });
  }, [router]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (phase !== 'polling') return;
    const t = setInterval(async () => {
      const qs = new URLSearchParams({
        action: 'status', host: form.host, port: form.port, username: form.username, password: form.password, private_key: form.privateKey,
      });
      const res = await fetch(`/api/admin/panel-host?${qs}`).catch(() => null);
      if (!res) return;
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || 'Status failed'); return; }
      setLog(d.log || []);
      if (d.summary && Object.keys(d.summary).length) setSummary(d.summary);
      if (d.finished || d.failed) {
        clearInterval(t);
        setPhase(d.failed ? 'failed' : 'done');
        setBusy(false);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [phase, form.host, form.port, form.username, form.password, form.privateKey]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const deploy = async () => {
    setMsg(''); setLog([]); setSummary({}); setBusy(true);
    const res = await fetch('/api/admin/panel-host', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploy', ...form }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || 'Deploy failed to start'); setBusy(false); return; }
    setLog((d.log || '').split('\n').filter(Boolean));
    setPhase('polling');
  };

  const stop = async () => {
    setBusy(true);
    const res = await fetch('/api/admin/panel-host', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', host: form.host, port: form.port, username: form.username, password: form.password, privateKey: form.privateKey }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(d.ok ? '🛑 Install stopped.' : (d.error || 'Stop failed'));
    setPhase('idle'); setBusy(false);
  };

  const authValid = form.password || form.privateKey;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="mb-8">
        <div className="eyebrow mb-4">VPS provisioning</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Panel hosting</h1>
        <p className="lede mt-3" style={{ maxWidth: 640, fontSize: '0.92rem' }}>
          Enter your VPS details and hit deploy — it installs the Pterodactyl panel, adds a node and imports an egg,
          fully automated over SSH (Ubuntu 20.04+/22.04/24.04 or Debian 11/12). Panel URL is optional — leave empty to use the VPS IP.
        </p>
      </div>

      {msg && (
        <div className="tag mb-6" style={{ display: 'block', width: '100%', textTransform: 'none', letterSpacing: '0.02em', padding: '10px 14px',
          backgroundColor: msg.startsWith('🛑') || msg.includes('fail') || msg.includes('Fail') ? 'rgba(229,72,77,0.06)' : 'rgba(62,207,142,0.06)',
          borderColor: msg.startsWith('🛑') || msg.includes('fail') || msg.includes('Fail') ? 'rgba(229,72,77,0.35)' : 'rgba(62,207,142,0.35)',
          color: msg.startsWith('🛑') || msg.includes('fail') || msg.includes('Fail') ? '#E5484D' : '#3ECF8E' }}>
          {msg}
        </div>
      )}

      <div className="card card-pad" style={{ padding: '22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <div className="mb-4">
            <label className="label" htmlFor="p-host">VPS IP / hostname *</label>
            <input id="p-host" className="input mono" value={form.host} onChange={set('host')} placeholder="1.2.3.4" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="p-port">SSH port</label>
            <input id="p-port" className="input mono" value={form.port} onChange={set('port')} placeholder="22" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="p-user">SSH user</label>
            <input id="p-user" className="input mono" value={form.username} onChange={set('username')} placeholder="root" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="p-panelurl">Panel URL (optional — empty = VPS IP)</label>
            <input id="p-panelurl" className="input mono" value={form.panelUrl} onChange={set('panelUrl')} placeholder="panel.yourdomain.com" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="p-pass">SSH password (or paste a private key below)</label>
            <input id="p-pass" type="password" className="input mono" value={form.password} onChange={set('password')} placeholder="root password" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="p-key">SSH private key (optional)</label>
            <textarea id="p-key" className="input mono" value={form.privateKey} onChange={set('privateKey')} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----…" rows={3} style={{ fontSize: 11, resize: 'vertical' }} />
          </div>

          <div style={{ borderTop: '1px solid #1B2026', gridColumn: '1 / -1', margin: '6px 0 16px' }} />

          <div className="mb-4">
            <label className="label" htmlFor="p-admin">Panel admin username</label>
            <input id="p-admin" className="input mono" value={form.adminUser} onChange={set('adminUser')} style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="p-adminpass">Panel admin password <span style={{ color: '#4C535B' }}>(empty = random)</span></label>
            <input id="p-adminpass" className="input mono" value={form.adminPass} onChange={set('adminPass')} placeholder="generated if empty" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="p-email">Panel admin email</label>
            <input id="p-email" className="input mono" value={form.adminEmail} onChange={set('adminEmail')} style={{ fontSize: 13 }} />
          </div>

          <div style={{ borderTop: '1px solid #1B2026', gridColumn: '1 / -1', margin: '6px 0 16px' }} />

          <div className="mb-4">
            <label className="label" htmlFor="p-node">Node name</label>
            <input id="p-node" className="input mono" value={form.nodeName} onChange={set('nodeName')} style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="p-loc">Location code</label>
            <input id="p-loc" className="input mono" value={form.locationShort} onChange={set('locationShort')} placeholder="US" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="p-mem">Node memory (MB)</label>
            <input id="p-mem" className="input mono" value={form.nodeMemory} onChange={set('nodeMemory')} placeholder="2048" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="p-disk">Node disk (MB)</label>
            <input id="p-disk" className="input mono" value={form.nodeDisk} onChange={set('nodeDisk')} placeholder="20480" style={{ fontSize: 13 }} />
          </div>
          <div className="mb-4" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="p-egg">Egg JSON URL <span style={{ color: '#4C535B' }}>(optional — default: Minecraft Paper)</span></label>
            <input id="p-egg" className="input mono" value={form.eggUrl} onChange={set('eggUrl')} placeholder="https://raw.githubusercontent.com/parkervcp/eggs/master/…" style={{ fontSize: 13 }} />
          </div>
        </div>

        <div className="flex" style={{ gap: 10, marginTop: 6 }}>
          <button className="btn btn-primary" onClick={deploy} disabled={busy || !form.host || !authValid} style={{ fontSize: 12, padding: '10px 18px' }}>
            {busy ? 'Working…' : '🚀 Deploy Panel'}
          </button>
          {(phase === 'polling' || phase === 'deploying') && (
            <button className="btn btn-danger" onClick={stop} disabled={busy} style={{ fontSize: 12, padding: '10px 14px' }}>🛑 Stop</button>
          )}
        </div>
      </div>

      {(phase === 'polling' || phase === 'done' || phase === 'failed' || log.length > 0) && (
        <div className="card card-pad mt-6" style={{ padding: '18px' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A828A' }}>
              {phase === 'done' ? '✅ Deployment complete' : phase === 'failed' ? '❌ Deployment failed' : '⏳ Deploying — log refreshes every 5s'}
            </span>
          </div>

          {(phase === 'done' || Object.keys(summary).length > 0) && (
            <div className="mb-4" style={{ border: '1px solid rgba(62,207,142,0.35)', borderRadius: 8, padding: '12px 14px', backgroundColor: 'rgba(62,207,142,0.05)' }}>
              <div className="mono" style={{ fontSize: 10.5, color: '#3ECF8E', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Summary</div>
              {summary.PANEL_URL && <div className="mono" style={{ fontSize: 12, color: '#E9E7E2', marginBottom: 4 }}>🔗 Panel: <span style={{ color: '#F5A623' }}>{summary.PANEL_URL}</span></div>}
              {summary.ADMIN_USER && <div className="mono" style={{ fontSize: 12, color: '#E9E7E2', marginBottom: 4 }}>👤 User: {summary.ADMIN_USER}</div>}
              {summary.ADMIN_PASS && <div className="mono" style={{ fontSize: 12, color: '#E9E7E2', marginBottom: 4 }}>🔑 Pass: <span style={{ color: '#F5A623' }}>{summary.ADMIN_PASS}</span></div>}
              {summary.NODE_ID && <div className="mono" style={{ fontSize: 12, color: '#E9E7E2', marginBottom: 4 }}>🖥 Node id: {summary.NODE_ID}</div>}
              {summary.EGG_ID && <div className="mono" style={{ fontSize: 12, color: '#E9E7E2' }}>🥚 Egg id: {summary.EGG_ID}</div>}
            </div>
          )}

          <pre
            ref={logRef}
            className="mono"
            style={{
              maxHeight: 320, overflow: 'auto', margin: 0, padding: '12px 14px',
              backgroundColor: '#0C0E11', border: '1px solid #1B2026', borderRadius: 8,
              fontSize: 11, lineHeight: 1.55, color: '#B9C0C7', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
            {log.length ? log.join('\n') : 'Waiting for the installer to write its log…'}
          </pre>
        </div>
      )}
    </div>
  );
}
