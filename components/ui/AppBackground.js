'use client';

// MZAZI TECH — reusable page background.
//
// Wraps a page in one of the brand background variants. Everything is CSS
// (gradients, mask, blur) so there is no image request and no layout shift.
//
// An optional real image is supported: pass `image`. If it is absent, or fails
// to load, the CSS variant alone carries the design — so a page never looks
// broken and there is never a broken-image icon.

import { useState } from 'react';

const VARIANTS = {
  default: 'bg-default',
  hero: 'bg-hero',
  dashboard: 'bg-dashboard',
  auth: 'bg-auth',
  admin: 'bg-admin',
};

export default function AppBackground({
  variant = 'default',
  image = null,
  imageOpacity = 0.42,
  scrim = 0.55,
  orbs = false,
  className = '',
  style,
  children,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(image) && !imgFailed;

  return (
    <div
      className={`${VARIANTS[variant] || VARIANTS.default} ${className}`}
      style={{ position: 'relative', minHeight: '100%', ...style }}
    >
      {showImage && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, zIndex: -4,
              backgroundImage: `url("${image}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: imageOpacity,
            }}
          />
          {/* Scrim: keeps foreground text readable over any photo. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, zIndex: -3,
              background: 'var(--bg)',
              opacity: scrim,
            }}
          />
          {/* Decode off-screen so a broken URL never paints an icon. */}
          <img
            src={image}
            alt=""
            onError={() => setImgFailed(true)}
            style={{ display: 'none' }}
          />
        </>
      )}

      {orbs && (
        <>
          <span
            aria-hidden="true"
            className="orb orb-brand anim-drift-a"
            style={{ width: '34vw', height: '34vw', top: '-8%', left: '-6%' }}
          />
          <span
            aria-hidden="true"
            className="orb orb-blue anim-drift-b"
            style={{ width: '30vw', height: '30vw', bottom: '-10%', right: '-6%' }}
          />
          <span
            aria-hidden="true"
            className="orb orb-pink anim-drift-c"
            style={{ width: '22vw', height: '22vw', top: '42%', right: '10%' }}
          />
        </>
      )}

      {children}
    </div>
  );
}
