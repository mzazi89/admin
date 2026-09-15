'use client';

// MZAZI TECH — theme controller.
//
// Three states: 'light' | 'dark' | 'system'. The chosen value is persisted in
// localStorage and applied as `data-theme` on <html>, which every design token
// in globals.css keys off.
//
// Flash-of-wrong-theme is prevented by the inline boot script in app/layout.js
// (THEME_BOOT_SCRIPT below), which runs before first paint. This provider only
// takes over afterwards, and keeps the browser UI colour in sync.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const THEME_KEY = 'mzazi-theme';

/** Runs before paint, in <head>. Kept dependency-free and tiny on purpose. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k='${THEME_KEY}';var s=localStorage.getItem(k)||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(s==='system')?(d?'dark':'light'):s;var r=document.documentElement;if(s!=='system'){r.setAttribute('data-theme',s);}r.style.colorScheme=t;}catch(e){}})();`;

const ThemeContext = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const [resolved, setResolved] = useState('light');

  const resolve = useCallback(
    (value) => (value === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : value),
    []
  );

  /** Push the theme to the DOM and the browser chrome. */
  const apply = useCallback((value) => {
    const root = document.documentElement;
    if (value === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', value);

    const next = resolve(value);
    root.style.colorScheme = next;

    // A media-less theme-color wins over the two prefers-color-scheme metas in
    // <head>, so an explicit choice is reflected in the mobile browser bar.
    let meta = document.querySelector('meta[name="theme-color"][data-dynamic]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('data-dynamic', 'true');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', next === 'dark' ? '#0D1020' : '#F6F7FB');
    return next;
  }, [resolve]);

  // Adopt whatever the boot script already stored.
  useEffect(() => {
    let stored = 'system';
    try { stored = localStorage.getItem(THEME_KEY) || 'system'; } catch {}
    setThemeState(stored);
    setResolved(apply(stored));
  }, [apply]);

  // Follow the OS while in 'system' mode.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(apply('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, apply]);

  const setTheme = useCallback((value) => {
    const next = ['light', 'dark', 'system'].includes(value) ? value : 'system';
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    setThemeState(next);
    setResolved(apply(next));
  }, [apply]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
