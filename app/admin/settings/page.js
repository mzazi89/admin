'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Admin: bot settings stored in the shared Neon `settings` table.
// The bot reads these (with env fallback) — saves apply within ~60s, no restart.
const FIELDS = [
  { key: 'paystack_secret_key', label: 'Paystack Secret Key', placeholder: 'sk_live_…', type: 'password' },
  { key: 'pterodactyl_url', label: 'Pterodactyl URL', placeholder: 'https://panel.example.com', type: 'text' },
  { key: 'pterodactyl_api_key', label: 'Pterodactyl API Key', placeholder: 'ptla_…', type: 'password' },
  { key: 'mzazi_api_key', label: 'MZAZI API Key', placeholder: 'key used by the bot API commands', type: 'password' },
  { key: 'deepseek_api_key', label: 'DeepSeek AI Key (optional)', placeholder: 'sk-… — powers the AI assistant on the site', type: 'password' },
];

export default function AdminSettings() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      fetch('/api/admin/settings').then(async (res) => {
        if (res.ok) {
          const d = await res.json();
          setValues(d.settings || {});
        }
        setLoading(false);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    setNotice('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const d = await res.json();
      if (!res.ok) { setNotice(`❌ ${d.error || 'Failed to save'}`); setSaving(false); return; }
      setNotice('✅ Saved — the bot will use these within ~60 seconds.');
    } catch {
      setNotice('❌ Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: '#02040a',
    border: '1px solid #1e3a8a',
    color: '#f0f4ff',
    width: '100%',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: '#f0f4ff' }}>⚙️ Bot Settings</h1>
        <p className="text-xs mt-1" style={{ color: '#64748b' }}>
          Stored in the shared Neon database — the bot reads them automatically (with env fallback), no server env vars or restarts needed.
        </p>
      </div>

      {notice && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="max-w-xl space-y-5">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-2" style={{ color: '#94a3b8' }}>{f.label}</label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={values[f.key] || ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}

          <div className="pt-2">
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : '💾 Save Settings'}
            </button>
            <p className="text-[11px] mt-2" style={{ color: '#475569' }}>
              Leave a field empty to fall back to the bot&apos;s environment variable.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
