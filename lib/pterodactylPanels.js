// ─────────────────────────────────────────────────────────────────────────────
// The Pterodactyl panels the admin site can work with.
//
// Before this existed there was exactly one panel, described by two rows in the
// shared `settings` table (pterodactyl_url, pterodactyl_api_key) and read with an
// env fallback. Everything — the panel page, its API route, the bots — read that
// one pair.
//
// Now there is a table of panels. The old pair is kept as the fallback so a
// deployment that was already configured keeps working, and is adopted as the
// first panel the first time the admin site looks at an empty table. That way
// nothing has to be re-entered and there is no window where no panel is reachable.
//
// The stored key never leaves the server: listPanelsMasked() is what the browser
// gets, and it carries a hint instead of the value.
// ─────────────────────────────────────────────────────────────────────────────

import { sql, ensureDatabase } from './database.js';
import { choosePanel, normaliseUrl, publicPanel } from './panelSelection.js';

/** Legacy fallback: the single panel pair, with the same precedence as before. */
async function legacyConfig() {
  let url = normaliseUrl(process.env.PTERODACTYL_URL || 'https://public.mzazi.shop');
  let key = String(process.env.PTERODACTYL_API_KEY || '');
  try {
    const rows = await sql`SELECT key, value FROM settings WHERE key = ANY(${['pterodactyl_url', 'pterodactyl_api_key']})`;
    for (const r of rows) {
      if (r.key === 'pterodactyl_url' && r.value) url = normaliseUrl(r.value);
      if (r.key === 'pterodactyl_api_key' && r.value) key = String(r.value);
    }
  } catch {
    // settings table not there yet — the env values above are what is left
  }
  return { url, key };
}

/** Every panel, oldest first so the order is stable between requests. */
export async function listPanels() {
  await ensureDatabase();
  return await sql`SELECT id, name, url, api_key, is_default, created_at, updated_at
                   FROM pterodactyl_panels ORDER BY id ASC`;
}

/** The list as the browser may see it — no stored key, only a hint. */
export async function listPanelsMasked() {
  const rows = await listPanels();
  return rows.map(publicPanel);
}

/** True when the panels table holds nothing. */
async function tableIsEmpty() {
  try {
    const rows = await sql`SELECT 1 FROM pterodactyl_panels LIMIT 1`;
    return rows.length === 0;
  } catch {
    // Table missing: initializeDatabase has not run yet. Not "empty" in the sense
    // that matters — resolvePanel falls back to the legacy config either way.
    return false;
  }
}

/**
 * Adopt the legacy single panel as the first entry.
 *
 * Only ever runs against an empty table, and the insert is guarded by NOT EXISTS
 * so two requests arriving together cannot both create it. Never overwrites
 * anything: once a panel exists, the admin owns this table.
 */
export async function seedFromLegacySettings() {
  if (!(await tableIsEmpty())) return { seeded: false };
  const { url, key } = await legacyConfig();
  if (!url && !key) return { seeded: false };

  await sql`
    INSERT INTO pterodactyl_panels (name, url, api_key, is_default)
    SELECT ${'Primary panel'}, ${url}, ${key}, true
    WHERE NOT EXISTS (SELECT 1 FROM pterodactyl_panels)
  `;
  return { seeded: true };
}

/**
 * The panel an action should run against.
 *
 * @returns {{id, name, url, key, source}} where source is 'panel' or 'legacy'
 * @throws  when a specific panel was asked for and does not exist
 */
export async function resolvePanel(wantedId = null) {
  await ensureDatabase();
  await seedFromLegacySettings().catch(() => {});

  let rows = [];
  try {
    rows = await sql`SELECT id, name, url, api_key, is_default FROM pterodactyl_panels ORDER BY id ASC`;
  } catch {
    rows = [];
  }

  const picked = choosePanel(rows, wantedId);
  if (picked.error) {
    // Carries its status so a route can answer 404 rather than reporting the
    // admin's own stale page as a server fault.
    const err = new Error(picked.error);
    err.status = 404;
    throw err;
  }

  if (picked.panel) {
    return {
      id: picked.panel.id,
      name: picked.panel.name,
      url: normaliseUrl(picked.panel.url),
      key: String(picked.panel.api_key || ''),
      source: 'panel',
    };
  }

  // No panels configured at all: behave exactly as before this feature existed.
  const { url, key } = await legacyConfig();
  return { id: null, name: 'Settings default', url, key, source: 'legacy' };
}

