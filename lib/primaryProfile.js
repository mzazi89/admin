// MZAZI API — the id of the primary bot profile.
//
// The primary is the FIRST entry of the `bot_profiles` setting. That is the
// same rule the bots apply (`profiles.primary()`), and the same rule that
// decides which bot owns a `bot_commands` row whose `profile` is empty.
//
// Extracted into one place because two callers must agree on it or they
// disagree silently:
//
//   - app/api/admin/bot-commands/route.js — decides whether rows with no
//     profile match the currently selected bot, so selecting the primary bot
//     shows the legacy rows instead of hiding them.
//   - app/api/admin/bot-commands/sync/route.js — decides which bot to aim a
//     reload at. A `bot_control` row with no bot_id is claimed by WHICHEVER bot
//     polls first (see lib/botSync.js), so an untargeted nudge can wake the
//     wrong bot and leave the other serving a stale registry.
//
// Defaults to 'quartz' when the setting is unset or unparseable, matching every
// deployment that predates bot profiles.
import { neon } from '@neondatabase/serverless';

let _sql = null;
function db() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function primaryProfileId() {
  try {
    const rows = await db()`SELECT value FROM settings WHERE key = 'bot_profiles'`;
    const parsed = JSON.parse(rows[0]?.value || '');
    if (Array.isArray(parsed) && parsed.length && parsed[0]?.id) return String(parsed[0].id);
  } catch {
    // Unset or unparseable means a single bot; both bots treat that as primary.
  }
  return 'quartz';
}
