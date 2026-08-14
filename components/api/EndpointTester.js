'use client';
import { useState } from 'react';
import CodeBlock from './CodeBlock';
import CopyButton from './CopyButton';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://mzazi.shop';

// Live tester for a single registry endpoint — calls the REAL MZAZI API.
// API key optional (see the JSON error without one, real result with one).
export default function EndpointTester({ endpoint }) {
  // registry field is `parameters` ({required:[{name,example}], optional:[...]})
  const def = endpoint.parameters || endpoint.params || { required: [], optional: [] };
  const required = (def.required || []).map(p => (typeof p === 'string' ? { name: p } : p));
  const optional = (def.optional || []).map(p => (typeof p === 'string' ? { name: p } : p));
  const all = [...required, ...optional];

  const [key, setKey] = useState('');
  const [values, setValues] = useState(() => {
    const v = {};
    for (const p of all) v[p.name] = p.example || '';
    return v;
  });
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const run = async () => {
    setTesting(true);
    setResult(null);
    const started = Date.now();

    const params = new URLSearchParams();
    for (const p of all) {
      if (values[p.name] && values[p.name].trim()) params.set(p.name, values[p.name].trim());
    }
    if (key.trim()) params.set('apikey', key.trim());

    const url = `${BASE_URL}${endpoint.path}${params.toString() ? '?' + params.toString() : ''}`;

    try {
      const res = await fetch(url);
      const json = await res.json().catch(() => null);
      setResult({
        url,
        status: res.status,
        ok: res.ok,
        ms: Date.now() - started,
        body: json ? JSON.stringify(json, null, 2) : `(non-JSON response, HTTP ${res.status})`,
      });
    } catch (e) {
      setResult({ url, status: 0, ok: false, ms: Date.now() - started, body: `Network error: ${e.message}` });
    }
    setTesting(false);
  };

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#020409', border: '1px solid #1e3a8a' }}>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>
            API Key <span style={{ color: '#4ade80' }}>(optional)</span>
          </label>
          <input value={key} onChange={e => setKey(e.target.value)} placeholder="mzazi_..."
            className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none"
            style={{ backgroundColor: '#060b16', border: '1px solid #1e3a8a', color: '#f0f4ff' }} />
        </div>
        {all.map(p => (
          <div key={p.name} className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>
              {p.name}
              {required.some(r => r.name === p.name) && <span style={{ color: '#f87171' }}> *</span>}
            </label>
            <input value={values[p.name] || ''} onChange={e => setValues(v => ({ ...v, [p.name]: e.target.value }))}
              placeholder={p.example || p.name}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none"
              style={{ backgroundColor: '#060b16', border: '1px solid #1e3a8a', color: '#f0f4ff' }} />
          </div>
        ))}
        <button onClick={run} disabled={testing}
          className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', opacity: testing ? 0.6 : 1, cursor: testing ? 'not-allowed' : 'pointer' }}>
          {testing ? 'SENDING…' : 'SEND REQUEST'}
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded font-bold" style={{
              backgroundColor: result.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
              color: result.ok ? '#4ade80' : '#f87171',
            }}>HTTP {result.status}</span>
            <span style={{ color: '#94a3b8' }}>{result.ms}ms</span>
            <span className="break-all" style={{ color: '#475569' }}>{result.url}</span>
            <CopyButton text={result.url} label="Copy URL" />
          </div>
          <CodeBlock label="JSON response" code={result.body} />
        </div>
      )}
    </div>
  );
}
