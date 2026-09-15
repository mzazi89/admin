'use client';

// MZAZI TECH — the image primitive.
//
// Accepts any of the four image sources the platform can produce:
//   1. a bundled asset            ('/icons/bot-quartz.png')
//   2. an uploaded file           ('/uploads/abc.png' or a blob: URL)
//   3. a remote URL               ('https://…')
//   4. a database-stored URL      (any of the above, read at runtime)
//
// Guarantees, in order:
//   * a reserved aspect-ratio box, so nothing shifts while loading
//   * a branded purple→blue gradient placeholder underneath
//   * `onError` → the fallback stays; a broken-image icon is never rendered
//   * `loading="lazy"` + `decoding="async"` unless explicitly eager

import { useState } from 'react';

export default function ImageWithFallback({
  src,
  alt = '',
  ratio = '1-1',            // '1-1' | '4-3' | '16-9' | '3-4' | 'auto'
  rounded = 'lg',
  fit = 'cover',
  label,                    // overrides the text shown inside the fallback
  eager = false,
  className = '',
  style,
  imgStyle,
  children,                 // overlaid content (badges, gradients)
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const usable = Boolean(src) && String(src).trim() !== '' && !failed;

  const radius = { none: 0, sm: 'var(--r-sm)', md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)', full: '999px' }[rounded] ?? 'var(--r-lg)';
  const ratioClass = ratio === 'auto' ? '' : `media-${ratio}`;

  return (
    <div
      className={`media ${ratioClass} ${className}`}
      style={{ borderRadius: radius, ...style }}
    >
      {/* Branded fallback layer — always painted, revealed if the image fails. */}
      <div
        aria-hidden="true"
        className="media-fallback"
        style={{
          opacity: usable && loaded ? 0 : 1,
          transition: 'opacity 0.35s var(--ease)',
          fontSize: label ? '0.95rem' : undefined,
        }}
      >
        {label ? <span>{label}</span> : <FallbackGlyph />}
      </div>

      {usable && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: fit,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.35s var(--ease)',
            ...imgStyle,
          }}
        />
      )}

      {children}
    </div>
  );
}

function FallbackGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M13.5 2 4.5 13.5H11l-.5 8.5 9-11.5H13l.5-8.5Z" />
    </svg>
  );
}

/**
 * Circular avatar convenience wrapper — profile images, bot marks, user rows.
 * Always falls back to the person's initials on the brand gradient.
 */
export function Avatar({ src, name = '', size = 40, alt, ring = false, style }) {
  const [failed, setFailed] = useState(false);
  const usable = Boolean(src) && !failed;
  const initials = name
    .split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || '?';

  return (
    <span
      style={{
        position: 'relative',
        width: size, height: size,
        flex: `0 0 ${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--brand), var(--pink) 52%, var(--blue))',
        color: 'var(--on-brand)',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: Math.round(size * 0.38),
        boxShadow: ring ? '0 0 0 3px var(--surface)' : 'none',
        ...style,
      }}
      aria-label={alt || name || undefined}
    >
      {usable ? (
        <img
          src={src}
          alt={alt || name || ''}
          width={size}
          height={size}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
