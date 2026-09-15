'use client';

// MZAZI TECH — toast notifications.
//
// Used for the outcome of an action the user just took ("Pairing code sent",
// "Payment failed"). Announcements use aria-live so screen readers hear them.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from './Icons';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle, error: AlertCircle, warn: AlertTriangle, info: Info };
const CLASS = { success: 'toast-success', error: 'toast-error', warn: 'toast-error', info: 'toast-info' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((message, kind = 'info', duration = 4200) => {
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, message, kind }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    toast: push,
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d),
    warn: (m, d) => push(m, 'warn', d),
    info: (m, d) => push(m, 'info', d),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Glyph = ICONS[t.kind] || Info;
          return (
            <div key={t.id} className={`toast ${CLASS[t.kind] || ''}`}>
              <span style={{ flex: '0 0 auto', marginTop: 1, color: t.kind === 'success' ? 'var(--good)' : t.kind === 'error' ? 'var(--bad)' : 'var(--blue)' }} aria-hidden="true">
                <Glyph size={17} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--dim)', fontSize: 16, lineHeight: 1, padding: 2 }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Safe outside a provider: falls back to no-ops so a page never crashes. */
export function useToast() {
  return useContext(ToastContext) || {
    toast: () => {}, success: () => {}, error: () => {}, warn: () => {}, info: () => {}, dismiss: () => {},
  };
}
