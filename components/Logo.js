// MZAZI TECH — brand mark: bolt-in-square monogram (amber bolt, cobalt frame)
export default function Logo({ size = 34, withText = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', flexShrink: 0 }} aria-label="MZAZI TECH logo">
        {/* frame */}
        <rect x="2.5" y="2.5" width="43" height="43" rx="3" fill="#14181D" stroke="#F2A93B" strokeWidth="2.2" />
        {/* bolt */}
        <path
          d="M27.2 8.5 L15.5 26.5 L22.4 26.5 L20.4 39.5 L32.8 20.8 L25.6 20.8 Z"
          fill="#F2A93B"
        />
        {/* corner ticks — small mono detail */}
        <circle cx="8" cy="8" r="1.4" fill="#4C7DFC" />
        <circle cx="40" cy="40" r="1.4" fill="#4C7DFC" />
      </svg>

      {withText && (
        <span
          className="display"
          style={{ fontSize: size > 40 ? 19 : 16, fontWeight: 700, letterSpacing: '-0.01em', color: '#E9E7E2' }}
        >
          MZAZI<span style={{ color: '#F2A93B' }}>.</span>TECH
        </span>
      )}
    </span>
  );
}
