'use client';

// MZAZI TECH — dialog primitives.
//
// Behaviour that every modal in the product inherits:
//   * bottom sheet on phones, centred card from 640px
//   * Escape closes, backdrop click closes, body scroll locks
//   * focus is moved in on open and restored on close
//   * `tone="danger"` renders the destructive pattern (red confirm button)

import { useEffect, useRef } from 'react';
import { X, AlertTriangle } from './Icons';
import Button from './Button';

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  tone = 'default',
  closeOnBackdrop = true,
  className = '',
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);

    // Focus the first meaningful control, not the heading.
    const t = setTimeout(() => {
      const node = panelRef.current?.querySelector(
        'input, select, textarea, button:not([data-close]), [href], [tabindex]:not([tabindex="-1"])'
      );
      (node || panelRef.current)?.focus?.();
    }, 30);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = { sm: 380, md: 460, lg: 620, xl: 800 }[size] || 460;

  return (
    <>
      <div className="overlay" onClick={closeOnBackdrop ? onClose : undefined} aria-hidden="true" />
      <div className="modal-host" onClick={closeOnBackdrop ? onClose : undefined}>
        <div
          ref={panelRef}
          className={`modal ${className}`}
          style={{ maxWidth }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', minWidth: 0 }}>
              {tone === 'danger' && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 36, height: 36, flex: '0 0 36px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'var(--r-md)', background: 'var(--bad-tint)', color: 'var(--bad)',
                  }}
                >
                  <AlertTriangle size={19} />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{title}</h2>
                {description && (
                  <p style={{ margin: '5px 0 0', fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>{description}</p>
                )}
              </div>
            </div>
            <button type="button" className="icon-btn" data-close onClick={onClose} aria-label="Close dialog"
              style={{ width: 34, height: 34 }}>
              <X size={16} />
            </button>
          </div>

          {children && <div className="modal-body">{children}</div>}
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      </div>
    </>
  );
}

/**
 * ConfirmDialog — the required pattern before anything destructive
 * (delete a device, unlink a number, revoke a coupon).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      tone={tone}
      closeOnBackdrop={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
