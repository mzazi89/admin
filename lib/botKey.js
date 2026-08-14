// MZAZI API — bot API key storage
// The shared secret that authenticates the WhatsApp bot is stored in the Neon
// `bot_config` table (settable from the admin dashboard) instead of a Vercel
// environment variable, so it can never be misconfigured. The Vercel env var
// (BOT_API_KEY) is still honored as a fallback.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const TTL_MS = 10000;

let cached = { value: null, at: 0 };

export async function getBotApiKey() {
  if (Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const rows = await sql`SELECT value FROM bot_config WHERE key = 'bot_api_key'`;
    cached = { value: rows[0]?.value || null, at: Date.now() };
    return cached.value;
  } catch (e) {
    console.error('[botKey] read error:', e.message);
    return process.env.BOT_API_KEY || null;
  }
}

export async function setBotApiKey(value) {
  const v = String(value || '').trim();
  await sql`
    INSERT INTO bot_config (key, value, updated_at)
    VALUES ('bot_api_key', ${v}, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
  `;
  cached = { value: v, at: Date.now() };
  return v;
}
