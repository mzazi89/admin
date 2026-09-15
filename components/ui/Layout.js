'use client';

// MZAZI TECH — shared layout primitives: page header, fields, wizard steps,
// row overflow menu. Used by both the user site and the admin panel so the two
// feel like one product.

import { useEffect, useRef, useState } from 'react';
import { MoreVertical, ChevronRight, Check } from './Icons';

/* ── PageHeader ───────────────────────────────────────────────────────────── */
/**
 * The first thing on every page. Answers "what is this page?" and
 * "what can I do here?" in one glance.
 */
export function PageHeader({ title, description, icon, actions, breadcrumb, className = '' }) {
  return (
    <header className={`page-head ${className}`}>
      <div style={{ minWidth: 0 }}>
        {breadcrumb && (
          <nav aria-label="Breadcrumb" style={{ marginBottom: 6 }}>
            <ol style={{ display: 'flex', alignItems: 'center', gap: 4, listStyle: 'none', margin: 0, padding: 0, fontSize: 12.5, color: 'var(--dim)', flexWrap: 'wrap' }}>
              {breadcrumb.map((b, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <ChevronRight size={13} />}
                  <span>{b}</span>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          {icon && (
            <span
              aria-hidden="true"
              style={{
                width: 40, height: 40, flex: '0 0 40px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--r-md)',
                background: 'linear-gradient(135deg, var(--brand-tint), var(--blue-tint))',
                color: 'var(--brand)',
              }}
            >
              {icon}
            </span>
          )}
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(1.35rem, 3.4vw, 1.85rem)', fontWeight: 700 }}>
            {title}
          </h1>
        </div>
        {description && (
          <p style={{ margin: '7px 0 0', color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, maxWidth: 720 }}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: '0 0 auto' }}>{actions}</div>
      )}
    </header>
  );
}

/* ── Form fields ──────────────────────────────────────────────────────────── */

/**
 * Field wraps a control with a real <label>, hint and error wiring.
 * Passing an `id` is required so the label and error message associate
 * correctly for screen readers and keyboard users.
 */
export function Field({ label, id, hint, error, required, children, className = '' }) {
  return (
    <div className={className} style={{ marginBottom: 15 }}>
      {label && (
        <label className="label" htmlFor={id}>
          {label}
          {required && <span aria-hidden="true" style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {error
        ? <p className="field-error" id={`${id}-error`} role="alert">{error}</p>
        : hint ? <p className="field-hint" id={`${id}-hint`}>{hint}</p> : null}
    </div>
  );
}

export function Input({ id, error, hint, ...rest }) {
  return (
    <input
      id={id}
      className="input"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      {...rest}
    />
  );
}

export function Textarea({ id, error, hint, rows = 4, ...rest }) {
  return (
    <textarea
      id={id}
      rows={rows}
      className="input"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      {...rest}
    />
  );
}

export function Select({ id, error, hint, children, ...rest }) {
  return (
    <select
      id={id}
      className="input"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

/** Search box with a leading icon and a clear button. */
export function SearchInput({ value, onChange, placeholder = 'Search…', id = 'search', className = '', ...rest }) {
  return (
    <div style={{ position: 'relative', width: '100%' }} className={className}>
      <span aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
        </svg>
      </span>
      <input
        id={id}
        type="search"
        className="input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ paddingLeft: 38 }}
        aria-label={placeholder}
        {...rest}
      />
    </div>
  );
}

/** Simple labelled toggle (switch). */
export function Toggle({ checked, onChange, label, id, description, disabled = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative', flex: '0 0 44px', width: 44, height: 26,
          borderRadius: 'var(--r-pill)', border: '1px solid var(--line)',
          background: checked ? 'var(--brand)' : 'var(--surface-2)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color var(--dur) var(--ease)',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <span
          style={{
            position: 'absolute', top: 2, left: checked ? 21 : 2,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff', boxShadow: 'var(--shadow-xs)',
            transition: 'left var(--dur) var(--ease)',
          }}
        />
      </button>
      {(label || description) && (
        <div style={{ minWidth: 0 }}>
          {label && <label htmlFor={id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>{label}</label>}
          {description && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>{description}</p>}
        </div>
      )}
    </div>
  );
}

/* ── WizardSteps ──────────────────────────────────────────────────────────── */
/**
 * Numbered progress used by WhatsApp pairing and the broadcast wizard.
 * Horizontal on every width (scrolls) so phones keep one clear reading order.
 */
export function WizardSteps({ steps, current, className = '' }) {
  return (
    <ol className={`steps ${className}`} aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-active' : '';
        return (
          <li key={s} className={`step ${state}`} aria-current={i === current ? 'step' : undefined}>
            <span className="step-num" aria-hidden="true">{i < current ? <Check size={12} /> : i + 1}</span>
            <span>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProgressBar({ value = 0, label, className = '' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={className}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
          <span>{label}</span><span className="tnum">{pct}%</span>
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── RowMenu ──────────────────────────────────────────────────────────────── */
/**
 * The "⋮" overflow menu used for row actions on mobile.
 * Closes on outside click, Escape and route-level re-render.
 */
export function RowMenu({ items = [], label = 'Row actions', align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ width: 36, height: 36 }}
      >
        <MoreVertical size={17} />
      </button>
      {open && (
        <div
          className="menu"
          role="menu"
          style={{ position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 60 }}
        >
          {items.filter(Boolean).map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`menu-item ${item.danger ? 'danger' : ''}`}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick?.(); }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Responsive table shell: real table on desktop, cards under 720px. */
export function DataTable({ columns, children, empty, className = '' }) {
  return (
    <div className={`table-wrap scroll-x ${className}`}>
      <table className="table-plain table-responsive" style={{ minWidth: 0 }}>
        <thead>
          <tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
