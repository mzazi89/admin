'use client';

// MZAZI TECH — loading, empty and error states.
//
// Rules the product follows everywhere:
//   * anything that can take longer than ~300 ms gets a visible state
//   * content areas use skeletons (they keep the layout), not a lone spinner
//   * technical errors are never shown to end users — only friendly copy

import { AlertCircle, Info, CheckCircle, AlertTriangle, Refresh } from './Icons';
import Button from './Button';

/** Small inline spinner. */
export function Loader({ size = 18, label = 'Loading', className = '' }) {
  return (
    <span
      className={className}
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block',
        width: size, height: size,
        border: '2px solid var(--line)',
        borderTopColor: 'var(--brand)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flex: '0 0 auto',
      }}
    />
  );
}

/** Full-panel loading state with a friendly message. */
export function LoadingState({ message = 'Loading…', minHeight = 240 }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 14, color: 'var(--muted)', fontSize: 14.5,
      }}
    >
      <span className="spinner" />
      <span>{message}</span>
    </div>
  );
}

/** Skeleton primitives — shape-matched placeholders while data loads. */
export function Skeleton({ w = '100%', h = 12, radius = 'var(--r-sm)', className = '', style }) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: radius, ...style }} />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <span key={i} className="skeleton skeleton-text" style={{ width: i === lines - 1 ? '62%' : '100%' }} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3, height = 96 }) {
  return (
    <div className="grid-cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="skeleton" style={{ height, borderRadius: 'var(--r-lg)' }} />
      ))}
    </div>
  );
}

/**
 * EmptyState — shown when a list is legitimately empty (not an error).
 * Always answers "what is this?" and offers the one action that fixes it.
 */
export function EmptyState({ icon, title, description, action, secondaryAction, compact = false }) {
  return (
    <div className="empty" style={compact ? { padding: '26px 18px' } : undefined}>
      <div className="empty-icon" aria-hidden="true">
        {icon || <Info size={26} />}
      </div>
      <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>
        {title}
      </p>
      {description && (
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14.5, maxWidth: 380, lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

const ALERT_ICON = { error: AlertCircle, success: CheckCircle, warn: AlertTriangle, info: Info, brand: Info };

/**
 * ErrorState — the single place a failed request is rendered.
 *
 * `technical` is deliberately opt-in and rendered inside a collapsed
 * <details>: end users see friendly copy, admins can still reach the detail.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Please try again.',
  technical = null,
  onRetry,
  minHeight = 200,
}) {
  return (
    <div
      role="alert"
      style={{
        minHeight,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, textAlign: 'center', padding: '26px 18px',
      }}
    >
      <div className="empty-icon" style={{ background: 'var(--bad-tint)', color: 'var(--bad)' }} aria-hidden="true">
        <AlertCircle size={26} />
      </div>
      <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>
        {title}
      </p>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14.5, maxWidth: 420, lineHeight: 1.6 }}>{message}</p>

      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} icon={<Refresh size={15} />}>
          Try again
        </Button>
      )}

      {technical && (
        <details style={{ marginTop: 6, width: '100%', maxWidth: 520, textAlign: 'left' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--dim)', fontWeight: 600 }}>
            View technical details
          </summary>
          <pre
            className="mono"
            style={{
              marginTop: 8, padding: 12, fontSize: 13, lineHeight: 1.5,
              background: 'var(--surface-2)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)', overflowX: 'auto', color: 'var(--muted)', whiteSpace: 'pre-wrap',
            }}
          >
            {typeof technical === 'string' ? technical : JSON.stringify(technical, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/** Inline alert banner. */
export function Alert({ kind = 'info', title, children, className = '', style }) {
  const Glyph = ALERT_ICON[kind] || Info;
  const cls = { error: 'alert-error', success: 'alert-success', warn: 'alert-warn', brand: 'alert-brand' }[kind] || '';
  return (
    <div className={`alert ${cls} ${className}`} style={style} role={kind === 'error' ? 'alert' : undefined}>
      <span style={{ marginTop: 1, flex: '0 0 auto' }} aria-hidden="true"><Glyph size={17} /></span>
      <div style={{ minWidth: 0 }}>
        {title && <strong style={{ display: 'block', fontWeight: 700, marginBottom: 2 }}>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/**
 * humaniseError — converts anything thrown by a fetch/Prisma/axios call into
 * plain language. This is the ONLY thing user-facing screens should render;
 * raw messages must never leak (they expose schema, URLs and internals).
 */
export function humaniseError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const raw = typeof err === 'string' ? err : (err.message || '');
  const s = raw.toLowerCase();

  if (!raw) return fallback;
  if (s.includes('failed to fetch') || s.includes('networkerror') || s.includes('load failed')) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  if (s.includes('not authenticated') || s.includes('unauthorized') || s.includes('401')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (s.includes('forbidden') || s.includes('403')) {
    return 'You do not have permission to do that.';
  }
  if (s.includes('insufficient') || s.includes('balance')) {
    return 'Your wallet balance is too low for this. Top up and try again.';
  }
  if (s.includes('timeout') || s.includes('timed out')) {
    return 'That took too long. Please try again.';
  }
  if (s.includes('prisma') || s.includes('sql') || s.includes('postgres') || s.includes('syntaxerror')) {
    return fallback;   // never surface database internals
  }
  if (s.includes('rate') || s.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  // A short, already-human message from our own API is safe to pass through.
  // It must read like a sentence we wrote (capital letter + terminal punctuation)
  // and must not contain common technical tokens that leak internals.
  const TECH_TOKENS = /\bjwt\b|\btoken\b|\bundefined\b|\bnull\b|\bnan\b|econn|etimedout|enoent|cannot read|is not a function|\bstack\b|at http|\bprisma\b|\bsql\b|pg_|\bneon\b|fetch failed|axio|syntaxerror|typeerror/i;
  const looksHuman = /^[A-Z]/.test(raw) && /[.!?]$/.test(raw.trim());
  if (raw.length <= 140 && looksHuman && !TECH_TOKENS.test(raw)) return raw;
  return fallback;
}
