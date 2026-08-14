// MZAZI API — crypto + misc utilities
import crypto from 'crypto';
import { API_KEY_PREFIX, API_KEY_LENGTH, REQUEST_ID_PREFIX, REQUEST_ID_LENGTH } from './constants';

// Unique per-query marker — defeats response caching of identical request bodies
let _qseq = 0;
export const qmark = () => `${Date.now()}_${++_qseq}`;

// Optional pepper for key hashing — never exposed
const PEPPER = process.env.API_KEY_SECRET || '';

// sha256 hex digest, optionally peppered
export function hashKey(rawKey) {
  return crypto.createHash('sha256').update(PEPPER + rawKey).digest('hex');
}

// Cryptographically secure API key: mzazi_<24 random bytes base64url>
export function generateApiKey() {
  return API_KEY_PREFIX + crypto.randomBytes(API_KEY_LENGTH).toString('base64url');
}

// Cryptographically secure request ID: mz_req_<9 random bytes base64url>
export function generateRequestId() {
  return REQUEST_ID_PREFIX + crypto.randomBytes(REQUEST_ID_LENGTH).toString('base64url');
}

// Show only a short safe prefix of a key for display purposes
export function keyPrefixForDisplay(fullKey) {
  return fullKey.slice(0, 14) + '…';
}

// Client IP from headers (respects proxies)
export function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim().slice(0, 45);
  const real = request.headers.get('x-real-ip');
  if (real) return real.slice(0, 45);
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

export function getUserAgent(request) {
  const ua = request.headers.get('user-agent') || '';
  return ua.slice(0, 255);
}

export function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function safeInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Parse a JSON body with a size cap (request size limits)
export async function parseJsonBody(request, maxBytes = 1024 * 100) {
  const length = safeInt(request.headers.get('content-length'), 0);
  if (length > maxBytes) {
    const err = new Error('Payload too large');
    err.code = 'PAYLOAD_TOO_LARGE';
    throw err;
  }
  try {
    return await request.json();
  } catch {
    const err = new Error('Invalid JSON body');
    err.code = 'INVALID_JSON';
    throw err;
  }
}

// Duration string from seconds, e.g. 212 -> "3:32"
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(safeNumber(totalSeconds, 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Robust field picker for normalizing arbitrary provider responses
export function pick(obj, keys, fallback = null) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
}

export function toHttps(url) {
  if (!url) return null;
  return String(url).replace(/^http:\/\//, 'https://');
}
