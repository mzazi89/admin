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
    background_color: '#F6F7FB',
    theme_color: '#7C3AED',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Dashboard', url: '/admin/dashboard', icons: [{ src: '/icon', sizes: '512x512' }] },
      { name: 'Devices', url: '/admin/sessions', icons: [{ src: '/icon', sizes: '512x512' }] },
      { name: 'Broadcast', url: '/admin/broadcast', icons: [{ src: '/icon', sizes: '512x512' }] },
    ],
  };
}
