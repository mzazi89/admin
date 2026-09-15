'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Button, Card, CardHeader, Field, Input, PageHeader, Skeleton, Textarea,
  ThemeToggle, humaniseError, useToast,
  Icons,
} from '@/components/ui';

// Bot settings stored in the shared Neon `settings` table. The bot reads these
// (with env fallback). DATABASE_URL is deliberately absent — it stays in env.
const GROUPS = [
  {
    title: 'Account',
    icon: <Icons.User size={17} />,
    special: 'account',
    fields: [],
  },
  {
    title: 'Bot',
    icon: <Icons.Bot size={17} />,
    fields: [
      { key: 'bot_name', label: 'Bot name', placeholder: 'MZAZI TECH QUARTZ BOT', type: 'text' },
      { key: 'owner', label: 'Owner display name', placeholder: 'Mrs Mzazi', type: 'text' },
      { key: 'whatsapp_owner', label: 'WhatsApp owner number', placeholder: '254741388986@s.whatsapp.net', type: 'text' },
      { key: 'connection_image', label: 'Connection image URL', placeholder: 'https://files.catbox.moe/…', type: 'text' },
      {
        key: 'bot_profiles',
        label: 'Bot profiles',
        placeholder: '[{"id":"quartz","name":"QUARTZ XD"},{"id":"xmd","name":"MZAZI XMD"}]',
        type: 'textarea',
        hint: 'A JSON list of {"id","name"}. Empty = one bot. With two or more, the public link page shows a bot selector.',
      },
      { key: 'telegram_bot_token', label: 'Telegram bot token', placeholder: '123456:ABC-…', type: 'password' },
      { key: 'telegram_owner', label: 'Telegram owner ID', placeholder: '6454759976', type: 'text' },
      { key: 'autoJoinGroupLink', label: 'Auto-join group link', placeholder: 'https://chat.whatsapp.com/…', type: 'text' },
    ],
  },
  {
    title: 'Payments',
    icon: <Icons.CreditCard size={17} />,
    fields: [
      { key: 'paystack_secret_key', label: 'Paystack secret key', placeholder: 'sk_live_…', type: 'password' },
      { key: 'paystack_public_key', label: 'Paystack public key', placeholder: 'pk_live_…', type: 'password' },
      { key: 'depositOfferEnabled', label: 'Deposit offer active', placeholder: '1 = active, 0 = paused', type: 'text' },
      { key: 'depositOfferMultiplier', label: 'Deposit multiplier (2 = double)', placeholder: '2', type: 'text' },
      { key: 'depositOfferAdText', label: 'Deposit ad banner text', placeholder: '🎁 DOUBLE DEPOSIT — get 2× your money!', type: 'text' },
    ],
  },
  {
    title: 'System',
    icon: <Icons.Settings size={17} />,
    fields: [
      { key: 'pterodactyl_url', label: 'Pterodactyl URL', placeholder: 'https://panel.example.com', type: 'text' },
      { key: 'pterodactyl_api_key', label: 'Pterodactyl API key', placeholder: 'ptla_…', type: 'password' },
      { key: 'webhook_port', label: 'Webhook port', placeholder: '3000', type: 'text' },
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://bot.example.com/webhook', type: 'text' },
      { key: 'remote_api_url', label: 'Remote command API URL', placeholder: 'https://mzazi.shop/api/bot-command', type: 'text' },
      { key: 'mzazi_site_url', label: 'MZAZI site URL', placeholder: 'https://mzazi.shop', type: 'text' },
      { key: 'bot_ip', label: 'Reported bot IP (blank = auto-detect)', placeholder: 'auto-detect', type: 'text' },
    ],
  },
  {
    title: 'Advanced',
    icon: <Icons.Shield size={17} />,
    collapsed: true,
    description: 'API keys and AI credentials. Collapsed by default.',
    fields: [
      { key: 'bot_api_key', label: 'Bot API key (matches site BOT_API_KEY)', placeholder: '…', type: 'password' },
      { key: 'mzazi_api_key', label: 'MZAZI API key', placeholder: 'key used by the bot API commands', type: 'password' },
      { key: 'deepseek_api_key', label: 'DeepSeek AI key (optional)', placeholder: 'sk-…', type: 'password' },
    ],
  },
];

