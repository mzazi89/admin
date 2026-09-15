// MZAZI API — /api/admin/settings
// GET  → the bot's shared settings (every config the bot reads)
// POST → upsert them into the Neon `settings` table — the bot picks them up
//        within ~60s (no env vars, no restart needed).
// NOTE: DATABASE_URL is intentionally NOT here — it stays in the server env.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';
// Every bot config value editable from the admin Settings page. The bot
// (quartz/settings.js) maps these onto its config with env/static fallbacks.
const ALLOWED_KEYS = [
  // Bot identity
  'bot_name', 'owner', 'whatsapp_owner', 'connection_image',
  // Bot profiles — the list quartz reads to serve more than one WhatsApp
  // identity from one process, and that the public link site reads to decide
  // whether to offer a bot selector. Absent/empty means exactly one bot, which
  // is the behaviour every deployment had before this key existed.
  'bot_profiles',
  // Telegram
  'telegram_bot_token', 'telegram_owner',
  // MZAZI XMD bot — the second WhatsApp bot (profile id `xmd`). Namespaced with
  // `xmd_` so these can never overwrite the QUARTZ keys above in the shared
  // `settings` table; this table is the single source of truth it reads
  // (mzazi-xmd/settings.js maps each one onto its config).
  'xmd_bot_name', 'xmd_bot_profiles', 'xmd_telegram_bot_token',
  'xmd_remote_api_url', 'xmd_bot_api_key', 'xmd_connection_image',
  // WhatsApp
  'autoJoinGroupLink',
  // Paystack
  'paystack_secret_key', 'paystack_public_key',
  // Deposit offer (site wallet 2x promo)
  'depositOfferEnabled', 'depositOfferMultiplier', 'depositOfferAdText',
  // Pterodactyl
  'pterodactyl_url', 'pterodactyl_api_key',
  // Webhooks & URLs
  'webhook_port', 'webhook_url', 'remote_api_url', 'bot_api_key',
  // MZAZI site API
  'mzazi_site_url', 'mzazi_api_key',
  // Telemetry
  'bot_ip',
  // AI
  'deepseek_api_key',
];

/**
 * `bot_profiles` is the only setting here whose value is JSON rather than a
 * plain string, and so the only one that can be syntactically wrong.
 *
 * A wrong value is not cosmetic. quartz parses this to decide which WhatsApp
 * identities to serve, and the link site parses it to decide whether to show a
 * bot selector at all. A typo therefore does not fail loudly — it quietly
 * becomes "one bot", and the second bot you just added appears to have vanished.
 * Both sides already treat unparseable JSON as unset, so the failure mode is
 * silence; the only place it can be caught is here, before it is written.
 *
 * Accepted: '' (back to a single bot), or a JSON array of { id, name }.
 */
function normaliseBotProfiles(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return { ok: true, value: '' }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Bot profiles must be valid JSON. Leave it empty for a single bot.' }
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Bot profiles must be a JSON array, for example [{"id":"quartz","name":"QUARTZ XD"}].' }
  }

  const cleaned = []
  const seen = new Set()
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, error: 'Every bot must be an object with an id and a name.' }
    }
    const id = String(entry.id ?? '').trim()
    const name = String(entry.name ?? '').trim()
    if (!id || !name) {
      return { ok: false, error: 'Every bot needs both an id and a name.' }
    }
    // The id is written into bot_control.bot_id and bot_status.bot_id, and is
    // compared against the profile filter on every command lookup. Anything
    // outside this set would either not round-trip through those columns
    // cleanly or be invisible to the bot's own filter.
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return { ok: false, error: `Bot id "${id}" must be letters, digits, dash or underscore, max 64 characters.` }
    }
    // Duplicate ids would make two bots indistinguishable, and a pairing could
    // land somewhere the user did not choose. Keep the first of each.
    if (seen.has(id)) continue
    seen.add(id)
    cleaned.push({ id, name })
  }

  if (!cleaned.length) {
    return { ok: false, error: 'An empty array is not a bot list. Clear the field to go back to a single bot.' }
  }

  // Stored as canonical JSON so the two readers cannot disagree about spacing.
  return { ok: true, value: JSON.stringify(cleaned) }
}

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return false;
  try {
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    return d.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const rows = await sql`SELECT key, value FROM settings WHERE key = ANY(${ALLOWED_KEYS})`;
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return NextResponse.json({ settings: out });
  } catch (e) {
    console.error('Settings GET error:', e.message);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected a settings object.' }, { status: 400 });
    }

    // JSON-valued, so they are checked before the write rather than trusted to
    // the database. Every other key here is an opaque string the bot falls back
    // on. `xmd_bot_profiles` is the XMD bot's own profile list and is exactly
    // the same shape, so it runs through the same validation.
    for (const jsonKey of ['bot_profiles', 'xmd_bot_profiles']) {
      if (jsonKey in body) {
        const checked = normaliseBotProfiles(body[jsonKey]);
        if (!checked.ok) {
          return NextResponse.json({ error: checked.error }, { status: 400 });
        }
        body[jsonKey] = checked.value;
      }
    }

    const updates = [];
    for (const key of ALLOWED_KEYS) {
      if (key in body) {
        updates.push(
          sql`
            INSERT INTO settings (key, value, updated_at)
            VALUES (${key}, ${body[key] === null ? '' : String(body[key])}, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
          `
        );
      }
    }
    if (updates.length) await Promise.all(updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Settings POST error:', e.message);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
