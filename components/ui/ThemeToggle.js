'use client';

// MZAZI TECH — light / dark / system switch.
//
// Two presentations:
//   <ThemeToggle />            single button, cycles light → dark → system
//   <ThemeToggle variant="segmented" />  explicit 3-way control (Settings page)

import { useTheme } from './ThemeProvider';
import { Sun, Moon, Monitor } from './Icons';

const ORDER = ['light', 'dark', 'system'];

const LABEL = { light: 'Light', dark: 'Dark', system: 'System' };
const ICON = { light: Sun, dark: Moon, system: Monitor };

export default function ThemeToggle({ variant = 'button', className = '', showLabel = false }) {
  const { theme, resolved, setTheme } = useTheme();

  if (variant === 'segmented') {
    return (
      <div className={`segmented ${className}`} role="radiogroup" aria-label="Colour theme">
        {ORDER.map((value) => {
          const Glyph = ICON[value];
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? 'is-active' : ''}
              onClick={() => setTheme(value)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Glyph size={15} />
                {LABEL[value]}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Glyph = theme === 'system' ? Monitor : (resolved === 'dark' ? Moon : Sun);

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={`icon-btn ${className}`}
      title={`Theme: ${LABEL[theme]} — switch to ${LABEL[next]}`}
      aria-label={`Colour theme: ${LABEL[theme]}. Switch to ${LABEL[next]}.`}
    >
      <Glyph size={17} />
      {showLabel && <span style={{ marginLeft: 8, fontSize: 13.5, fontWeight: 600 }}>{LABEL[theme]}</span>}
    </button>
  );
}
