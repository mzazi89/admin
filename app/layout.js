import TechBackground from '@/components/TechBackground';
import ClickLoader from '@/components/ClickLoader';
import './globals.css';

export const metadata = {
  title: 'MZAZI TECH — Admin',
  description: 'MZAZI TECH admin panel (shares the same Neon database as the main site)',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0B0D0F" />
      </head>
      <body style={{ backgroundColor: '#0B0D0F', color: '#E9E7E2', minHeight: '100vh' }}>
        {/* Ambient background — sits behind everything */}
        <TechBackground />
        <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>{children}</main>
        <ClickLoader />
      </body>
    </html>
  );
}
