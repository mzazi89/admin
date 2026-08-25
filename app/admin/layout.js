'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';

const LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/transactions', label: 'Transactions' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/packages', label: 'Packages' },
  { href: '/admin/vouchers', label: 'Vouchers' },
  { href: '/admin/testimonials', label: 'Testimonials' },
  { href: '/admin/inquiries', label: 'Inquiries' },
  { href: '/admin/commands', label: 'Bot Commands' },
  { href: '/admin/bot', label: 'Bot Control' },
  { href: '/admin/sessions', label: 'Sessions' },
  { href: '/admin/panel', label: 'Manage Panel' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/api/admin', label: 'API Admin' },
];

const pad = (i) => String(i + 1).padStart(2, '0');

// Unified admin shell — sidebar navigation (login page stays clean)
export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
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

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login'); };

  if (isLogin) return <>{children}</>;

  const isActive = (href) =>
    pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="flex min-h-screen">
        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden md:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen"
          style={{ backgroundColor: '#0F1215', borderRight: '1px solid #262C33' }}>
          <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid #1B2026' }}>
            <Link href="/admin/dashboard" style={{ textDecoration: 'none' }}>
              <Logo size={30} withText />
            </Link>
            <p className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4C535B', marginTop: 10 }}>
              Control · v1
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {LINKS.map((l, i) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="mono flex items-baseline gap-3 px-3 py-2"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    color: active ? '#F2A93B' : '#79818A',
                    backgroundColor: active ? 'rgba(242,169,59,0.06)' : 'transparent',
                    borderLeft: `2px solid ${active ? '#F2A93B' : 'transparent'}`,
                    transition: 'color .15s ease, background-color .15s ease',
                  }}
                >
                  <span style={{ fontSize: 10, color: active ? 'rgba(242,169,59,0.6)' : '#4C535B' }}>{pad(i)}</span>
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-4 py-4 space-y-2" style={{ borderTop: '1px solid #1B2026' }}>
            <Link href="/" className="mono block text-center btn btn-ghost"
              style={{ fontSize: 10, padding: '9px 14px', textDecoration: 'none' }}>
              Back to site
            </Link>
            <button onClick={logout} className="btn btn-ghost w-full"
              style={{ fontSize: 10, padding: '9px 14px', color: '#E5484D', borderColor: 'rgba(229,72,77,0.35)' }}>
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Mobile top bar ── */}
        <div className="md:hidden w-full">
          <div className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: '#0F1215', borderBottom: '1px solid #262C33' }}>
            <Link href="/admin/dashboard" style={{ textDecoration: 'none' }}>
              <Logo size={26} />
            </Link>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Open admin menu"
                aria-expanded={menuOpen}
                className="mono flex items-center gap-2 px-3 py-2"
                style={{ color: '#AEB5BD', border: '1px solid #262C33', backgroundColor: menuOpen ? 'rgba(242,169,59,0.06)' : 'transparent', cursor: 'pointer', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 3.5h12M1 7h12M1 10.5h12" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                Menu
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-11 w-60 py-2 z-50"
                  style={{ backgroundColor: '#14181D', border: '1px solid #262C33', boxShadow: '0 18px 44px rgba(0,0,0,0.45)' }}>
                  <div className="mono px-4 py-2 mb-1" style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4C535B' }}>
                    Admin sections
                  </div>
                  {LINKS.map((l, i) => {
                    const active = isActive(l.href);
                    return (
                      <Link key={l.href} href={l.href}
                        className="mono flex items-baseline gap-3 px-4 py-2.5"
                        style={{
                          fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none',
                          backgroundColor: active ? 'rgba(242,169,59,0.06)' : 'transparent',
                          color: active ? '#F2A93B' : '#79818A',
                        }}>
                        <span style={{ fontSize: 10, color: active ? 'rgba(242,169,59,0.6)' : '#4C535B' }}>{pad(i)}</span>
                        <span>{l.label}</span>
                      </Link>
                    );
                  })}
                  <div className="mt-1 px-4 py-3 flex gap-2" style={{ borderTop: '1px solid #1B2026' }}>
                    <Link href="/" className="mono btn btn-ghost flex-1" style={{ fontSize: 10, padding: '8px 10px', textDecoration: 'none' }}>
                      Site
                    </Link>
                    <button onClick={logout} className="mono btn btn-ghost flex-1"
                      style={{ fontSize: 10, padding: '8px 10px', color: '#E5484D', borderColor: 'rgba(229,72,77,0.35)' }}>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="page-pad">{children}</div>
        </div>

        {/* ── Desktop content ── */}
        <main className="hidden md:block flex-1 page-pad" style={{ minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
