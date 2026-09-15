// MZAZI TECH — badges and status indicators.
//
// The product shows status in a lot of places (plan, device, payment, bot).
// They all run through here so a colour always means the same thing:
//   good  → green      active / connected / paid / enabled
//   warn  → amber      needs attention / expiring / pending
//   bad   → red        failed / expired / suspended
//   brand → purple     the user's own current selection / primary emphasis
//   blue  → blue       neutral information

const TONES = {
  brand: 'tag-amber',
  purple: 'tag-amber',
  blue: 'tag-blue',
  good: 'tag-green',
  success: 'tag-green',
  warn: 'tag-warn',
  bad: 'tag-red',
  error: 'tag-red',
  neutral: '',
};

export default function Badge({ children, tone = 'neutral', icon = null, dot = false, className = '', style }) {
  const cls = TONES[tone] ?? '';
  return (
    <span className={`tag ${cls} ${className}`} style={style}>
      {dot && <span className="dot" aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}

const DOT_TONES = {
  good: 'dot-online', online: 'dot-online', active: 'dot-online', connected: 'dot-online', paid: 'dot-online',
  warn: 'dot-warn', pending: 'dot-warn', attention: 'dot-warn', expiring: 'dot-warn',
  bad: 'dot-error', error: 'dot-error', failed: 'dot-error', expired: 'dot-error', suspended: 'dot-error',
  offline: 'dot-offline', neutral: 'dot-offline', none: 'dot-offline', free: 'dot-offline',
  brand: '', blue: '',
};

/**
 * StatusIndicator — dot + sentence-case label.
 * `pulse` is used only for genuinely live states (pairing, bot online).
 */
export function StatusIndicator({ status = 'neutral', label, pulse = false, className = '', style }) {
  const dotCls = DOT_TONES[status] ?? 'dot-offline';
  const text = label ?? status;
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', ...style }}
    >
      <span
        className={`dot ${dotCls} ${pulse ? 'anim-pulse' : ''}`}
        style={status === 'brand' || status === 'blue' ? { color: status === 'brand' ? 'var(--brand)' : 'var(--blue)' } : undefined}
        aria-hidden="true"
      />
      {text}
    </span>
  );
}

/** Human label + tone for a subscription plan id. */
export function planLabel(plan) {
  const key = String(plan || 'FREE').toUpperCase();
  const map = {
    FREE: 'Free',
    PLAN_5: '5 Numbers',
    PLAN_10: '10 Numbers',
    PLAN_20: '20 Numbers',
    UNLIMITED: 'Unlimited',
    PREMIUM: 'Premium',
    BUSINESS: 'Business',
    ADMIN: 'Admin',
  };
  return map[key] || key.replace(/_/g, ' ');
}

export function planTone(plan) {
  const key = String(plan || 'FREE').toUpperCase();
  if (key === 'FREE') return 'neutral';
  if (key === 'UNLIMITED' || key === 'BUSINESS') return 'good';
  if (key === 'ADMIN') return 'blue';
  return 'brand';
}
