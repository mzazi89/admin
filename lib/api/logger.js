// MZAZI API — request logging
// Never logs raw API keys, provider credentials or database credentials.
import { neon } from '@neondatabase/serverless';
import { generateRequestId } from './utils';

const sql = neon(process.env.DATABASE_URL);

export function newRequestId() {
  return generateRequestId();
}

export async function logRequest({
  requestId,
  userId = null,
  apiKeyId = null,
  endpoint,
  category = null,
  method = 'GET',
  statusCode,
  responseTimeMs = 0,
  provider = null,
  ip = null,
  userAgent = null,
  errorCode = null,
}) {
  try {
    await sql`
      INSERT INTO api_requests
        (request_id, user_id, api_key_id, endpoint, category, method, status_code, response_time_ms, provider, ip, user_agent, error_code)
      VALUES
        (${requestId}, ${userId}, ${apiKeyId}, ${endpoint}, ${category}, ${method}, ${statusCode}, ${Math.round(responseTimeMs)}, ${provider}, ${ip}, ${userAgent}, ${errorCode})
    `;

    // Keep last_used_at fresh (cheap, best-effort)
    if (apiKeyId) {
      await sql`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ${apiKeyId}`;
    }
  } catch (e) {
    // Logging must never break the API response
    console.error('[mzazi-api] request log failed:', e.message);
  }
}
