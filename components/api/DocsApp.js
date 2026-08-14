'use client';
import { useState, useMemo } from 'react';
import EndpointTester from './EndpointTester';
import CodeBlock from './CodeBlock';

const CATEGORY_LABELS = {
  DOWNLOAD: 'Download', SEARCH: 'Search', AI: 'AI', 'AI MUSIC': 'AI Music', ANIME: 'Anime',
  CANVAS: 'Canvas', FUN: 'Fun', GAMES: 'Games', 'IMAGE GENERATION': 'Image Generation',
  TOOLS: 'Tools', MEDIA: 'Media', SOCIAL: 'Social', UTILITY: 'Utility', MOVIES: 'Movies',
  NEWS: 'News', RANDOM: 'Random', STALK: 'Stalk', SPORTS: 'Sports', UPLOADER: 'Uploader',
  'URL SHORTENER': 'URL Shortener',
};
const CATEGORY_ICONS = {
  DOWNLOAD: '⬇️', SEARCH: '🔍', AI: '🤖', 'AI MUSIC': '🎵', ANIME: '🎌', CANVAS: '🎨',
  FUN: '🎉', GAMES: '🎮', 'IMAGE GENERATION': '🖼️', TOOLS: '🛠️', MEDIA: '🎬', SOCIAL: '📱',
  UTILITY: '⚙️', MOVIES: '🎥', NEWS: '📰', RANDOM: '🎲', STALK: '🕵️', SPORTS: '🏆',
  UPLOADER: '📤', 'URL SHORTENER': '🔗',
};

const GUIDES = [
  {
    id: 'auth', title: 'Authentication',
    body: `All data endpoints require a MZAZI API key. Pass it as the apikey query parameter or as an Authorization: Bearer header. Create keys from the dashboard — full keys are shown only once.`,
    code: `GET ${typeof window !== 'undefined' ? window.location.origin : 'https://mzazi.shop'}/api/search/google?q=music&apikey=mzazi_xxxxxxxxx`,
  },
  {
    id: 'rate-limits', title: 'Rate Limits',
    body: `Every key has a daily quota by plan: FREE 100, PREMIUM 10,000, BUSINESS 100,000, ADMIN unlimited. Responses include X-RateLimit-Limit, X-RateLimit-Remaining and X-RateLimit-Reset headers.`,
    code: null,
  },
  {
    id: 'errors', title: 'Errors',
    body: `Errors always use the same envelope: { "status": false, "creator": "MZAZI TECH", "error": "CODE", "message": "..." }. Common codes: MISSING_API_KEY (401), INVALID_API_KEY (401), MISSING_PARAMETER (400), RATE_LIMITED (429), PROVIDER_ERROR (502), PROVIDER_TIMEOUT (504), ENDPOINT_DISABLED (404), INTERNAL_ERROR (500).`,
    code: `{"status": false, "creator": "MZAZI TECH", "error": "INVALID_API_KEY", "message": "The provided API key is invalid."}`,
  },
];

