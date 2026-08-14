'use client';

const contributors = [
  {
    name: 'DOMINIC MOKUA KERUBO',
    role: 'Founder',
    company: 'Mzazi Tech',
    initials: 'DM',
    color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    glow: 'rgba(37,99,235,0.35)',
    badge: '🚀',
  },
  {
    name: 'ANTONY OCHIENG',
    role: 'Founder',
    company: 'Blacklord Tech',
    initials: 'AO',
    color: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
    glow: 'rgba(124,58,237,0.35)',
    badge: '⚡',
  },
  {
    name: 'BIG BROTHER',
    role: 'Founder',
    company: 'Darknode XMD',
    initials: 'BB',
    color: 'linear-gradient(135deg, #0f766e, #0d9488)',
    glow: 'rgba(15,118,110,0.35)',
    badge: '🌐',
  },
];

function ContributorCard({ c }) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(22,24,42,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1e3a8a',
        borderRadius: '20px',
        padding: '36px 28px',
        textAlign: 'center',
        transition: 'transform 0.25s, box-shadow 0.25s, border-color 0.25s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.boxShadow = `0 12px 40px ${c.glow}`;
        e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = '#1e3a8a';
      }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: c.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '26px', fontWeight: 800, color: '#fff',
          boxShadow: `0 0 28px ${c.glow}`,
          margin: '0 auto',
        }}>
          {c.initials}
        </div>
        <div style={{
          position: 'absolute', bottom: 0, right: -4,
          width: '28px', height: '28px', borderRadius: '50%',
          backgroundColor: 'rgba(2,4,9,0.45)', border: '2px solid #1e3a8a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px',
        }}>
          {c.badge}
        </div>
      </div>

      <h3 style={{ color: '#f0f4ff', fontWeight: 800, fontSize: '16px', marginBottom: '6px', lineHeight: 1.3 }}>
        {c.name}
      </h3>
      <p style={{ color: '#60a5fa', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{c.role}</p>
      <p style={{ color: '#475569', fontSize: '13px' }}>{c.company}</p>
      <div style={{ width: '40px', height: '2px', margin: '16px auto 0', background: c.color, borderRadius: '2px' }} />
    </div>
  );
}

export default function Contributors() {
  return (
    <section className="py-20" style={{ backgroundColor: 'rgba(2,4,9,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
            style={{ backgroundColor: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)' }}>
            <span style={{ color: '#60a5fa', fontSize: '14px', fontWeight: 600 }}>🤝 Project Contributors</span>
          </div>
          <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#f0f4ff' }}>Built by Visionaries</h2>
          <p style={{ color: '#64748b', maxWidth: '480px', margin: '0 auto' }}>
            The founders and innovators who brought this platform to life.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {contributors.map(c => <ContributorCard key={c.name} c={c} />)}
        </div>
      </div>
    </section>
  );
}
