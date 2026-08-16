'use client';
import { useEffect, useRef, useState } from 'react';
import Logo from './Logo';

// Full-screen transition loader — shown only on real actions
// (links, buttons, form submits). Visual-only (pointerEvents: none).
export default function ClickLoader() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);
  const fadeRef = useRef(null);

  useEffect(() => {
    const show = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
      setLeaving(false);
      setVisible(true);
      timerRef.current = setTimeout(() => {
        setLeaving(true);
        fadeRef.current = setTimeout(() => setVisible(false), 450);
      }, 2000);
    };

    const ACTIONABLE =
      'a[href], button, [role="button"], input[type="submit"], input[type="button"], select, summary, [tabindex]:not([tabindex="-1"])';

    const onClick = (event) => {
      const el = event.target?.closest ? event.target.closest(ACTIONABLE) : null;
      if (!el) return;
      if (el.tagName === 'A' && el.target === '_blank') return;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      show();
    };

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        backgroundColor: 'rgba(11,13,15,0.94)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        pointerEvents: 'none',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 0.45s ease',
      }}
    >
      <div style={{ position: 'relative', width: 92, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader-ring" style={{ inset: 0, borderColor: 'rgba(242,169,59,0.12)', borderTopColor: '#F2A93B', borderWidth: 2, animationDuration: '1.3s' }} />
        <div className="loader-ring loader-ring-rev" style={{ inset: 10, borderWidth: 1, borderColor: 'rgba(76,125,252,0.10)', borderTopColor: '#4C7DFC', animationDuration: '1.7s' }} />
        <Logo size={44} />
      </div>

      <div className="mono text-[11px] tracking-[0.4em] uppercase" style={{ color: '#79818A' }}>
        Mzazi Tech
      </div>

      <div style={{ width: 200, height: 2, borderRadius: 1, backgroundColor: '#1B2026', overflow: 'hidden' }}>
        <div className="loader-bar" style={{ height: '100%', background: '#F2A93B' }} />
      </div>
    </div>
  );
}
