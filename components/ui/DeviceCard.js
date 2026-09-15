'use client';

// MZAZI TECH — connected-device card.
//
// A device is a WhatsApp number. The card states the three things a user asks
// about a number: which number, is it live, and which bot is answering.
// Destructive actions are never inline — they open a confirmation dialog.

import { StatusIndicator } from './Badge';
import { BotMark } from './PlanCard';
import { WhatsApp, Refresh, LogOut, Trash } from './Icons';
import Button from './Button';

/** +254712345678 → +254 712 345 678 (readable, keeps the country code). */
export function formatPhone(number) {
  const raw = String(number || '').replace(/[^\d+]/g, '');
  if (raw.length < 8) return raw || '—';
  const cc = raw.startsWith('+') ? raw.slice(0, 4) : raw.slice(0, 3);
  const rest = raw.replace(/^\+?\d{2,3}/, '');
  const groups = rest.match(/.{1,3}/g) || [];
  return `${cc} ${groups.join(' ')}`.trim();
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`;
}

export default function DeviceCard({
  device,
  botName,
  botImage = null,
  onReconnect,
  onLogout,
  onDelete,
  busy = false,
  className = '',
}) {
  const number = device?.number || device?.phoneNumber;
  const live = device?.active !== false && String(device?.status || '').toUpperCase() !== 'INACTIVE';
  const connected = formatDate(device?.connectedAt);
  const resolving = !botName;

  return (
    <article className={`card ${className}`} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <span
          aria-hidden="true"
          style={{
            width: 42, height: 42, flex: '0 0 42px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--r-md)',
            background: live ? 'var(--good-tint)' : 'var(--surface-2)',
            color: live ? 'var(--good)' : 'var(--dim)',
          }}
        >
          <WhatsApp size={22} />
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 16.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {formatPhone(number)}
          </p>
          <div style={{ marginTop: 5 }}>
            <StatusIndicator
              status={live ? 'good' : 'offline'}
              label={live ? 'Connected' : 'Offline'}
              pulse={live}
            />
          </div>
        </div>
      </div>

      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 12px', fontSize: 13.5 }}>
        <dt style={{ color: 'var(--muted)' }}>Bot</dt>
        <dd style={{ margin: 0, justifySelf: 'end' }}>
          {resolving ? (
            <span style={{ color: 'var(--dim)', fontSize: 13.5 }}>Checking…</span>
          ) : (
            <BotMark name={botName} image={botImage} compact />
          )}
        </dd>
        {connected && (
          <>
            <dt style={{ color: 'var(--muted)' }}>Connected</dt>
            <dd style={{ margin: 0, justifySelf: 'end', color: 'var(--ink-2)' }}>{connected}</dd>
          </>
        )}
      </dl>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
        <Button size="sm" variant="ghost" icon={<Refresh size={15} />} onClick={() => onReconnect?.(device)} disabled={busy}>
          Reconnect
        </Button>
        <Button size="sm" variant="ghost" icon={<LogOut size={15} />} onClick={() => onLogout?.(device)} disabled={busy}>
          Logout
        </Button>
        <Button
          size="sm" variant="ghost" icon={<Trash size={15} />}
          onClick={() => onDelete?.(device)} disabled={busy}
          style={{ color: 'var(--bad)', marginLeft: 'auto' }}
        >
          Delete
        </Button>
      </div>
    </article>
  );
}
