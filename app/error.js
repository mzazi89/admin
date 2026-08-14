'use client';

// Global error boundary — professional error state instead of a white screen
export default function GlobalError({ error, reset }) {
  return (
    <div className="container-site py-28 text-center" style={{ minHeight: '70vh' }}>
      <p className="text-5xl mb-4">😵</p>
      <h1 className="text-2xl font-extrabold mb-3" style={{ color: '#f0f4ff' }}>Something went wrong</h1>
      <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: '#94a3b8' }}>
        An unexpected error occurred. Please try again — if it keeps happening, contact our support team.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={() => reset()}
          className="px-6 py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', cursor: 'pointer' }}>
          Try Again
        </button>
        <a href="/" className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ color: '#94a3b8', border: '1px solid #1e3a8a', textDecoration: 'none' }}>Back to Home</a>
      </div>
    </div>
  );
}
