'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import {
  AppBackground, RouteBackdrop, ThemeProvider, ToastProvider, ThemeToggle, Icons,
} from '@/components/ui';

// Grouped admin navigation. Labels are friendly; hrefs are unchanged.
// NOTE: /admin/bot (Bot Control) is preserved under "More" — the redesign spec
// did not list it, but the feature must stay reachable from the shell.
const GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/admin/users', label: 'Users', icon: Icons.Users },
      { href: '/admin/sessions', label: 'Devices', icon: Icons.Phone },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: Icons.CreditCard },
      { href: '/admin/transactions', label: 'Payments', icon: Icons.Wallet },
      { href: '/admin/vouchers', label: 'Coupons', icon: Icons.Ticket },
    ],
  },
  {
    label: 'Messaging',
    items: [
      { href: '/admin/commands', label: 'Commands', icon: Icons.Command },
      { href: '/admin/broadcast', label: 'Broadcast', icon: Icons.Send },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/admin/packages', label: 'Packages', icon: Icons.Sparkles },
      { href: '/admin/vps', label: 'VPS Store', icon: Icons.Zap },
      { href: '/admin/resellers', label: 'Resellers', icon: Icons.User },
    ],
  },
  {
    label: 'More',
    items: [
      { href: '/admin/panel-host', label: 'Panel Hosting', icon: Icons.Home },
      { href: '/admin/panel', label: 'Manage Panel', icon: Icons.Shield },
      { href: '/admin/bot', label: 'Bot Control', icon: Icons.Bot },
      { href: '/admin/inquiries', label: 'Inquiries', icon: Icons.Help },
      { href: '/admin/testimonials', label: 'Testimonials', icon: Icons.CheckCircle },
      { href: '/api/admin', label: 'API Admin', icon: Icons.Link },
      { href: '/admin/settings', label: 'Settings', icon: Icons.Settings },
    ],
  },
];

function isActiveHref(pathname, href) {
  if (pathname === href) return true;
  if (href === '/admin/dashboard' || href === '/api/admin') return false;
  return pathname.startsWith(href);
}

/** The grouped navigation, shared by the desktop rail and the mobile drawer. */
function SidebarNav({ pathname, mobile = false, collapsed, onToggleGroup, onNavigate }) {
  return (
    <nav aria-label="Admin sections" style={{ padding: '8px 12px 16px' }}>
      {GROUPS.map((group) => {
        const isCollapsed = mobile && collapsed[group.label];
        return (
          <div key={group.label} style={{ marginBottom: 6 }}>
            {mobile ? (
              <button
                type="button"
                onClick={() => onToggleGroup(group.label)}
                aria-expanded={!isCollapsed}
                className="side-group-label"
                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 0, cursor: 'pointer' }}
              >
                <span>{group.label}</span>
                <span aria-hidden="true" style={{ transition: 'transform var(--dur) var(--ease)', transform: isCollapsed ? 'none' : 'rotate(90deg)', display: 'inline-flex' }}>
                  <Icons.ChevronRight size={13} />
                </span>
              </button>
            ) : (
              <div className="side-group-label">{group.label}</div>
            )}

            {!isCollapsed && (
              <div style={{ display: 'grid', gap: 2 }}>
                {group.items.map((item) => {
                  const Glyph = item.icon;
                  const active = isActiveHref(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={`side-link ${active ? 'is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 auto' }}><Glyph size={17} /></span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// Unified admin shell — grouped sidebar (login page stays a clean shell).
export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Only "More" starts collapsed on mobile, so the primary sections stay visible.
  const [collapsed, setCollapsed] = useState({ More: true });

  // close the drawer when the route changes
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // lock body scroll while the drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  const toggleGroup = (label) => setCollapsed((c) => ({ ...c, [label]: !c[label] }));

  const shell = isLogin ? (
    <>{children}</>
  ) : (
    <AppBackground variant="admin">
      {/* Wallpaper/photo that matches the current admin page */}
      <RouteBackdrop />
    <div style={{ minHeight: '100vh' }}>
      {/* ── Desktop sidebar (fixed) ── */}
      <aside
        className="hidden md:flex flex-col"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 'var(--sidebar-w)', zIndex: 45,
          backgroundColor: 'var(--bg-2)', borderRight: '1px solid var(--line)',
        }}
      >
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Link href="/admin/dashboard" style={{ textDecoration: 'none' }}>
            <Logo size={28} withText />
          </Link>
          <ThemeToggle />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          <SidebarNav pathname={pathname} />
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--line-soft)', display: 'grid', gap: 8 }}>
          <Link href="/" className="btn btn-ghost btn-block" style={{ textDecoration: 'none', fontSize: 13 }}>
            <span>Back to site</span>
          </Link>
          <button type="button" onClick={logout} className="btn btn-ghost btn-block" style={{ color: 'var(--bad)', fontSize: 13 }}>
            <span><Icons.LogOut size={15} style={{ verticalAlign: '-3px', marginRight: 7 }} />Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden">
        <div className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px' }}>
          <Link href="/admin/dashboard" style={{ textDecoration: 'none' }}>
            <Logo size={24} withText />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <button
              type="button"
              className="icon-btn"
              aria-label="Open admin menu"
              aria-expanded={drawerOpen}
              aria-haspopup="dialog"
              onClick={() => setDrawerOpen(true)}
            >
              <Icons.Menu size={19} />
            </button>
          </div>
        </div>
        <div className="page-pad">{children}</div>
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <>
          <div className="overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Admin menu">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '16px 16px 12px', borderBottom: '1px solid var(--line-soft)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <Link href="/admin/dashboard" onClick={() => setDrawerOpen(false)} style={{ textDecoration: 'none' }}>
                <Logo size={24} withText />
              </Link>
              <button type="button" className="icon-btn" aria-label="Close admin menu" onClick={() => setDrawerOpen(false)}>
                <Icons.X size={17} />
              </button>
            </div>

            <SidebarNav
              pathname={pathname}
              mobile
              collapsed={collapsed}
              onToggleGroup={toggleGroup}
              onNavigate={() => setDrawerOpen(false)}
            />

            <div style={{ padding: 16, borderTop: '1px solid var(--line-soft)', display: 'grid', gap: 8 }}>
              <Link href="/" className="btn btn-ghost btn-block" style={{ textDecoration: 'none', fontSize: 13 }}>
                <span>Back to site</span>
              </Link>
              <button type="button" onClick={logout} className="btn btn-ghost btn-block" style={{ color: 'var(--bad)', fontSize: 13 }}>
                <span><Icons.LogOut size={15} style={{ verticalAlign: '-3px', marginRight: 7 }} />Sign out</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── Desktop content ── */}
      <main className="hidden md:block md:ml-[var(--sidebar-w)]" style={{ minWidth: 0 }}>
        <div className="page-pad">{children}</div>
      </main>
    </div>
    </AppBackground>
  );

  return (
    <ThemeProvider>
      <ToastProvider>{shell}</ToastProvider>
    </ThemeProvider>
  );
}
