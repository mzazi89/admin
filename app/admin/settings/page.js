'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Admin: bot settings stored in the shared Neon `settings` table.
// The bot reads these (with env fallback) — saves apply within ~60s, no restart.
// DATABASE_URL is deliberately absent — it stays in the server env.
const SECTIONS = [
  {
    title: 'Bot identity',
    fields: [
      { key: 'bot_name', label: 'Bot name', placeholder: 'MZAZI TECH QUARTZ BOT', type: 'text' },
      { key: 'owner', label: 'Owner display name', placeholder: 'Mrs Mzazi', type: 'text' },
      { key: 'whatsapp_owner', label: 'WhatsApp owner number', placeholder: '254741388986@s.whatsapp.net', type: 'text' },
      { key: 'connection_image', label: 'Connection image URL', placeholder: 'https://files.catbox.moe/…', type: 'text' },
    ],
  },
  {
    title: 'Telegram',
    fields: [
      { key: 'telegram_bot_token', label: 'Telegram bot token', placeholder: '123456:ABC-…', type: 'password' },
      { key: 'telegram_owner', label: 'Telegram owner ID', placeholder: '6454759976', type: 'text' },
    ],
  },
  {
    title: 'WhatsApp',
    fields: [
      { key: 'autoJoinGroupLink', label: 'Auto-join group link', placeholder: 'https://chat.whatsapp.com/… — the bot joins this group on every connect/restart (rejoins if removed)', type: 'text' },
    ],
  },
  {
    title: 'Paystack',
    fields: [
      { key: 'paystack_secret_key', label: 'Paystack secret key', placeholder: 'sk_live_…', type: 'password' },
      { key: 'paystack_public_key', label: 'Paystack public key', placeholder: 'pk_live_…', type: 'password' },
    ],
  },
  {
    title: 'Deposit offer',
    fields: [
      { key: 'depositOfferEnabled', label: 'Offer active', placeholder: '1 = active, 0 = paused', type: 'text' },
      { key: 'depositOfferMultiplier', label: 'Multiplier (2 = double deposit)', placeholder: '2', type: 'text' },
      { key: 'depositOfferAdText', label: 'Ad banner text (shown on wallet page)', placeholder: '🎁 DOUBLE DEPOSIT — get 2× your money!', type: 'text' },
    ],
  },
  {
    title: 'Pterodactyl',
    fields: [
      { key: 'pterodactyl_url', label: 'Pterodactyl URL', placeholder: 'https://panel.example.com', type: 'text' },
      { key: 'pterodactyl_api_key', label: 'Pterodactyl API key', placeholder: 'ptla_…', type: 'password' },
    ],
  },
  {
    title: 'Webhooks & URLs',
    fields: [
      { key: 'webhook_port', label: 'Webhook port', placeholder: '3000', type: 'text' },
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://bot.example.com/webhook', type: 'text' },
      { key: 'remote_api_url', label: 'Remote command API URL', placeholder: 'https://mzazi.shop/api/bot-command', type: 'text' },
      { key: 'bot_api_key', label: 'Bot API key (matches site BOT_API_KEY)', placeholder: '…', type: 'password' },
      { key: 'mzazi_site_url', label: 'MZAZI site URL', placeholder: 'https://mzazi.shop', type: 'text' },
      { key: 'mzazi_api_key', label: 'MZAZI API key', placeholder: 'key used by the bot API commands', type: 'password' },
      { key: 'bot_ip', label: 'Reported bot IP (leave empty = auto-detect)', placeholder: 'auto-detect', type: 'text' },
    ],
  },
  {
    title: 'AI',
    fields: [
      { key: 'deepseek_api_key', label: 'DeepSeek AI key (optional)', placeholder: 'sk-… — powers the AI assistant on the site', type: 'password' },
    ],
  },
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
      if (!res.ok) { setNotice(d.error || 'Failed to save'); setSaving(false); return; }
      setNotice('Saved — the bot will use these within ~60 seconds.');
    } catch {
      setNotice('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow mb-4">Configuration</div>
        <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Bot settings</h1>
        <p className="lede mt-3" style={{ maxWidth: 620, fontSize: '0.92rem' }}>
          Stored in the shared Neon database — the bot reads them automatically (with env fallback), no server env vars or restarts needed.
        </p>
      </div>

      {notice && (
        <div className="tag mb-6" style={{
          padding: '10px 14px', width: '100%', textTransform: 'none', letterSpacing: '0.02em',
          backgroundColor: notice.includes('Error') || notice.includes('Failed') ? 'rgba(229,72,77,0.06)' : 'rgba(62,207,142,0.06)',
          borderColor: notice.includes('Error') || notice.includes('Failed') ? 'rgba(229,72,77,0.35)' : 'rgba(62,207,142,0.35)',
          color: notice.includes('Error') || notice.includes('Failed') ? '#E5484D' : '#3ECF8E',
        }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="card card-pad" style={{ padding: '26px' }}>
          {SECTIONS.map((section) => (
            <div key={section.title} className="mb-7" style={{ borderBottom: '1px solid #1B2026', paddingBottom: 22 }}>
              <h2 className="mono mb-4" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A828A', marginTop: 0 }}>
                {section.title}
              </h2>
              <div className="space-y-5">
                {section.fields.map((f) => (
                  <div key={f.key}>
                    <label className="label" htmlFor={`set-${f.key}`}>{f.label}</label>
                    <input
                      id={`set-${f.key}`}
                      type={f.type}
                      placeholder={f.placeholder}
                      value={values[f.key] || ''}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      className="input mono"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-6 pt-5" style={{ borderTop: '1px solid #1B2026' }}>
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <p className="mono mt-3" style={{ fontSize: 10.5, color: '#4C535B', margin: 0 }}>
              Leave a field empty to fall back to the bot&apos;s environment variable.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
