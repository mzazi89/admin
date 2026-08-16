'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MZAZI TECH — ambient background layers
// A quiet, layered backdrop instead of a particle show:
//   1. base colour            (set on body)
//   2. film grain             (SVG turbulence, fixed)
//   3. three slow aurora glows (amber / cobalt / steel, drifting)
//   4. editorial hairline frame (thin inset border)
//   5. wordmark watermark      (giant outlined MZAZI, bottom-right)
//   6. soft vignette           (readability)
// All layers honour prefers-reduced-motion (no animation).
// ─────────────────────────────────────────────────────────────────────────────

export default function TechBackground() {
  return (
    <>
      {/* Film grain */}
      <div
        aria-hidden="true"
        className="grain"
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.045 }}
      />

      {/* Aurora glows — very low opacity, slow drift */}
      <div
        aria-hidden="true"
        className="anim-drift-a"
        style={{
          position: 'fixed', top: '-18%', left: '-10%', width: '56vw', height: '56vw',
          zIndex: 0, pointerEvents: 'none', opacity: 0.10, filter: 'blur(90px)',
          background: 'radial-gradient(circle at 40% 40%, rgba(242,169,59,0.55) 0%, transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="anim-drift-b"
        style={{
          position: 'fixed', bottom: '-24%', right: '-12%', width: '60vw', height: '60vw',
          zIndex: 0, pointerEvents: 'none', opacity: 0.09, filter: 'blur(100px)',
          background: 'radial-gradient(circle at 55% 50%, rgba(76,125,252,0.5) 0%, transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="anim-drift-c"
        style={{
          position: 'fixed', top: '42%', left: '52%', width: '42vw', height: '42vw',
          zIndex: 0, pointerEvents: 'none', opacity: 0.05, filter: 'blur(110px)',
          background: 'radial-gradient(circle, rgba(174,181,189,0.4) 0%, transparent 60%)',
        }}
      />

      {/* Editorial hairline frame */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 10, zIndex: 0, pointerEvents: 'none',
          border: '1px solid rgba(233,231,226,0.05)', borderRadius: 2,
        }}
      />

      {/* Wordmark watermark */}
      <div
        aria-hidden="true"
        className="watermark"
        style={{
          position: 'fixed', right: 18, bottom: 10, zIndex: 0,
          fontSize: 'clamp(64px, 13vw, 190px)', whiteSpace: 'nowrap',
        }}
      >
        MZAZI
      </div>

      {/* Vignette */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 58%, rgba(11,13,15,0.55) 100%)',
        }}
      />
    </>
  );
}
