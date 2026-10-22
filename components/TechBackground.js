'use client';

// MZAZI TECH — Perfected Static Background (Admin).
// Synchronized with main web for 100% performance and professional look.

export default function TechBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#04060D]">
      {/* Subtle depth gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#0A1229_0%,transparent_70%)] opacity-60" />
      
      {/* High-performance grid overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.1] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      {/* Noise texture for premium feel */}
      <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
