'use client';

// MZAZI TECH — plan card (subscription page + pricing sections).
//
// Deliberately shows only what a buyer needs to decide:
// how many devices, how much, how long, and whether it is already theirs.
// Bot artwork is optional — when the project has no image, BotMark renders a
// branded CSS/gradient mark instead, so nothing ever looks unfinished.

import Badge, { planLabel } from './Badge';
import Button from './Button';
import { Check, Phone, Sparkles } from './Icons';
import ImageWithFallback from './ImageWithFallback';

/**
 * Branded bot mark. `image` is used when one exists (bundled, uploaded or a DB
 * URL); otherwise a gradient + bolt renders. `compact` is the inline variant.
 */
/**
 * Bot artwork. Real generated assets live in /public/images; if one is ever
 * missing or fails to load, ImageWithFallback swaps in the branded gradient
 * mark, so a bot never renders as an empty box.
 */
export const BOT_IMAGES = {
  'QUARTZ XD': '/images/bot-quartz.webp',
  'MZAZI XMD': '/images/bot-mzazi.webp',
};

/** Resolve artwork for a bot name (tolerant of casing / spacing). */
export function botImage(name) {
  if (!name) return null;
  const key = String(name).trim().toUpperCase();
  if (BOT_IMAGES[key]) return BOT_IMAGES[key];
  const hit = Object.keys(BOT_IMAGES).find(
    (k) => key.includes(k.split(' ')[0]) || k.includes(key.split(' ')[0])
  );
  return hit ? BOT_IMAGES[hit] : null;
}

export function BotMark({ name = 'QUARTZ XD', image = undefined, size = 52, compact = false }) {
  const art = image === undefined ? botImage(name) : image;
  const initial = String(name).trim().charAt(0).toUpperCase() || 'Q';
  const short = String(name).replace(/^MZAZI\s+/i, '');

  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <ImageWithFallback
          src={art}
          alt=""
          ratio="1-1"
          rounded="md"
          label={short}
          style={{ width: 30, height: 30, flex: '0 0 30px' }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{name}</span>
      </span>
    );
  }

  return (
    <ImageWithFallback
      src={art}
      alt={`${name} bot`}
      ratio="1-1"
      rounded="lg"
      label={initial}
      style={{
        width: size, height: size, flex: `0 0 ${size}px`,
        fontSize: Math.round(size * 0.42),
      }}
    />
  );
}

export default function PlanCard({
  plan,
  current = false,
  onSelect,
  disabled = false,
  recommended = false,
  busy = false,
  showBuy = true,
  className = '',
}) {
  const {
    key, name, devices, priceKsh, days, blurb, image,
  } = plan || {};

  const deviceText = devices === null || devices === undefined || devices === 'unlimited' || devices === Infinity
    ? 'Unlimited devices'
    : `${devices} device${devices === 1 ? '' : 's'}`;

  const priceText = !priceKsh || priceKsh === 0 ? 'Free' : `KES ${Number(priceKsh).toLocaleString()}`;

  return (
    <article
      className={`card ${current ? 'card-accent' : ''} ${className}`}
      style={{
        padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        borderColor: current ? 'var(--brand)' : undefined,
        boxShadow: current ? '0 0 0 3px var(--brand-tint)' : undefined,
      }}
      aria-current={current ? 'true' : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <BotMark name="QUARTZ XD" image={image} size={48} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
              {name || planLabel(key)}
            </h3>
            {current && <Badge tone="brand">Current plan</Badge>}
            {!current && recommended && <Badge tone="blue" icon={<Sparkles size={12} />}>Popular</Badge>}
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Phone size={14} />
            {deviceText}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 700, letterSpacing: '-0.03em' }}>
          {priceText}
        </span>
        {days ? (
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>/ {days} days</span>
        ) : (
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>forever</span>
        )}
      </div>

      {blurb && (
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>{blurb}</p>
      )}

      {Array.isArray(plan?.features) && plan.features.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 7 }}>
          {plan.features.map((f) => (
            <li key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--ink-2)' }}>
              <span style={{ color: 'var(--good)', marginTop: 2, flex: '0 0 auto' }} aria-hidden="true"><Check size={15} /></span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {showBuy && (
        <div style={{ marginTop: 'auto', paddingTop: 4 }}>
          {current ? (
            <Button variant="ghost" block disabled icon={<Check size={16} />}>Your current plan</Button>
          ) : (
            <Button
              block
              variant={recommended ? 'primary' : 'dark'}
              onClick={onSelect}
              disabled={disabled}
              loading={busy}
              loadingText="Upgrading…"
            >
              {priceKsh ? 'Upgrade' : 'Switch to Free'}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
