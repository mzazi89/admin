// MZAZI API — DavidCyril provider adapter (generic, registry-driven)
// Base URL configurable via DAVIDCYRIL_API_URL (default public API).
// Optional DAVIDCYRIL_API_KEY is appended ONLY when actually configured
// (never apikey=undefined / apikey= empty).
import { ApiError } from '../../api/errors';
import { PROVIDER_TIMEOUT_MS } from '../../api/constants';
import { pick, safeNumber, formatDuration, toHttps } from '../../api/utils';
import { neon } from '@neondatabase/serverless';

export const id = 'davidcyril';

const BASE_URL = (process.env.DAVIDCYRIL_API_URL || 'https://apis.davidcyril.name.ng').replace(/\/$/, '');
const API_KEY = process.env.DAVIDCYRIL_API_KEY || '';

export function isConfigured() {
  return Boolean(BASE_URL);
}

export function missingEnvVars() {
  return BASE_URL ? [] : ['DAVIDCYRIL_API_URL'];
}

const sql = neon(process.env.DATABASE_URL);

// ── Health tracking ──────────────────────────────────────────────
async function recordHealth(ok, ms, error) {
  try {
    const prov = await sql`SELECT id FROM providers WHERE name = 'davidcyril' LIMIT 1`;
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
    // health tracking must never break responses
  }
}

// ── Upstream call ────────────────────────────────────────────────
// params: { name: value } — sent as query params (GET) or JSON body (POST)
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
  const fetchOpts = {
    method,
    signal: controller.signal,
    cache: 'no-store',
  };

  try {
    if (method === 'POST') {
      const body = { ...params };
      if (API_KEY) body.apikey = API_KEY;
      fetchOpts.headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      fetchOpts.body = JSON.stringify(body);
    } else {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
      }
      if (API_KEY) qs.set('apikey', API_KEY);
      const q = qs.toString();
      if (q) url += (url.includes('?') ? '&' : '?') + q;
      fetchOpts.headers = { Accept: 'application/json' };
    }

    const res = await fetch(url, fetchOpts);
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

// ── Payload extraction ───────────────────────────────────────────
// DavidCyril responses use inconsistent containers: result / data / response / results
export function drillPayload(upstream, depth = 0) {
  if (!upstream || typeof upstream !== 'object' || depth > 4) return upstream;
  for (const k of ['result', 'data', 'response', 'results']) {
    if (upstream[k] !== undefined && upstream[k] !== null) {
      const v = upstream[k];
      if (typeof v === 'object' && !Array.isArray(v)) return drillPayload(v, depth + 1);
      return v; // array or primitive
    }
  }
  // strip envelope-only keys
  const clean = {};
  for (const [k, v] of Object.entries(upstream)) {
    if (['creator', 'success', 'status', 'timestamp', 'message'].includes(k)) continue;
    clean[k] = v;
  }
  return Object.keys(clean).length ? clean : upstream;
}

// ── Normalizers ──────────────────────────────────────────────────
// Download endpoints: canonicalize known fields, preserve the rest
function normalizeDownloadItem(item) {
  if (!item || typeof item !== 'object') return item;
  const dl = pick(item, ['download', 'audio', 'mp3', 'downloads']);
  const out = {
    title: pick(item, ['title', 'name', 'video_title', 'song', 'track'], null),
    thumbnail: toHttps(pick(item, ['thumbnail', 'thumb', 'image', 'cover', 'thumbnail_url', 'video_thumbnail'])),
    duration: pick(item, ['duration', 'durationText', 'length', 'lengthText', 'dur', 'duration_seconds'], null),
    views: (() => {
      const v = pick(item, ['views', 'viewCount', 'view_count', 'total_views']);
      return v === null ? null : Math.max(0, Math.round(safeNumber(v)));
    })(),
    download_url: toHttps(
      pick(item, ['download_url', 'downloadUrl', 'video_download', 'audio_url', 'mp3_url', 'direct_url']) ||
      (typeof dl === 'object' ? pick(dl, ['url', 'download_url', 'downloadUrl', 'audio', 'link', 'sd', 'hd']) : null) ||
      (typeof item.video === 'string' ? item.video : null)
    ),
    video_url: toHttps(
      pick(item, ['video_url', 'videoUrl', 'video_preview', 'youtube_url', 'watch_url', 'url']) ||
      (typeof item.video === 'string' ? item.video : null) ||
      (typeof item.video === 'object' ? pick(item.video, ['url', 'video_url', 'videoUrl']) : null)
    ),
  };
  // duration: keep "m:ss" as-is; convert plain seconds
  if (out.duration !== null && !String(out.duration).includes(':')) {
    out.duration = formatDuration(safeNumber(out.duration));
  } else if (out.duration === null) {
    out.duration = null;
  }
  // preserve provider-specific fields not covered above
  for (const [k, v] of Object.entries(item)) {
    if (!(k in out) && !['download', 'audio', 'mp3', 'downloads', 'video'].includes(k)) {
      out[k] = v;
    }
  }
  return out;
}

export function normalizeDownload(payload) {
  if (Array.isArray(payload)) {
    const items = payload.map(normalizeDownloadItem).filter(Boolean);
    return items.length === 1 ? items[0] : { count: items.length, items };
  }
  return normalizeDownloadItem(payload);
}

// AI / chat endpoints: expose the text answer under `answer`
export function normalizeAI(payload) {
  if (typeof payload === 'string') return { answer: payload };
  if (payload && typeof payload === 'object') {
    const answer = pick(payload, ['response', 'reply', 'text', 'message', 'answer', 'content'], null);
    return answer !== null ? { answer, ...payload } : payload;
  }
  return payload;
}

// Search endpoints: pass through (arrays of results)
export function normalizeSearch(payload) {
  return payload;
}

// Default: pass through
export function normalizeDefault(payload) {
  return payload;
}

export function normalizerFor(category) {
  if (category === 'DOWNLOAD') return normalizeDownload;
  if (category === 'AI') return normalizeAI;
  return normalizeDefault;
}
