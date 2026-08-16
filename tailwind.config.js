/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#E9E7E2',
          soft: '#AEB5BD',
          mute: '#79818A',
          dim: '#4C535B',
        },
        base: {
          DEFAULT: '#0B0D0F',
          raised: '#0F1215',
          surface: '#14181D',
          surface2: '#1A1F25',
        },
        line: {
          DEFAULT: '#262C33',
          soft: '#1B2026',
        },
        amber: {
          DEFAULT: '#F2A93B',
          deep: '#C97F1E',
          bright: '#FFB84A',
        },
        cobalt: {
          DEFAULT: '#4C7DFC',
          deep: '#2E55D0',
        },
        good: '#3ECF8E',
        bad: '#E5484D',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Manrope', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'lift': '0 18px 44px rgba(0,0,0,0.35)',
        'amber': '0 8px 24px rgba(242,169,59,0.22)',
      },
      keyframes: {
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(14px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}
