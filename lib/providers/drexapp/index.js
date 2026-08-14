// MZAZI API — DrexApp provider adapter (generic, registry-driven; branded as MZAZI Tech Inc)
// Base URL: DREXAPP_API_URL (default: the live Heroku backend).
// NOTE: the user-facing domain api.drexapp.space currently serves only the docs
// site; the actual API backend is the Heroku app. Override DREXAPP_API_URL once
// the domain is fixed.
import { ApiError } from '../../api/errors';
import { PROVIDER_TIMEOUT_MS } from '../../api/constants';
import { pick, safeNumber, formatDuration, toHttps } from '../../api/utils';
import { neon } from '@neondatabase/serverless';
import { drillPayload, normalizeDownload, normalizeAI, normalizeDefault } from '../davidcyril';

export const id = 'drexapp';

const BASE_URL = (process.env.DREXAPP_API_URL || 'https://apis-17ad50309099.herokuapp.com').replace(/\/$/, '');
const API_KEY = process.env.DREXAPP_API_KEY || '';

export function isConfigured() {
  return Boolean(BASE_URL);
}

export function missingEnvVars() {
  return BASE_URL ? [] : ['DREXAPP_API_URL'];
}

const sql = neon(process.env.DATABASE_URL);

// ── Health tracking ──────────────────────────────────────────────
async function recordHealth(ok, ms, error) {
  try {
    const prov = await sql`SELECT id FROM providers WHERE name = 'drexapp' LIMIT 1`;
    if (prov.length === 0) return;
    const pid = prov[0].id;
    await sql`
      INSERT INTO provider_health (provider_id, ok, response_time_ms, error)
      VALUES (${pid}, ${ok}, ${ms}, ${error})
    `;
    if (ok) {
      await sql`UPDATE providers SET last_success_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ${pid}`;
    } else {
      await sql`UPDATE providers SET last_failure_at = CURRENT_TIMESTAMP, last_error = ${error}, updated_at = CURRENT_TIMESTAMP WHERE id = ${pid}`;
    }
  } catch {
    // never break responses
  }
}

// ── Upstream call ────────────────────────────────────────────────
export async function call(upstreamPath, params = {}, method = 'GET') {
  if (!isConfigured()) {
    const err = new ApiError('PROVIDER_NOT_CONFIGURED');
    err.message = `Provider is not configured. Missing environment variable(s): ${missingEnvVars().join(', ')}`;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const started = Date.now();
  let url = BASE_URL + upstreamPath;

  try {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    }
    if (API_KEY) qs.set('apikey', API_KEY);
    const q = qs.toString();
    if (q) url += (url.includes('?') ? '&' : '?') + q;

    const res = await fetch(url, { method, signal: controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
    const ms = Date.now() - started;

    if (!res.ok) {
      recordHealth(false, ms, `HTTP ${res.status}`);
      throw new ApiError('PROVIDER_ERROR');
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      recordHealth(false, ms, 'non-JSON response');
      throw new ApiError('PROVIDER_ERROR');
    }
    const data = await res.json();
    recordHealth(true, ms, null);
    return { data, ms };
  } catch (e) {
    if (e.name === 'ApiError') throw e;
    if (controller.signal.aborted) {
      recordHealth(false, Date.now() - started, 'timeout');
      throw new ApiError('PROVIDER_TIMEOUT');
    }
    recordHealth(false, Date.now() - started, e.message.slice(0, 200));
    throw new ApiError('PROVIDER_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

export { drillPayload };

export function normalizerFor(category) {
  if (category === 'DOWNLOAD') return normalizeDownload;
  if (category === 'AI') return normalizeAI;
  return normalizeDefault;
}
