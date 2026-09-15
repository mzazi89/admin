// MZAZI TECH — Card family.
//
// Kept deliberately small: a surface, an optional accent hairline, a header
// with a title/description/action slot, and a footer. Dashboards are built by
// composing these rather than inventing a new panel per page.

export default function Card({
  children,
  as: Tag = 'section',
  accent = false,
  hover = false,
  pad = true,
  className = '',
  style,
  ...rest
}) {
  const cls = [accent ? 'card-accent' : '', hover ? 'glow-card' : 'card', pad ? 'card-pad' : '', className]
    .filter(Boolean).join(' ');
  return <Tag className={cls} style={style} {...rest}>{children}</Tag>;
}

/** Title + description + right-hand action row. */
export function CardHeader({ title, description, action, icon, className = '', style }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 14, marginBottom: description ? 14 : 12, flexWrap: 'wrap', ...style,
      }}
    >
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', minWidth: 0 }}>
        {icon && (
          <span
            aria-hidden="true"
            style={{
              width: 36, height: 36, flex: '0 0 36px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r-md)',
              background: 'var(--brand-tint)', color: 'var(--brand)',
            }}
          >
            {icon}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 16.5, fontWeight: 700, color: 'var(--ink)' }}>
            {title}
          </h3>
          {description && (
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>{description}</p>
          )}
        </div>
      </div>
      {action && <div style={{ flex: '0 0 auto' }}>{action}</div>}
    </div>
  );
}

/** Compact metric tile: title, value, optional hint, optional icon. */
export function StatCard({ label, value, hint, icon, tone = 'brand', loading = false, className = '', style }) {
  const toneMap = {
    brand: { bg: 'var(--brand-tint)', fg: 'var(--brand)' },
    blue: { bg: 'var(--blue-tint)', fg: 'var(--blue-deep)' },
    good: { bg: 'var(--good-tint)', fg: 'var(--good)' },
    warn: { bg: 'var(--warn-tint)', fg: 'var(--warn)' },
    bad: { bg: 'var(--bad-tint)', fg: 'var(--bad)' },
  }[tone] || { bg: 'var(--brand-tint)', fg: 'var(--brand)' };

  return (
    <div className={`card ${className}`} style={{ padding: 18, ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p className="stat-label" style={{ margin: 0 }}>{label}</p>
          {loading
            ? <span className="skeleton" style={{ display: 'block', width: 76, height: 26, marginTop: 8, borderRadius: 'var(--r-xs)' }} />
            : <p className="stat-num tnum" style={{ margin: '5px 0 0' }}>{value}</p>}
          {hint && <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>{hint}</p>}
        </div>
        {icon && (
          <span
            aria-hidden="true"
            style={{
              width: 38, height: 38, flex: '0 0 38px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r-md)', background: toneMap.bg, color: toneMap.fg,
            }}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
