'use client';

// MZAZI TECH — Perfected Static Background.
// Pure CSS only: no image requests (the old /grid.svg and external noise SVG
// are gone), so there is nothing to 404, no layout shift and no CPU cost.

export default function TechBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Subtle depth gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#0A1229_0%,transparent_70%)] opacity-40" />

      {/* High-performance grid overlay (inline SVG data URI — no network request) */}
      <div
        className="absolute inset-0 opacity-[0.12] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M48 0H0v48' fill='none' stroke='%237C8DB5' stroke-opacity='0.35' stroke-width='1'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}