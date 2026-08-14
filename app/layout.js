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
      <body className="flex flex-col min-h-screen" style={{ backgroundColor: 'rgba(2,4,9,0.92)', color: '#f0f4ff' }}>
        {children}
        <ClickLoader />
      </body>
    </html>
  );
}
