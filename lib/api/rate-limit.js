// MZAZI API — rate limiting (DB-backed daily quota per API key)
// Counters live in api_usage (one row per key per day).
// The quota counter is an atomic upsert (INSERT ... ON CONFLICT ... RETURNING)
// so the limit check never depends on a separate read.
// Limits are configurable: env override > api_settings table > constants.
import { neon } from '@neondatabase/serverless';
import { ApiError } from './errors';
import { PLANS } from './constants';
import { safeInt } from './utils';

const sql = neon(process.env.DATABASE_URL);

// Unique marker defeats any body-keyed response caching (Next/Neon layer)
let _seq = 0;
const mark = () => `${Date.now()}_${++_seq}`;

const ENV_OVERRIDES = {
  FREE: process.env.RATE_LIMIT_FREE_DAILY,
  PREMIUM: process.env.RATE_LIMIT_PREMIUM_DAILY,
  BUSINESS: process.env.RATE_LIMIT_BUSINESS_DAILY,
  ADMIN: process.env.RATE_LIMIT_ADMIN_DAILY,
};

// Resolve the daily limit for a plan (persistent admin-editable settings)
export async function getPlanLimit(planName) {
  const plan = (planName || 'FREE').toUpperCase();

  if (ENV_OVERRIDES[plan] !== undefined && ENV_OVERRIDES[plan] !== '') {
    return safeInt(ENV_OVERRIDES[plan], PLANS[plan]?.dailyLimit ?? 100);
  }

  try {
    const m = mark();
    const rows = await sql`SELECT value FROM api_settings WHERE key = ${'rate_limit.' + plan} AND ${m} = ${m} LIMIT 1`;
    if (rows.length > 0) return safeInt(rows[0].value, PLANS[plan]?.dailyLimit ?? 100);
  } catch {
    // fall through to constants
  }

  return PLANS[plan]?.dailyLimit ?? 100;
}

// Today's UTC date string
export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Read current usage without incrementing (analytics only — not used for enforcement)
export async function getDailyUsage(apiKeyId) {
  const date = todayKey();
  const m = mark();
    const rows = await sql`
    SELECT requests FROM api_usage WHERE api_key_id = ${apiKeyId} AND date = ${date}::date AND ${m} = ${m} LIMIT 1
  `;
  return rows.length > 0 ? safeInt(rows[0].requests, 0) : 0;
}

// Atomic counter increment — single statement, returns the new count
async function incrementCounter(apiKeyId, userId, date, failed) {
  const m = mark();
    const rows = await sql`
    INSERT INTO api_usage (user_id, api_key_id, date, requests, failed)
    VALUES (${userId}, ${apiKeyId}, ${date}::date, 1, ${failed ? 1 : 0})
    ON CONFLICT (api_key_id, date)
    DO UPDATE SET
      requests = api_usage.requests + 1,
      failed = api_usage.failed + ${failed ? 1 : 0}
    WHERE ${m} = ${m}
    RETURNING requests
  `;
  return safeInt(rows[0]?.requests, 1);
}

// Enforce the quota atomically. Returns { limit, remaining, reset } or throws RATE_LIMITED.
export async function checkAndIncrement(apiKeyId, userId, planName) {
  const limit = await getPlanLimit(planName);
  const date = todayKey();

  // Unlimited (ADMIN plan or limit < 0) — still record usage for analytics
  if (limit < 0) {
    await incrementCounter(apiKeyId, userId, date, false);
    return { limit: -1, remaining: -1, reset: 0 };
  }

  const count = await incrementCounter(apiKeyId, userId, date, false);
  if (count > limit) {
    throw new ApiError('RATE_LIMITED');
  }

  const remaining = Math.max(0, limit - count);
  const reset = new Date(date + 'T23:59:59.999Z').getTime();
  return { limit, remaining, reset };
}

// Tally success/failure/time after the request completes
export async function finalizeUsage(apiKeyId, userId, { success, providerFailure, responseTimeMs }) {
  const date = todayKey();
  const m = mark();
    await sql`
    INSERT INTO api_usage (user_id, api_key_id, date, requests, success, failed, provider_failures, total_response_time_ms)
    VALUES (${userId}, ${apiKeyId}, ${date}::date, 0, ${success ? 1 : 0}, ${success ? 0 : 1}, ${providerFailure ? 1 : 0}, ${responseTimeMs})
    ON CONFLICT (api_key_id, date)
    DO UPDATE SET
      success = api_usage.success + ${success ? 1 : 0},
      failed = api_usage.failed + ${success ? 0 : 1},
      provider_failures = api_usage.provider_failures + ${providerFailure ? 1 : 0},
      total_response_time_ms = api_usage.total_response_time_ms + ${responseTimeMs}
    WHERE ${m} = ${m}
  `;
}
