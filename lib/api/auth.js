// MZAZI API — API key authentication pipeline
// 1. Read API key → 2. Hash it → 3. Query DB → 4. Verify key → 5. Verify status
// 6. Verify user status → 7. Verify expiration → 8. Return identity
import { neon } from '@neondatabase/serverless';
import { ApiError } from './errors';
import { hashKey, qmark } from './utils';

const sql = neon(process.env.DATABASE_URL);

// Extract key from ?apikey= or Authorization: Bearer <key>
export function extractApiKey(request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('apikey');
  if (fromQuery) return fromQuery;

  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  const xKey = request.headers.get('x-api-key');
  if (xKey) return xKey;

  return null;
}

export async function authenticate(request) {
  const rawKey = extractApiKey(request);
  if (!rawKey) throw new ApiError('MISSING_API_KEY');

  const keyHash = hashKey(rawKey);

  const m = qmark();
  const rows = await sql`
    SELECT
      k.id, k.user_id, k.name, k.key_hash, k.key_prefix, k.status AS key_status,
      k.plan, k.expires_at, k.last_used_at, k.created_at,
      u.status AS user_status, u.role AS user_role, u.email AS user_email
    FROM api_keys k
    JOIN users u ON u.id = k.user_id
    WHERE k.key_hash = ${keyHash} AND ${m} = ${m}
    LIMIT 1
  `;

  if (rows.length === 0) throw new ApiError('INVALID_API_KEY');

  const key = rows[0];

  // Key status
  if (key.key_status === 'revoked') throw new ApiError('REVOKED_API_KEY');
  if (key.key_status !== 'active') throw new ApiError('INVALID_API_KEY');

  // User status
  if (key.user_status === 'suspended') throw new ApiError('USER_SUSPENDED');
  if (key.user_status === 'banned') throw new ApiError('USER_BANNED');

  // Expiration
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    throw new ApiError('EXPIRED_API_KEY');
  }

  return { key, user: { id: key.user_id, email: key.user_email, role: key.user_role } };
}
