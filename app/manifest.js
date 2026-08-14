// PWA manifest — served at /manifest.webmanifest
export default function manifest() {
  return {
    name: 'MZAZI TECH — Panels, Bots & API',
    short_name: 'MZAZI',
    description: 'Game panels, WhatsApp bots, wallet, and the MZAZI API platform — one account for everything.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#020409',
    theme_color: '#020409',
    categories: ['productivity', 'utilities', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'API Dashboard', url: '/api/dashboard', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Deploy Panel', url: '/products', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
