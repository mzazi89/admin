// MZAZI TECH — brand logo: glowing "MT" monogram in a circuit ring
export default function Logo({ size = 34, withText = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', flexShrink: 0 }} aria-label="MZAZI TECH logo">
        <defs>
          <linearGradient id="mt-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="mt-m" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a5e3ff" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="mt-t" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <filter id="mt-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* neon glow ring */}
        <circle cx="24" cy="24" r="19.5" fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.55" filter="url(#mt-glow)" />
        <circle cx="24" cy="24" r="19.5" fill="none" stroke="url(#mt-ring)" strokeWidth="2.6" />

        {/* circuit nodes */}
        <circle cx="5.5" cy="24" r="1.6" fill="#7dd3fc" opacity="0.9" />
        <circle cx="42.5" cy="24" r="1.6" fill="#7dd3fc" opacity="0.9" />
        <circle cx="24" cy="5.5" r="1.6" fill="#7dd3fc" opacity="0.9" />
        <circle cx="24" cy="42.5" r="1.6" fill="#7dd3fc" opacity="0.9" />

        {/* MT monogram — interlocking two-tone */}
        <text x="17.2" y="31.5" textAnchor="middle" fontSize="20" fontWeight="900"
          fontFamily="Arial, Helvetica, sans-serif" fill="url(#mt-m)">M</text>
        <text x="30.6" y="31.5" textAnchor="middle" fontSize="20" fontWeight="900"
          fontFamily="Arial, Helvetica, sans-serif" fill="url(#mt-t)">T</text>
      </svg>

      {withText && (
        <span className="text-base sm:text-lg font-extrabold tracking-tight"
          style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          MZAZI TECH
        </span>
      )}
    </span>
  );
}
