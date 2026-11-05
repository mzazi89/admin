'use client';

// MZAZI TECH — Perfected Static Background (Admin).
// Synchronized with main web for 100% performance and professional look.

export default function TechBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#050914]">
      {/* Depth: a cool navy wash from the top, then a wide brand-blue bloom
          behind the content column. Two stops rather than one flat radial —
          the second is what stops the page reading as plain black at the
          edges, which is where the old #04060D backdrop lost its depth. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,#0B2044_0%,transparent_65%)] opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(37,99,235,0.16)_0%,transparent_55%)]" />
      
      {/* High-performance grid overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.1] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      {/* Noise texture for premium feel */}
      <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
