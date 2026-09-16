import TechBackground from '@/components/TechBackground';
import ClickLoader from '@/components/ClickLoader';
import { THEME_BOOT_SCRIPT } from '@/components/ui/ThemeProvider';
import './globals.css';
// The code editor's own stylesheet. Split out because it is a self-contained
// widget whose two code layers have to agree on every text metric to the pixel;
// keeping those declarations in one short file makes that invariant visible
// instead of hidden among 1400 lines of unrelated rules.
import './code-editor.css';

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
        <meta name="theme-color" content="#FBFBFD" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0A0A0F" media="(prefers-color-scheme: dark)" />
        {/* Applies the saved theme before first paint — no flash of the wrong mode. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
        {/* Ambient background — sits behind everything */}
        <TechBackground />
        <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>{children}</main>
        <ClickLoader />
      </body>
    </html>
  );
}
