'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import {
  AppBackground, RouteBackdrop, Alert, Button, Card, Field, Input, ThemeProvider, ToastProvider, ThemeToggle,
  humaniseError, Icons,
} from '@/components/ui';

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then((r) => { if (r.ok) router.replace('/admin/dashboard'); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push('/admin/dashboard');
      } else {
        // Never surface the raw message — humaniseError translates short,
        // already-human API copy and falls back to friendly text otherwise.
        setError(humaniseError(data.error, 'Those details did not match. Please check and try again.'));
        setLoading(false);
      }
    } catch (err) {
      setError(humaniseError(err, 'We could not reach the server. Check your connection and try again.'));
      setLoading(false);
    }
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <AppBackground variant="auth" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <RouteBackdrop />
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}>
            <ThemeToggle />
          </div>

          {/* app-content: without a stacking context the fixed backdrop paints
              OVER this card, which is what made the admin look washed out. */}
          <div className="app-content" style={{ width: '100%', maxWidth: 430 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
              <Logo size={38} withText />
            </div>

            <Card pad={false} style={{ padding: '28px 26px' }} className="anim-fade-up">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Restricted access</div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 5vw, 2rem)', fontWeight: 700 }}>
                Admin portal
              </h1>
              <p style={{ margin: '8px 0 20px', color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6 }}>
                Authorised staff only. All admin activity is logged and monitored.
              </p>

              {error && (
                <div className="anim-fade-up" style={{ marginBottom: 18 }}>
                  <Alert kind="error">{error}</Alert>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <Field label="Admin email" id="admin-email" required>
                  <Input
                    id="admin-email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="admin@mzazi.shop"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </Field>

                <Field label="Password" id="admin-password" required>
                  <Input
                    id="admin-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </Field>

                <Button
                  type="submit"
                  block
                  size="lg"
                  loading={loading}
                  loadingText="Authenticating…"
                  icon={<Icons.Shield size={16} />}
                  style={{ marginTop: 6 }}
                >
                  Access panel
                </Button>
              </form>
            </Card>

            <p className="mono" style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>
              Mzazi Tech Inc · 2026
            </p>
          </div>
        </AppBackground>
      </ToastProvider>
    </ThemeProvider>
  );
}
