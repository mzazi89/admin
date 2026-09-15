/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // Theme is driven by data-theme on <html> (set by ThemeProvider, no FOUC).
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    extend: {
      colors: {
        /* ── Brand purple (primary) ─────────────────────────────────── */
        brand: {
          50:  '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD',
          400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9',
          800: '#5B21B6', 900: '#4C1D95',
          DEFAULT: 'var(--brand)',
        },
        /* ── Secondary soft blue (accents only) ────────────────────── */
        azure: {
          50:  '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
          400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
          800: '#1E40AF', 900: '#1E3A8A',
          DEFAULT: 'var(--blue)',
        },
        /* ── Semantic, theme-aware surfaces & text ─────────────────── */
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          page: 'var(--bg)',
          raised: 'var(--bg-2)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          soft: 'var(--ink-2)',
          mute: 'var(--muted)',
          dim: 'var(--dim)',
        },
        line: {
          DEFAULT: 'var(--line)',
          soft: 'var(--line-soft)',
        },
        tok: {
          brand: 'var(--brand)',
          blue: 'var(--blue)',
          good: 'var(--good)',
          bad: 'var(--bad)',
          warn: 'var(--warn)',
        },

        /* ── Legacy aliases ────────────────────────────────────────────
           v1 ("Ink & Bolt") theme names, re-pointed at the new tokens so any
           dynamic or missed usage keeps resolving instead of rendering an
           undefined colour class. */
        base: {
          DEFAULT: 'var(--bg)',
          raised: 'var(--bg-2)',
          surface: 'var(--surface)',
          surface2: 'var(--surface-2)',
        },
        amber:  { DEFAULT: 'var(--brand)', deep: 'var(--brand-deep)', bright: 'var(--brand-bright)' },
        cobalt: { DEFAULT: 'var(--blue)',  deep: 'var(--blue-deep)' },
        good: 'var(--good)',
        bad:  'var(--bad)',
        warn: 'var(--warn)',
      },

      fontFamily: {
        display: ['Space Grotesk', 'Manrope', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'brand-gradient': 'linear-gradient(100deg, var(--brand), var(--blue))',
      },

      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)',
        lg: 'var(--r-lg)', xl: 'var(--r-xl)', '2xl': '26px',
      },

      boxShadow: {
        xs: 'var(--shadow-xs)',
        lift: 'var(--shadow-md)',
        brand: 'var(--shadow-brand)',
        amber: 'var(--shadow-brand)',   // legacy alias
      },

      screens: {
        xs: '420px',
        '3xl': '1600px',
      },

      maxWidth: { site: '1200px' },

      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
