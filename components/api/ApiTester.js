'use client';
import { useState } from 'react';
import CodeBlock from './CodeBlock';
import CopyButton from './CopyButton';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://mzazi.shop';

// Public endpoints available in the tester (data endpoint needs a key; health doesn't)
const ENDPOINTS = [
  { label: 'GET /api/download/play', path: '/api/download/play', needsKey: true },
  { label: 'GET /api/health', path: '/api/health', needsKey: false },
];

// Live API tester — calls the REAL endpoint. API key is OPTIONAL:
// valid key → live result; missing/invalid key → the proper JSON error response.
export default function ApiTester({ defaultQuery = 'Faded Alan Walker', compact = false }) {
  const [form, setForm] = useState({ key: '', query: defaultQuery, endpoint: ENDPOINTS[0].path });
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const currentEndpoint = ENDPOINTS.find(e => e.path === form.endpoint) || ENDPOINTS[0];

  const run = async () => {
    setTesting(true);
    setResult(null);
    const started = Date.now();

    const params = new URLSearchParams();
    if (currentEndpoint.needsKey && form.query.trim()) params.set('query', form.query.trim());
    // only include apikey when the user actually typed one
    if (form.key.trim()) params.set('apikey', form.key.trim());

    const url = `${BASE_URL}${form.endpoint}${params.toString() ? '?' + params.toString() : ''}`;

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
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold" style={{ color: '#f0f4ff' }}>⚡ API Tester</h3>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-md"
          style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
          LIVE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#64748b' }}>
            Endpoint
          </label>
          <select
            value={form.endpoint}
            onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-mono"
            style={{ backgroundColor: '#020409', border: '1px solid #1e3a8a', color: '#f0f4ff' }}>
            {ENDPOINTS.map(e => <option key={e.path} value={e.path}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#64748b' }}>
            API Key <span style={{ color: '#4ade80' }}>(optional)</span>
          </label>
          <input
            value={form.key}
            onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
            placeholder="mzazi_... (leave empty to test without a key)"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-mono"
            style={{ backgroundColor: '#020409', border: '1px solid #1e3a8a', color: '#f0f4ff' }}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#64748b' }}>
            Song name
          </label>
          <input
            value={form.query}
            onChange={e => setForm(f => ({ ...f, query: e.target.value }))}
            placeholder="e.g. Faded Alan Walker"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ backgroundColor: '#020409', border: '1px solid #1e3a8a', color: '#f0f4ff' }}
            onKeyDown={e => { if (e.key === 'Enter') run(); }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={testing}
          className="px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', opacity: testing ? 0.6 : 1, cursor: testing ? 'not-allowed' : 'pointer' }}>
          {testing ? 'SENDING…' : 'SEND REQUEST'}
        </button>
        <span className="text-xs" style={{ color: '#64748b' }}>
          {currentEndpoint.needsKey
            ? 'No key? You’ll see the proper JSON error — then add your key to get real results.'
            : 'This endpoint is public — no API key needed.'}
        </span>
      </div>

      {result && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2 py-1 rounded font-bold" style={{
              backgroundColor: result.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
              color: result.ok ? '#4ade80' : '#f87171',
            }}>
              HTTP {result.status}
            </span>
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
