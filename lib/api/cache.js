// MZAZI API — lightweight in-memory TTL cache for provider responses.
// Used for repeated public GET requests (same query/url) to reduce upstream load.
// Configurable: API_CACHE_TTL (seconds, default 60). Set 0 to disable.
const DEFAULT_TTL = Math.max(0, parseInt(process.env.API_CACHE_TTL || '60', 10) || 60);

const store = new Map();

// Categories whose responses are safe to cache (no per-user data)
const CACHEABLE = new Set(['DOWNLOAD', 'SEARCH', 'FUN', 'RANDOM', 'NEWS', 'GAMES', 'TOOLS', 'ANIME', 'IMAGE GENERATION']);

// Per-category TTL overrides (seconds) — downloads expire faster (URLs rotate)
const TTL_BY_CATEGORY = { DOWNLOAD: 30, SEARCH: 120, FUN: 300, RANDOM: 300, NEWS: 120 };

function keyFor(endpointPath, params, category) {
  const parts = [endpointPath];
  if (params && typeof params === 'object') {
    for (const k of Object.keys(params).sort()) parts.push(`${k}=${params[k]}`);
  }
  return `${category}:${parts.join('&')}`;
}

export function isCacheable(endpointPath, method, category) {
  if (method !== 'GET') return false;
  if (!CACHEABLE.has(category)) return false;
  return DEFAULT_TTL > 0;
}

export function cacheGet(endpointPath, params, category) {
  if (!isCacheable(endpointPath, 'GET', category)) return null;
  const key = keyFor(endpointPath, params, category);
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(endpointPath, params, category, value) {
  if (!isCacheable(endpointPath, 'GET', category)) return;
  const ttl = (TTL_BY_CATEGORY[category] ?? DEFAULT_TTL) * 1000;
  if (ttl <= 0) return;
  const key = keyFor(endpointPath, params, category);
  store.set(key, { value, expires: Date.now() + ttl });
  // best-effort bound on cache size
  if (store.size > 2000) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expires < now) store.delete(k);
    }
  }
}

export function cacheClear() {
  store.clear();
}
