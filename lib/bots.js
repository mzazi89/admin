// MZAZI API — which bots exist, and which one holds a given number.
//
// Read from the SAME `settings` row the bot itself reads — `bot_profiles` —
// rather than from a list kept here. Two lists would drift, and the morning they
// disagree the panel would either offer a bot that cannot serve the request or
// hide one that can.
//
// The parsing mirrors lib/profiles.js on the bot, lib/bots.js on the link site,
// on mzazi89/web and on the quartzxd copies, including the fallback, so every
// side agrees on what the primary bot is called.
import { neon } from '@neondatabase/serverless';

let _sql = null;
function db() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

const SETTINGS_KEY = 'bot_profiles';
const NAME_KEY = 'bot_name';

// Matches the bot's own staticConfig default for botName.
const FALLBACK_NAME = 'MZAZI TECH QUARTZ BOT';
const FALLBACK_ID = 'main';

function parseProfiles(raw) {
  if (!raw) return [];

  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[admin][bots] bot_profiles is not valid JSON — treating it as unset');
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const cleaned = parsed
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      id: String(p.id ?? '').trim(),
      name: String(p.name ?? '').trim(),
    }))
    .filter((p) => p.id && p.name);

  const seen = new Set();
  return cleaned.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
}

/** The selectable bots, always at least one. Never throws. */
export async function listBots() {
  const settings = {};

  try {
    const rows = await db()`
      SELECT key, value FROM settings
      WHERE key IN ('bot_profiles', 'bot_name')
    `;
    for (const row of rows) settings[row.key] = row.value || '';
  } catch (err) {
    console.warn('[admin][bots] could not read the settings table:', err.message);
  }

  const configured = parseProfiles(settings[SETTINGS_KEY]);
  if (configured.length) return configured;

  return [{ id: FALLBACK_ID, name: settings[NAME_KEY] || FALLBACK_NAME }];
}

export async function resolveBot(requested) {
  const bots = await listBots();
  const wanted = String(requested || '').trim();

  if (wanted) {
    const found = bots.find((b) => b.id === wanted);
    if (!found) return { ok: false, error: 'That bot is not available.' };
    return { ok: true, bot: found, named: true };
  }

  if (bots.length > 1) {
    return { ok: false, error: 'Choose which bot to act on.' };
  }

  return { ok: true, bot: bots[0], named: false };
}

function numbersOf(row) {
  try {
    const parsed = JSON.parse((row && row.session_numbers) || '[]');
    return Array.isArray(parsed) ? parsed.map((n) => String(n)) : [];
  } catch {
    return [];
  }
}

/** Newest telemetry row for every bot id, first-wins on the DESC order. */
async function statusByBot() {
  const byId = {};
  try {
    const rows = await db()`
      SELECT bot_id, online, session_numbers, last_seen_at
      FROM bot_status
      ORDER BY last_seen_at DESC
    `;
    for (const r of rows) {
      if (!Object.prototype.hasOwnProperty.call(byId, r.bot_id)) byId[r.bot_id] = r;
    }
  } catch (err) {
    console.warn('[admin][bots] could not read bot_status:', err.message);
  }
  return byId;
}

/**
 * Which bot currently holds each paired number.
 *
 * The session tables have no bot column — the only place this mapping exists is
 * the telemetry each bot publishes. Issuing an unlink to the wrong bot would
 * find no such session and leave the device linked.
 */
export async function deviceBotMap() {
  const map = {};
  try {
    const rows = await db()`
      SELECT bot_id, session_numbers, last_seen_at
      FROM bot_status
      ORDER BY last_seen_at ASC
    `;
    // Ascending, so the NEWEST row for an id wins — a bot that was renamed
    // leaves its old row behind with a stale session list.
    for (const r of rows) {
      for (const n of numbersOf(r)) map[n] = r.bot_id;
    }
  } catch (err) {
    console.warn('[admin][bots] could not read bot_status:', err.message);
  }
  return map;
}

/** Every bot with live state, for the panel. */
export async function listBotsWithStatus() {
  const bots = await listBots();
  const byId = await statusByBot();

  const withStatus = bots.map((b) => {
    const row = byId[b.id] || null;
    return {
      id: b.id,
      name: b.name,
      known: !!row,
      online: !!(row && row.online),
      deviceCount: numbersOf(row).length,
    };
  });

  return { bots: withStatus, multiple: withStatus.length > 1 };
}

/**
 * Resolve the bot an action should be issued to for a specific number.
 *
 *  1. the bot the caller named — the operator is looking at it,
 *  2. else the bot telemetry says holds this number — the only correct answer
 *     for an unlink,
 *  3. else the single configured bot, untargeted.
 */
export async function resolveBotForNumber(number, requested) {
  const wanted = String(requested || '').trim();
  if (wanted) return resolveBot(wanted);

  const bots = await listBots();

  // With one bot there is nothing to disambiguate, so the row is left untargeted
  // — exactly what this wrote before bots were selectable. Targeting it with the
  // fallback id "main" would look equivalent today and then silently strand the
  // request if bot_profiles is switched on before a bot claims it.
  if (bots.length === 1) return { ok: true, bot: bots[0], named: false };

  const n = String(number || '').replace(/\D/g, '');
  if (n) {
    const map = await deviceBotMap();
    const owner = map[n];
    if (owner) {
      const found = bots.find((b) => b.id === owner);
      if (found) return { ok: true, bot: found, named: true };
    }
  }

  // Telemetry does not identify the holder. The action still goes out,
  // untargeted, exactly as it did before bots were selectable: every bot may
  // claim such a row and the one holding the number is the one that can act.
  // Blocking it because telemetry was thin would deny a legitimate removal from
  // the panel — a worse failure than a claim that does nothing.
  return { ok: true, bot: bots[0], named: false };
}
