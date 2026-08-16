import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-site page-pad" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div className="relative" style={{ maxWidth: 720 }}>
        <span className="eyebrow mb-6" style={{ display: 'flex' }}>Error 404</span>
        <h1 className="headline" style={{ fontSize: 'clamp(3rem, 9vw, 6rem)' }}>
          Page not<br />found
        </h1>
        <p className="lede mt-6 mb-10" style={{ maxWidth: 420 }}>
          The page you are looking for does not exist or has been moved. Head back to the admin panel.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/dashboard" className="btn btn-primary">Go to dashboard</Link>
          <Link href="/" className="btn btn-ghost">Back to site</Link>
        </div>
        <div className="mono mt-16" style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4C535B' }}>
          Mzazi Tech Inc · Admin console
        </div>
      </div>
    </div>
  );
}
