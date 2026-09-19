// ─────────────────────────────────────────────────────────────────────────────
// WHICH PTERODACTYL PANEL DOES THIS REQUEST MEAN?
//
// The admin site can hold more than one panel. Every panel action therefore has to
// answer one question first: which panel. Keeping that decision here, free of any
// database import, means the part that can be wrong in a dangerous way — pointing
// an action at the wrong host — is exercised directly in a test rather than
// inferred from a request.
//
// THE RULE THAT MATTERS: an explicitly requested panel that cannot be found is an
// ERROR. It is never quietly replaced by the default. Falling back here would mean
// "delete this user's servers" running against a different panel than the one the
// admin was looking at, which is exactly the failure that has no undo.
// ─────────────────────────────────────────────────────────────────────────────

/** Trim, and drop trailing slashes so a URL can be concatenated with a path. */
export function normaliseUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  return raw ? raw.replace(/\/+$/, '') : '';
}

/**
 * Read a panel id out of a query string or request body.
 *
 * Three distinct outcomes, because "not asked for" and "asked for something
 * nonsense" must not be treated alike:
 *   { ok: true,  id: null }  nothing was requested — use the default
 *   { ok: true,  id: 4 }     that panel, which the caller must then find
 *   { ok: false }            the caller asked for something that is not an id
 */
export function parseWantedId(value) {
  if (value === null || value === undefined) return { ok: true, id: null };
  // A query string or a JSON body can only carry a string, a number, or nothing.
  // Anything else is a malformed request, and reading that as "no panel asked for"
  // would quietly act on the default instead of the panel the caller meant — the
  // one outcome this whole file exists to prevent.
  if (typeof value !== 'string' && typeof value !== 'number') return { ok: false, id: null };
  const text = String(value).trim();
  if (text === '') return { ok: true, id: null };
  const n = Number(text);
  if (!Number.isInteger(n) || n <= 0) return { ok: false, id: null };
  return { ok: true, id: n };
}

/**
 * Pick the panel to act on.
 *
 * @param rows      rows from pterodactyl_panels, in display order
 * @param wantedId  a positive integer, or null for "the default"
 * @returns {{panel: object}|{panel: null}|{error: string}}
 */
export function choosePanel(rows, wantedId) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];

  if (wantedId !== null && wantedId !== undefined) {
    const wanted = Number(wantedId);
    const hit = list.find((r) => Number(r.id) === wanted);
    if (!hit) {
      // Deliberately NOT the default. See the note at the top of this file.
      return {
        error: `Panel #${wanted} was not found. It may have been deleted — reload the page and pick a panel again.`,
      };
    }
    return { panel: hit };
  }

  if (!list.length) return { panel: null };
  return { panel: list.find((r) => r.is_default === true) || list[0] };
}

/**
 * Validate a create/update payload.
 *
 * The name is required rather than optional: with several panels configured, an
 * unnamed one is indistinguishable from the others in every dropdown in the site.
 */
export function validatePanelInput(input) {
  const name = String((input && input.name) || '').trim();
  const url = normaliseUrl(input && input.url);
  const errors = [];

  if (!name) errors.push('Give the panel a name so it can be told apart from the others.');
  else if (name.length > 80) errors.push('Panel name must be 80 characters or fewer.');

  if (!url) errors.push('Panel URL is required.');
  else if (!/^https?:\/\//i.test(url)) errors.push('Panel URL must start with http:// or https://');

  return { ok: errors.length === 0, errors, value: { name, url } };
}

/**
 * A display-safe stand-in for an API key.
 *
 * Settings are read back by the browser, so a stored key must never be part of a
 * response. The last four characters are enough for an admin to confirm which key
 * is in place without the value being usable.
 */
export function keyHint(key) {
  const k = String(key == null ? '' : key).trim();
  if (!k) return '';
  return k.length <= 4 ? '••••' : `••••${k.slice(-4)}`;
}

/** Shape a row for the browser: everything except the key itself. */
export function publicPanel(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    is_default: row.is_default === true,
    hasKey: !!String(row.api_key || '').trim(),
    keyHint: keyHint(row.api_key),
  };
}
