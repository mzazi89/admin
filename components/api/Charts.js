'use client';

// Lightweight dependency-free SVG charts matching the MZAZI dark theme

export function BarChart({ data, height = 160, color = '#3b82f6', valueKey = 'requests', labelKey = 'date' }) {
  const max = Math.max(1, ...data.map(d => d[valueKey] ?? 0));
  const w = Math.max(280, data.length * 26);
  const barW = 18;

  return (
    <svg viewBox={`0 0 ${w} ${height + 28}`} className="w-full" style={{ display: 'block' }}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={0} x2={w} y1={height - height * f} y2={height - height * f}
          stroke="#1e3a8a" strokeWidth={1} strokeDasharray="4 4" />
      ))}
      {data.map((d, i) => {
        const h = Math.max(2, (d[valueKey] ?? 0) / max * height);
        const x = i * (w / data.length) + (w / data.length - barW) / 2;
        return (
          <g key={i}>
            <rect x={x} y={height - h} width={barW} height={h} rx={3} fill={color} opacity={0.85}>
              <title>{`${d[labelKey]}: ${d[valueKey]}`}</title>
            </rect>
            {i % Math.ceil(data.length / 8) === 0 && (
              <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize={9} fill="#475569">
                {String(d[labelKey]).slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ data, height = 160, color = '#60a5fa', valueKey = 'requests', labelKey = 'date' }) {
  const max = Math.max(1, ...data.map(d => d[valueKey] ?? 0));
  const w = Math.max(280, data.length * 26);

  const points = data.map((d, i) => {
    const x = i === 0 ? 4 : 4 + (i / (data.length - 1)) * (w - 8);
    const y = height - ((d[valueKey] ?? 0) / max) * (height - 8) - 4;
    return [x, y];
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = `${line} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${height + 28}`} className="w-full" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`lg-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#lg-${valueKey})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={2.5} fill={color}>
            <title>{`${data[i][labelKey]}: ${data[i][valueKey]}`}</title>
          </circle>
          {i % Math.ceil(data.length / 8) === 0 && (
            <text x={p[0]} y={height + 16} textAnchor="middle" fontSize={9} fill="#475569">
              {String(data[i][labelKey]).slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
