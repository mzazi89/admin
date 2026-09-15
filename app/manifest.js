// PWA manifest — served at /manifest.webmanifest
export default function manifest() {
  return {
    name: 'MZAZI TECH — Admin Panel',
    short_name: 'MZAZI Admin',
    description: 'MZAZI TECH operations panel — users, transactions, packages, bot control and sessions.',
    id: 'mzazi-admin',
    start_url: '/admin/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FBFBFD',
    theme_color: '#7C3AED',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Dashboard', url: '/admin/dashboard', icons: [{ src: '/icon', sizes: '512x512' }] },
      { name: 'Devices', url: '/admin/sessions', icons: [{ src: '/icon', sizes: '512x512' }] },
      { name: 'Broadcast', url: '/admin/broadcast', icons: [{ src: '/icon', sizes: '512x512' }] },
    ],
  };
}
