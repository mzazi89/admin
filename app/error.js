'use client';

// Global error boundary — professional error state instead of a white screen
export default function GlobalError({ error, reset }) {
  return (
    <div className="container-site page-pad" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 680 }}>
        <span className="eyebrow mb-6" style={{ display: 'flex' }}>System error</span>
        <h1 className="headline" style={{ fontSize: 'clamp(2.2rem, 6vw, 3.4rem)' }}>
          Something went<br />wrong
        </h1>
        <p className="lede mt-6 mb-10" style={{ maxWidth: 440 }}>
          An unexpected error occurred. Try again — if it keeps happening, contact support.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => reset()} className="btn btn-primary">Try again</button>
          <a href="/admin/dashboard" className="btn btn-ghost">Back to dashboard</a>
        </div>
      </div>
    </div>
  );
}
