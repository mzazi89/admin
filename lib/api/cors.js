// MZAZI API — CORS handling
// ALLOWED_ORIGINS: comma-separated list, or '*' to allow all (default: same-origin only)
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin') || null;
  let allowOrigin = null;

  if (ALLOWED.includes('*')) {
    allowOrigin = '*';
  } else if (origin && (ALLOWED.length === 0 || ALLOWED.includes(origin))) {
    allowOrigin = origin;
  }

  if (!allowOrigin) return {};

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function handleOptions(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  return null;
}

export function mergeHeaders(...headerObjs) {
  return Object.assign({}, ...headerObjs.filter(Boolean));
}
