'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/transactions', label: 'Transactions', icon: '💸' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/packages', label: 'Packages', icon: '📦' },
  { href: '/admin/vouchers', label: 'Vouchers', icon: '🎟️' },
  { href: '/admin/testimonials', label: 'Testimonials', icon: '⭐' },
  { href: '/api/admin', label: 'API Admin', icon: '🔌' },
  { href: '/admin/commands', label: 'Bot Commands', icon: '📜' },
  { href: '/admin/bot', label: 'Bot Control', icon: '🤖' },
];

// Unified admin shell with sidebar navigation (login page stays clean)
export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // close the dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // close when the route changes
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  if (isLogin) return <>{children}</>;

  return (
    <div style={{ backgroundColor: '#020409', minHeight: '100vh' }}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-60 flex-shrink-0 sticky top-0 h-screen p-4"
          style={{ backgroundColor: '#02040a', borderRight: '1px solid #1e3a8a' }}>
          <Link href="/" className="flex items-center gap-2 mb-6" style={{ textDecoration: 'none' }}>
            <span className="text-lg">⚡</span>
            <span className="font-extrabold" style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              MZAZI Admin
            </span>
          </Link>
          <nav className="space-y-1 flex-1">
            {LINKS.map(l => {
              const active = pathname === l.href || (l.href !== '/admin/dashboard' && pathname.startsWith(l.href));
              return (
                <Link key={l.href} href={l.href}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: active ? 'rgba(37,99,235,0.15)' : 'transparent',
                    color: active ? '#60a5fa' : '#94a3b8',
                    border: `1px solid ${active ? 'rgba(37,99,235,0.4)' : 'transparent'}`,
                    textDecoration: 'none',
                  }}>
                  <span>{l.icon}</span>
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </nav>
          <Link href="/" className="text-xs" style={{ color: '#475569', textDecoration: 'none' }}>← Back to site</Link>
        </aside>

        {/* Mobile top nav */}
        <div className="md:hidden w-full">
          <div className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: '#02040a', borderBottom: '1px solid #1e3a8a' }}>
            <span className="font-extrabold text-sm" style={{ color: '#f0f4ff' }}>⚡ MZAZI Admin</span>
            {/* ☰ button on the RIGHT */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Admin menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg cursor-pointer"
                style={{ color: '#94a3b8', border: '1px solid #1e3a8a', backgroundColor: menuOpen ? 'rgba(37,99,235,0.12)' : 'transparent' }}>
                <span className="text-base leading-none">☰</span>
                <span className="text-xs font-semibold">Menu</span>
              </button>
              {/* portrait dropdown — small rectangle below the button, right-aligned */}
              {menuOpen && (
                <div className="absolute right-0 top-12 w-56 rounded-2xl p-2 z-50"
                  style={{ backgroundColor: '#02040a', border: '1px solid #1e3a8a', boxShadow: '0 10px 34px rgba(0,0,0,0.55)' }}>
                  <div className="px-3 py-2 mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>
                    Admin Menu
                  </div>
                  {LINKS.map(l => (
                    <Link key={l.href} href={l.href}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold"
                      style={{
                        backgroundColor: pathname === l.href ? 'rgba(37,99,235,0.15)' : 'transparent',
                        color: pathname === l.href ? '#60a5fa' : '#94a3b8',
                        textDecoration: 'none',
                      }}>
                      <span>{l.icon}</span>
                      <span>{l.label}</span>
                    </Link>
                  ))}
                  <Link href="/" className="block px-3 py-2 mt-1 rounded-lg text-xs"
                    style={{ color: '#475569', textDecoration: 'none', borderTop: '1px solid #1e3a8a' }}>
                    ← Back to site
                  </Link>
                </div>
              )}
            </div>
          </div>
          <div className="p-4">{children}</div>
        </div>

        {/* Desktop content */}
        <main className="hidden md:block flex-1 p-8" style={{ minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