// Only `bot_profiles` is JSON. Mirrors normaliseBotProfiles on the server.
function jsonOk(text) {
  const t = String(text ?? '').trim();
  if (t === '') return true;
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) && parsed.length > 0 &&
      parsed.every((p) => p && typeof p === 'object' && !Array.isArray(p) && String(p.id || '').trim() && String(p.name || '').trim());
  } catch {
    return false;
  }
}

const TEXTAREA_FIELDS = GROUPS.flatMap((g) => g.fields).filter((f) => f.type === 'textarea');

export default function AdminSettings() {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState({});
  const [adminEmail, setAdminEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load settings');
      setValues(d.settings || {});
    } catch (e) {
      setError(humaniseError(e, 'We could not load settings right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      r.json().then((d) => setAdminEmail(d?.admin?.email || '')).catch(() => {});
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const bad = TEXTAREA_FIELDS.find((f) => !jsonOk(values[f.key]));
    if (bad) {
      toast.error(`${bad.label} is not a valid list. Fix it, or empty the field.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to save settings');
      toast.success('Saved — the bot will use these within ~60 seconds.');
    } catch (e) {
      toast.error(humaniseError(e, 'We could not save your settings. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <PageHeader
        title="Settings"
        description="Stored in the shared Neon database — the bot reads them automatically (with env fallback), no restarts needed."
        icon={<Icons.Settings size={20} />}
      />

      {error ? (
        <Card>
          <Alert kind="error">{error}</Alert>
          <div style={{ marginTop: 12 }}><Button variant="ghost" size="sm" icon={<Icons.Refresh size={15} />} onClick={load}>Try again</Button></div>
        </Card>
      ) : loading ? (
        <Card style={{ padding: 16, display: 'grid', gap: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={46} />)}
        </Card>
      ) : (
        <>
          {GROUPS.map((group) => (
            <Card key={group.title} style={{ padding: '22px 22px 8px', marginBottom: 18 }}>
              <CardHeader title={group.title} description={group.description} icon={group.icon} />

              {group.special === 'account' && (
                <div>
                  <Field label="Signed in as" id="set-admin-email">
                    <Input id="set-admin-email" value={adminEmail || '—'} readOnly disabled />
                  </Field>
                  <div style={{ marginBottom: 15 }}>
                    <span className="label" style={{ display: 'block' }}>Appearance</span>
                    <ThemeToggle variant="segmented" />
                  </div>
                </div>
              )}

              {group.collapsed ? (
                <details style={{ marginBottom: 16 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--muted)', padding: '4px 0' }}>
                    Show {group.title.toLowerCase()} settings
                  </summary>
                  <div style={{ paddingTop: 14 }}>
                    {group.fields.map((f) => (
                      <SettingField key={f.key} f={f} values={values} setValues={setValues} />
                    ))}
                  </div>
                </details>
              ) : (
                group.fields.map((f) => (
                  <SettingField key={f.key} f={f} values={values} setValues={setValues} />
                ))
              )}
            </Card>
          ))}

          <Card style={{ padding: '18px 22px', marginBottom: 18 }}>
            <Button variant="primary" loading={saving} loadingText="Saving…" onClick={save}>Save settings</Button>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>
              Leave a field empty to fall back to the bot&apos;s environment variable.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function SettingField({ f, values, setValues }) {
  const invalid = f.type === 'textarea' && !jsonOk(values[f.key]);
  const id = `set-${f.key}`;
  const shared = {
    id,
    placeholder: f.placeholder,
    value: values[f.key] || '',
    onChange: (e) => setValues((v) => ({ ...v, [f.key]: e.target.value })),
    error: invalid ? 'Not a valid list — save would read as one bot.' : undefined,
  };
  return (
    <Field label={f.label} id={id} hint={f.hint}>
      {f.type === 'textarea'
        ? <Textarea {...shared} className="mono" rows={4} style={{ fontSize: 12.5, lineHeight: 1.6 }} />
        : <Input {...shared} type={f.type} className="mono" style={{ fontSize: 13 }} />}
    </Field>
  );
}
