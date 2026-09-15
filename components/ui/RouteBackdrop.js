'use client';

// MZAZI TECH — route-aware page backdrop.
//
// One component, mounted once in the root layout, gives EVERY page a wallpaper
// or photograph that matches what that page is about — without touching a
// single page file. The route table below is the only place to maintain.
//
// Layering (back to front):
//   1. the image, dimmed to `opacity`
//   2. a scrim of var(--bg), so foreground text always keeps WCAG contrast
//      over the photo no matter how bright the image is
//   3. the page's own AppBackground gradients, then page content
//
// Everything is `position: fixed` and `pointer-events: none`, so it never
// affects layout flow, never scrolls, and never intercepts a click.
//
// A missing or failed image simply renders nothing: the CSS gradient variants
// still carry the design, and a broken-image icon can never appear.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Route → artwork. ORDER MATTERS: the first match wins, so the more specific
 * paths must come before their prefixes (e.g. /api/admin before /api).
 * `opacity` dims the image; text-heavy legal pages get the lowest value.
 */
const ROUTES = [
  // ── Admin (most specific first) ──────────────────────────────────────────
  ['/admin/broadcast',      '/images/broadcast-bg.webp',   0.50],
  ['/admin/vouchers',       '/images/coupons-bg.webp',     0.48],
  ['/admin/commands',       '/images/commands-bg.webp',    0.48],
  ['/admin/bot',            '/images/commands-bg.webp',    0.48],
  ['/admin/sessions',       '/images/devices-bg.webp',     0.48],
  ['/admin/users',          '/images/community-bg.webp',   0.45],
  ['/admin/resellers',      '/images/community-bg.webp',   0.45],
  ['/admin/inquiries',      '/images/community-bg.webp',   0.45],
  ['/admin/testimonials',   '/images/community-bg.webp',   0.45],
  ['/admin/subscriptions',  '/images/billing-bg.webp',     0.45],
  ['/admin/transactions',   '/images/billing-bg.webp',     0.45],
  ['/admin/settings',       '/images/settings-bg.webp',    0.45],
  ['/admin/panel-host',     '/images/hosting-bg.webp',     0.45],
  ['/admin/panel',          '/images/settings-bg.webp',    0.45],
  ['/admin/vps',            '/images/hosting-bg.webp',     0.45],
  ['/admin/packages',       '/images/hosting-bg.webp',     0.45],
  ['/admin/dashboard',      '/images/dashboard-bg.webp',   0.45],
  ['/admin/login',          '/images/auth-bg.webp',        0.50],
  ['/api/admin',            '/images/developers-bg.webp',  0.45],

  // ── User site ────────────────────────────────────────────────────────────
  ['/api/docs',             '/images/developers-bg.webp',  0.45],
  ['/api/explorer',         '/images/developers-bg.webp',  0.45],
  ['/api/status',           '/images/developers-bg.webp',  0.45],
  ['/api/dashboard',        '/images/developers-bg.webp',  0.45],
  ['/api',                  '/images/developers-bg.webp',  0.45],
  ['/devices',              '/images/devices-bg.webp',     0.50],
  ['/whatsapp-bot',         '/images/devices-bg.webp',     0.50],
  ['/subscription',         '/images/billing-bg.webp',     0.45],
  ['/payments',             '/images/billing-bg.webp',     0.45],
  ['/wallet',               '/images/billing-bg.webp',     0.45],
  ['/payment',              '/images/billing-bg.webp',     0.45],
  ['/account',              '/images/settings-bg.webp',    0.45],
  ['/help',                 '/images/help-bg.webp',        0.48],
  ['/contact',              '/images/help-bg.webp',        0.48],
  ['/about',                '/images/community-bg.webp',   0.45],
  ['/testimonials',         '/images/community-bg.webp',   0.45],
  ['/temp-number',          '/images/numbers-bg.webp',     0.48],
  ['/ludo',                 '/images/games-bg.webp',       0.45],
  ['/vps',                  '/images/photo-datacentre.webp', 0.42],
  ['/products',             '/images/photo-datacentre.webp', 0.42],
  // Long-form reading: keep the artwork almost subliminal.
  ['/privacy',              '/images/legal-bg.webp',       0.30],
  ['/terms',                '/images/legal-bg.webp',       0.30],
  ['/login',                '/images/auth-bg.webp',        0.50],
  ['/signup',               '/images/auth-bg.webp',        0.50],
  ['/forgot-password',      '/images/auth-bg.webp',        0.50],
  ['/dashboard',            '/images/dashboard-bg.webp',   0.45],
];

/** Longest-prefix match, with `/` matched exactly only. */
function backdropFor(pathname) {
  if (!pathname) return null;
  if (pathname === '/') return { image: '/images/hero-bg.webp', opacity: 0.55 };
  for (const [prefix, image, opacity] of ROUTES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return { image, opacity };
    }
  }
  return { image: '/images/dashboard-bg.webp', opacity: 0.45 };
}

export default function RouteBackdrop({ scrim = 0.55 }) {
  const pathname = usePathname();
  const [failedFor, setFailedFor] = useState(null);
  const spec = backdropFor(pathname);

  // Reset the failure flag when navigating to a route with different artwork.
  useEffect(() => { setFailedFor(null); }, [spec?.image]);

  if (!spec || failedFor === spec.image) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${spec.image}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: spec.opacity,
        }}
      />
      {/* Contrast guarantee — the reason any photo is safe behind text. */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', opacity: scrim }} />
      {/* Decoded off-screen purely to detect a broken URL. */}
      <img
        src={spec.image}
        alt=""
        onError={() => setFailedFor(spec.image)}
        style={{ display: 'none' }}
      />
    </div>
  );
}