export default function DocsApp({ endpoints }) {
  const [tab, setTab] = useState('endpoints');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [expanded, setExpanded] = useState(null);

  const activeCount = endpoints.filter(e => e.is_active).length;

  const categories = useMemo(() => {
    const map = new Map();
    for (const e of endpoints) {
      const c = e.category || 'UTILITY';
      const cur = map.get(c) || { total: 0, active: 0 };
      cur.total += 1;
      if (e.is_active) cur.active += 1;
      map.set(c, cur);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.active - a.active);
  }, [endpoints]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return endpoints.filter(e => {
      if (activeCategory !== 'ALL' && e.category !== activeCategory) return false;
      if (!q) return true;
      return e.path.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q);
    });
  }, [endpoints, search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      const c = e.category || 'UTILITY';
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  const BASE = typeof window !== 'undefined' ? window.location.origin : 'https://mzazi.shop';

  return (
    <div className="container-site py-12" style={{ minHeight: '70vh' }}>
      {/* Header */}
      <div className="mb-6">
        <a href="/api" className="text-xs font-semibold" style={{ color: '#475569', textDecoration: 'none' }}>← Back to API</a>
        <h1 className="text-3xl font-extrabold mt-2"><span className="gradient-text">MZAZI API Documentation</span></h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
          {activeCount} live endpoints · every endpoint below calls the real API.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[['endpoints', 'Endpoints'], ['guides', 'Guides']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              backgroundColor: tab === id ? 'rgba(37,99,235,0.15)' : 'transparent',
              color: tab === id ? '#60a5fa' : '#94a3b8',
              border: `1px solid ${tab === id ? 'rgba(37,99,235,0.4)' : '#1e3a8a'}`,
              cursor: 'pointer',
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'guides' ? (
        <div className="max-w-2xl space-y-6">
          {GUIDES.map(g => (
            <section key={g.id} className="card p-6">
              <h2 className="font-bold mb-2" style={{ color: '#f0f4ff' }}>{g.title}</h2>
              <p className="text-sm leading-relaxed mb-3" style={{ color: '#94a3b8' }}>{g.body}</p>
              {g.code && <CodeBlock label={g.title} code={g.code} />}
            </section>
          ))}
          <section className="card p-6">
            <h2 className="font-bold mb-2" style={{ color: '#f0f4ff' }}>Support</h2>
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              Need help? Check the <a href="/api/status" style={{ color: '#60a5fa' }}>status page</a>, the
              {' '}<a href="/api/explorer" style={{ color: '#60a5fa' }}>explorer</a>, or the
              {' '}<a href="/contact" style={{ color: '#60a5fa' }}>contact page</a>.
            </p>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="card p-4 sticky top-24">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search endpoints… (youtube, download, ai)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
                style={{ backgroundColor: '#020409', border: '1px solid #1e3a8a', color: '#f0f4ff' }}
              />
              <button onClick={() => { setActiveCategory('ALL'); setSearch(''); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: activeCategory === 'ALL' ? 'rgba(37,99,235,0.12)' : 'transparent', color: activeCategory === 'ALL' ? '#60a5fa' : '#94a3b8' }}>
                All categories <span className="text-xs" style={{ color: '#475569' }}>({activeCount} live)</span>
              </button>
              {categories.map(c => (
                <button key={c.name} onClick={() => setActiveCategory(activeCategory === c.name ? 'ALL' : c.name)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: activeCategory === c.name ? 'rgba(37,99,235,0.12)' : 'transparent', color: activeCategory === c.name ? '#60a5fa' : '#94a3b8' }}>
                  {CATEGORY_ICONS[c.name] || '📦'} {CATEGORY_LABELS[c.name] || c.name}
                  <span className="text-xs ml-1" style={{ color: '#475569' }}>{c.active}/{c.total}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Endpoint list */}
          <div className="lg:col-span-3 space-y-8">
            {grouped.length === 0 && (
              <div className="card p-12 text-center">
                <p className="text-sm" style={{ color: '#64748b' }}>No endpoints match your search.</p>
              </div>
            )}
            {grouped.map(([cat, eps]) => (
              <section key={cat} id={`cat-${encodeURIComponent(cat)}`} className="scroll-mt-24">
                <h2 className="text-lg font-bold mb-3" style={{ color: '#f0f4ff' }}>
                  {CATEGORY_ICONS[cat] || '📦'} {CATEGORY_LABELS[cat] || cat}
                  <span className="text-xs font-medium ml-2" style={{ color: '#475569' }}>
                    {eps.filter(e => e.is_active).length} live · {eps.length} total
                  </span>
                </h2>
                <div className="space-y-2">
                  {eps.map(e => {
                    const isOpen = expanded === e.path;
                    const req = (e.parameters?.required || []).map(p => (typeof p === 'string' ? p : p.name));
                    const opt = (e.parameters?.optional || []).map(p => (typeof p === 'string' ? p : p.name));
                    return (
                      <div key={e.path} className="card overflow-hidden" style={{ opacity: e.is_active ? 1 : 0.55 }}>
                        <button onClick={() => setExpanded(isOpen ? null : e.path)}
                          className="w-full flex flex-wrap items-center gap-3 px-5 py-3.5 text-left" style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: e.method === 'GET' ? '#1e3a8a' : '#4c1d95', color: e.method === 'GET' ? '#93c5fd' : '#c4b5fd' }}>
                            {e.method}
                          </span>
                          <code className="text-xs font-mono flex-1" style={{ color: '#e2e8f0' }}>{e.path}</code>
                          <span className="text-xs font-semibold hidden sm:block" style={{ color: '#94a3b8' }}>{e.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                            backgroundColor: e.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(100,116,139,0.1)',
                            color: e.is_active ? '#4ade80' : '#64748b',
                          }}>
                            {e.is_active ? 'LIVE' : 'NOT CONFIGURED'}
                          </span>
                          <span className="text-xs" style={{ color: '#475569' }}>{isOpen ? '−' : '+'}</span>
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #060b16' }}>
                            <p className="text-sm pt-4" style={{ color: '#94a3b8' }}>
                              {e.description || e.name} · Provider: <code className="text-xs" style={{ color: '#93c5fd' }}>{e.provider || '—'}</code>
                            </p>

                            {(req.length > 0 || opt.length > 0) && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #1e3a8a' }}>
                                      <th className="text-left px-3 py-2 text-xs font-bold uppercase" style={{ color: '#64748b' }}>Parameter</th>
                                      <th className="text-left px-3 py-2 text-xs font-bold uppercase" style={{ color: '#64748b' }}>Required</th>
                                      <th className="text-left px-3 py-2 text-xs font-bold uppercase" style={{ color: '#64748b' }}>Example</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[...req.map(n => ({ n, req: true })), ...opt.map(n => ({ n, req: false }))].map(({ n, req: isReq }) => {
                                      const def = (e.parameters?.required || []).concat(e.parameters?.optional || []).find(p => (typeof p === 'string' ? p : p.name) === n);
                                      const example = typeof def === 'object' ? def.example : null;
                                      return (
                                        <tr key={n} style={{ borderBottom: '1px solid #060b16' }}>
                                          <td className="px-3 py-2 font-mono text-xs" style={{ color: '#e2e8f0' }}>{n}</td>
                                          <td className="px-3 py-2 text-xs" style={{ color: isReq ? '#f87171' : '#64748b' }}>{isReq ? 'Yes' : 'No'}</td>
                                          <td className="px-3 py-2 font-mono text-xs break-all" style={{ color: '#64748b' }}>{example || '—'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#64748b' }}>Example request</p>
                              <CodeBlock label="curl" code={`curl "${BASE}${e.path}?${[...req, ...opt].map(n => `${n}=YOUR_VALUE`).join('&')}${(req.length || opt.length) ? '&' : ''}apikey=YOUR_API_KEY"`} />
                            </div>

                            {e.is_active ? (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#64748b' }}>Live tester</p>
                                <EndpointTester endpoint={e} />
                              </div>
                            ) : (
                              <p className="text-xs" style={{ color: '#fbbf24' }}>
                                ⚠️ Endpoint is registered but not yet configured — it returns <code>ENDPOINT_DISABLED</code> until enabled with a verified upstream.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
