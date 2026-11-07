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
    _sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
  }
  return _sql;
}

const SETTINGS_KEY = 'bot_profiles';
const NAME_KEY = 'bot_name';

// The XMD bot keeps its own profile list under a namespaced key so the two bots
// cannot overwrite each other. Reading only `bot_profiles` left the admin panel
// unable to address a running MZAZI XMD: `resolveBot('xmd')` returned "not
// available" and every control row was written with the fallback id `main`,
// which the xmd bot never claims. Both keys are read now, same order as
// mzazi89/web's lib/bots.js so the two apps offer an identical list.
const XMD_SETTINGS_KEY = 'xmd_bot_profiles';
const XMD_NAME_KEY = 'xmd_bot_name';

// Matches the bot's own staticConfig default for botName.
const FALLBACK_NAME = 'QUARTZ XD';
const FALLBACK_ID = 'main';

// The names the bots themselves ship with, for an id that no settings row names.
// `profiles.js` on the XMD bot hardcodes this pair.
const KNOWN_NAMES = { xmd: 'MZAZI XMD', quartz: 'QUARTZ XD' };

// A heartbeat lands every ~30s; a row older than this is a bot that stopped.
const LIVE_WINDOW_MS = 5 * 60 * 1000;

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
      WHERE key IN ('bot_profiles', 'bot_name', 'xmd_bot_profiles', 'xmd_bot_name')
    `;
    for (const row of rows) settings[row.key] = row.value || '';
  } catch (err) {
    console.warn('[admin][bots] could not read the settings table:', err.message);
  }

  const configured = parseProfiles(settings[SETTINGS_KEY]);
  const xmd = parseProfiles(settings[XMD_SETTINGS_KEY]).map((p) => ({
    id: p.id,
    // An XMD entry with no name still has a known display name; the bot ships
    // with one and the settings page can override it via `xmd_bot_name`.
    name: p.name || String(settings[XMD_NAME_KEY] || '').trim() || KNOWN_NAMES.xmd,
  }));

  // bot_profiles first so it decides the order (primaryProfileId() depends on it),
  // then any XMD-only profile. Duplicate ids keep the first entry.
  const merged = [];
  const seenIds = new Set();
  for (const p of [...configured, ...xmd]) {
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    merged.push(p);
  }
  if (merged.length) return merged;

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

/**
 * Numbers the platform has already been told to remove.
 *
 * `bot_status.session_numbers` is a directory listing of `./database/sessions/`
 * that the bot rewrites every ~30s, so it lags a removal twice over:
 *
 *   - a **delete** drops the folder only when the bot next polls (≤15s), and
 *   - an **unlink** keeps the folder on purpose, so the number can stay in the
 *     listing for good even though the device is logged out and its row is
 *     INACTIVE.
 *
 * The Devices page reads that listing back as "sessions the bot holds", which is
 * why a deleted number came back as a live row for up to a heartbeat — and why
 * an unlinked one never left. A number counts as gone when the newest control
 * row for it is an `unpair` and no ACTIVE session row is behind it: a re-pair
 * writes either a newer `pair` row or an ACTIVE row, so a number that is
 * genuinely brought back returns on the next read.
 *
 * Display only — routing (`resolveBotForNumber`) must keep seeing raw
 * telemetry, or an unlink could be addressed to the wrong bot.
 */
export async function removedNumbers() {
  const gone = new Set();
  let controls = [];
  let rows = [];

  try {
    // Newest first, so the first row seen for a number is its latest control
    // entry. Bounded like `pairHistory()`: a number whose newest row is older
    // than the window is simply not proven removed, which shows a stale row
    // rather than hiding a live one.
    controls = await db()`
      SELECT payload->>'number' AS number, action
      FROM bot_control
      WHERE action IN ('pair', 'unpair')
        AND COALESCE(payload->>'number', '') <> ''
      ORDER BY id DESC
      LIMIT 2000
    `;
  } catch (err) {
    console.warn('[admin][bots] could not read the control log:', err.message);
    return gone;
  }

  try {
    rows = await db()`SELECT "phoneNumber", status FROM "WhatsAppSession"`;
  } catch (err) {
    console.warn('[admin][bots] could not read WhatsAppSession:', err.message);
    return gone;
  }

  const active = new Set(
    rows
      .filter((r) => String((r && r.status) || '').toUpperCase() === 'ACTIVE')
      .map((r) => String(r.phoneNumber || '').replace(/\D/g, ''))
  );

  // Descending, so the first row seen for a number is the most recent one — a
  // re-pair after an unpair therefore clears the removal instead of inheriting it.
  const latest = new Map();
  for (const c of controls) {
    const number = String((c && c.number) || '').replace(/\D/g, '');
    if (number && !latest.has(number)) latest.set(number, c.action);
  }
  for (const [number, action] of latest) {
    if (action === 'unpair' && !active.has(number)) gone.add(number);
  }
  return gone;
}

/**
 * `deviceBotMap()` with the removals applied — the map the Devices page counts
 * from. A number the operator just deleted is not in it, even if the bot's
 * heartbeat has not caught up yet.
 */
export async function liveDeviceMap() {
  const [map, gone] = await Promise.all([deviceBotMap(), removedNumbers()]);
  const live = {};
  for (const [number, bot] of Object.entries(map)) {
    if (!gone.has(number)) live[number] = bot;
  }
  return live;
}

/**
 * Bots that are heartbeating under an id neither profile list describes.
 *
 * The XMD bot keeps its list under `xmd_bot_profiles`, which `listBots()` does
 * not read because `primaryProfileId()` depends on `bot_profiles` order. So a
 * running XMD bot can be entirely absent from `listBots()` — visible only as a
 * raw id in the Devices tabs. This fills in its real name and live state.
 *
 * Display only: nothing here may change which bot is the primary.
 */
export async function liveBotProfiles() {
  const out = [];
  try {
    const rows = await db()`
      SELECT bot_id, online, session_numbers, last_seen_at
      FROM bot_status
      WHERE last_seen_at > NOW() - INTERVAL '5 minutes'
      ORDER BY last_seen_at DESC
    `;
    const seen = new Set();
    for (const r of rows) {
      const id = String(r.bot_id || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: KNOWN_NAMES[id] || id.toUpperCase(),
        known: true,
        online: !!r.online,
        deviceCount: numbersOf(r).length,
      });
    }
  } catch (err) {
    console.warn('[admin][bots] could not read live bot ids:', err.message);
  }
  return out;
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
