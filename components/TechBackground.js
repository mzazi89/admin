'use client';
import { useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED PARTICLE BACKGROUND
// A canvas particle field that cycles themes every 60 seconds:
//   Water → Fire → Sun → Molecules → Snow → Stardust (loop)
// Rendered behind everything (zIndex 0); content sits at zIndex 1.
// ─────────────────────────────────────────────────────────────────────────────

const CYCLE_MS = 60 * 1000;

const THEMES = [
  { id: 'water', label: 'Water' },
  { id: 'fire', label: 'Fire' },
  { id: 'sun', label: 'Sun' },
  { id: 'molecules', label: 'Molecules' },
  { id: 'snow', label: 'Snow' },
  { id: 'stars', label: 'Stardust' },
];

function makeParticle(theme, W, H) {
  switch (theme.id) {
    case 'water':
      return { x: Math.random() * W, y: Math.random() * -H, vy: 1.4 + Math.random() * 1.8, phase: Math.random() * Math.PI * 2, r: 1.6 + Math.random() * 2, a: 0.35 + Math.random() * 0.45 };
    case 'fire':
      return { x: Math.random() * W, y: H + 10 + Math.random() * 80, vy: 0.9 + Math.random() * 1.7, phase: Math.random() * Math.PI * 2, r: 1 + Math.random() * 2.6, a: 0.5 + Math.random() * 0.5 };
    case 'sun':
      return { angle: Math.random() * Math.PI * 2, rad: 70 + Math.random() * Math.min(W, H) * 0.4, speed: (0.1 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1), phase: Math.random() * Math.PI * 2, r: 1 + Math.random() * 2.2, a: 0.5 + Math.random() * 0.5 };
    case 'molecules':
      return { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.45, vy: (Math.random() - 0.5) * 0.45, r: 2 + Math.random() * 3, a: 0.65 + Math.random() * 0.3, phase: Math.random() * Math.PI * 2 };
    case 'snow':
      return { x: Math.random() * W, y: Math.random() * -H, vy: 0.6 + Math.random() * 1.2, phase: Math.random() * Math.PI * 2, r: 1.4 + Math.random() * 2.4, a: 0.55 + Math.random() * 0.4 };
    case 'stars':
      return { x: Math.random() * W, y: Math.random() * H, phase: Math.random() * Math.PI * 2, r: 0.5 + Math.random() * 1.5, a: 0.4 + Math.random() * 0.6, big: Math.random() < 0.1 };
  }
}

function update(p, theme, t, W, H) {
  switch (theme.id) {
    case 'water':
      p.y += p.vy;
      if (p.y > H + 8) { p.y = -8; p.x = Math.random() * W; }
      break;
    case 'fire':
      p.y -= p.vy;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      break;
    case 'sun':
      p.angle += p.speed * 0.005;
      break;
    case 'molecules':
      p.x += p.vx; p.y += p.vy;
      if (p.x < -12) p.x = W + 12; if (p.x > W + 12) p.x = -12;
      if (p.y < -12) p.y = H + 12; if (p.y > H + 12) p.y = -12;
      break;
    case 'snow':
      p.y += p.vy;
      if (p.y > H + 8) { p.y = -8; p.x = Math.random() * W; }
      break;
  }
}

function draw(theme, p, ctx, t, W, H) {
  switch (theme.id) {
    case 'water': {
      const sway = Math.sin(t * 0.0015 + p.phase) * 14;
      ctx.fillStyle = `rgba(56,189,248,${p.a})`;
      ctx.beginPath();
      ctx.ellipse(p.x + sway, p.y, 1.7, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'fire': {
      const alpha = Math.max(0.18, p.a + Math.sin(t * 0.012 + p.phase) * 0.22);
      ctx.fillStyle = p.r > 2.2 ? 'rgba(249,115,22,1)' : 'rgba(251,146,60,1)';
      ctx.shadowColor = 'rgba(249,115,22,0.9)';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      break;
    }
    case 'sun': {
      const px = W / 2 + Math.cos(p.angle) * p.rad;
      const py = H / 2 + Math.sin(p.angle) * p.rad * 0.75;
      const tw = 0.65 + 0.35 * Math.sin(t * 0.004 + p.phase);
      ctx.fillStyle = `rgba(251,191,36,${p.a * tw})`;
      ctx.shadowColor = 'rgba(251,191,36,0.95)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case 'molecules': {
      ctx.fillStyle = `rgba(96,165,250,${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'snow': {
      ctx.fillStyle = `rgba(226,232,240,${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(t * 0.0012 + p.phase) * 18, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stars': {
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.003 + p.phase));
      ctx.fillStyle = `rgba(191,219,254,${p.a * tw})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.big) {
        ctx.strokeStyle = `rgba(147,197,253,${p.a * tw * 0.6})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x - p.r * 4, p.y); ctx.lineTo(p.x + p.r * 4, p.y);
        ctx.moveTo(p.x, p.y - p.r * 4); ctx.lineTo(p.x, p.y + p.r * 4);
        ctx.stroke();
      }
      break;
    }
  }
}

// Theme-level extras: molecular bonds + warm sun core.
function drawThemeExtra(theme, ctx, particles, W, H, t) {
  if (theme.id === 'molecules') {
    ctx.strokeStyle = 'rgba(96,165,250,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) {
          const d = Math.sqrt(d2);
          ctx.globalAlpha = 0.35 * (1 - d / 120);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  if (theme.id === 'sun') {
    const cx = W / 2, cy = H / 2;
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.0015);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.34 * pulse);
    g.addColorStop(0, 'rgba(251,191,36,0.16)');
    g.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(W, H) * 0.34 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function TechBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let W = 0, H = 0;
    let particles = [];
    let themeIndex = 0;
    let themeStart = 0;
    let fade = 0;
    let last = 0;
    let running = false;

    const COUNT = { water: 90, fire: 110, sun: 80, molecules: 60, snow: 120, stars: 140 };

    const buildTheme = () => {
      const theme = THEMES[themeIndex];
      particles = [];
      const n = COUNT[theme.id] || 80;
      for (let i = 0; i < n; i++) particles.push(makeParticle(theme, W, H));
      fade = 0;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildTheme();
    };

    const tick = (now) => {
      if (!running) return;
      last = now;
      const elapsed = now - themeStart;
      if (elapsed >= CYCLE_MS) {
        themeIndex = (themeIndex + 1) % THEMES.length;
        themeStart = now;
        buildTheme();
      }
      fade = Math.min(1, fade + 0.02);

      const theme = THEMES[themeIndex];
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = fade;

      for (const p of particles) update(p, theme, now, W, H);
      drawThemeExtra(theme, ctx, particles, W, H, now);
      for (const p of particles) draw(theme, p, ctx, now, W, H);

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      themeStart = last;
      fade = 0;
      buildTheme();
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    if (prefersReduced) {
      // Draw one static frame of the first theme, no animation loop.
      buildTheme();
      const theme = THEMES[0];
      for (const p of particles) update(p, theme, 0, W, H);
      drawThemeExtra(theme, ctx, particles, W, H, 0);
      for (const p of particles) draw(theme, p, ctx, 0, W, H);
      return;
    }

    start();

    const onVisibility = () => (document.hidden ? stop() : start());
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <>
      {/* Animated particle canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Soft vignette — keeps the edges quiet for readability */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, transparent 45%, rgba(2,4,9,0.85) 100%)',
        }}
      />
    </>
  );
}
