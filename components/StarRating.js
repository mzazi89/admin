'use client';
import { useState } from 'react';

// Interactive 5-star rating input (readonly mode for display)
export default function StarRating({ value, onChange, readonly = false }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange && onChange(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          style={{
            background: 'none', border: 'none',
            cursor: readonly ? 'default' : 'pointer',
            padding: '2px',
            fontSize: readonly ? '18px' : '24px',
            color: star <= (hovered || value) ? '#facc15' : '#334155',
            transition: 'color 0.15s',
          }}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >★</button>
      ))}
    </div>
  );
}
