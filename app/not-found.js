import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-site py-28 text-center" style={{ minHeight: '70vh' }}>
      <p className="text-7xl font-extrabold mb-4" style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>404</p>
      <h1 className="text-2xl font-extrabold mb-3" style={{ color: '#f0f4ff' }}>Page Not Found</h1>
      <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: '#94a3b8' }}>
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="px-6 py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', textDecoration: 'none' }}>Back to Home</Link>
        <Link href="/api" className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ color: '#60a5fa', border: '1px solid rgba(37,99,235,0.35)', textDecoration: 'none' }}>Explore the API</Link>
        <Link href="/contact" className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ color: '#94a3b8', border: '1px solid #1e3a8a', textDecoration: 'none' }}>Contact Support</Link>
      </div>
    </div>
  );
}