export async function createPanel({ name, url, apiKey, isDefault }) {
  await ensureDatabase();
  const key = String(apiKey || '');
  const wantDefault = isDefault === true;
  // The unique index allows only one default, so the old one has to go first.
  if (wantDefault) await sql`UPDATE pterodactyl_panels SET is_default = false WHERE is_default`;
  const rows = await sql`
    INSERT INTO pterodactyl_panels (name, url, api_key, is_default)
    VALUES (${name}, ${url}, ${key}, ${wantDefault})
    RETURNING id, name, url, api_key, is_default
  `;
  return rows[0];
}

/**
 * Update a panel.
 *
 * `apiKey` is only written when one is supplied: the browser is never sent the
 * stored key, so an edit form comes back with nothing in that field, and treating
 * that as "clear the key" would silently break the panel on any rename.
 */
export async function updatePanel(id, { name, url, apiKey }) {
  await ensureDatabase();
  const panelId = Number(id);
  const existing = await sql`SELECT id FROM pterodactyl_panels WHERE id = ${panelId}`;
  if (!existing.length) return null;

  if (apiKey !== undefined && apiKey !== null && String(apiKey) !== '') {
    await sql`
      UPDATE pterodactyl_panels
      SET name = ${name}, url = ${url}, api_key = ${String(apiKey)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${panelId}
    `;
  } else {
    await sql`
      UPDATE pterodactyl_panels
      SET name = ${name}, url = ${url}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${panelId}
    `;
  }
  const rows = await sql`SELECT id, name, url, api_key, is_default FROM pterodactyl_panels WHERE id = ${panelId}`;
  return rows[0] || null;
}

export async function deletePanel(id) {
  await ensureDatabase();
  const panelId = Number(id);
  const rows = await sql`SELECT id, is_default FROM pterodactyl_panels WHERE id = ${panelId}`;
  if (!rows.length) return { deleted: false };

  const wasDefault = rows[0].is_default === true;
  await sql`DELETE FROM pterodactyl_panels WHERE id = ${panelId}`;

  // Losing the default would leave the panel page with no preselected panel, so
  // the oldest survivor takes over.
  if (wasDefault) {
    await sql`
      UPDATE pterodactyl_panels SET is_default = true
      WHERE id = (SELECT id FROM pterodactyl_panels ORDER BY id ASC LIMIT 1)
    `;
  }
  return { deleted: true };
}

export async function setDefault(id) {
  await ensureDatabase();
  const panelId = Number(id);
  const rows = await sql`SELECT id FROM pterodactyl_panels WHERE id = ${panelId}`;
  if (!rows.length) return null;
  // Clear first: the unique index forbids two defaults even for an instant.
  await sql`UPDATE pterodactyl_panels SET is_default = false WHERE is_default`;
  await sql`UPDATE pterodactyl_panels SET is_default = true, updated_at = CURRENT_TIMESTAMP WHERE id = ${panelId}`;
  return { id: panelId };
}

/** Ask a panel whether its key works, without touching anything on it. */
export async function testPanel(id) {
  let panel;
  try {
    panel = await resolvePanel(id === null || id === undefined ? null : Number(id));
  } catch (e) {
    return { ok: false, error: e.message };
  }
  if (!panel.url) return { ok: false, error: 'No panel URL is configured.' };
  if (!panel.key) return { ok: false, error: 'No API key is stored for this panel.' };

  try {
    const res = await fetch(`${panel.url}/api/application/users?per_page=1`, {
      headers: { Authorization: `Bearer ${panel.key}`, Accept: 'application/json' },
    });
    if (res.ok) return { ok: true, name: panel.name, url: panel.url };
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.errors?.[0]?.detail || data?.error || '';
    } catch {}
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `The panel rejected the API key (${res.status}).${detail ? ' ' + detail : ''}` };
    }
    return { ok: false, error: `The panel answered ${res.status}.${detail ? ' ' + detail : ''}` };
  } catch (e) {
    return { ok: false, error: `Could not reach ${panel.url} — ${e.message}` };
  }
}

export { legacyConfig };
