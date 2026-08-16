// Route-level loading fallback (Suspense) — branded, matches the Ink & Bolt system
export default function Loading() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <div className="spinner" />
      <div
        className="mono"
        style={{ fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: '#4C535B' }}
      >
        Mzazi Tech
      </div>
    </div>
  );
}
