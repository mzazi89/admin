// ─────────────────────────────────────────────────────────────────────────────
// Reseller passwords — the strings a buyer types into WhatsApp as
// `.panel <password>` to turn their number into a panel reseller.
//
// Lives here, free of database access, so the rules can be exercised directly.
//
// THE RULE THAT MATTERS: be permissive about what a password may contain.
//
// The bot used to require /^[A-Za-z0-9]{6,}$/ before it would even TRY a password,
// so one containing a hyphen, a space or fewer than six characters was silently
// ignored — the activation prompt simply came back, which looks exactly like the
// bot not seeing the password. A password is a secret someone types once; it must
// not have to survive a guess about its shape. The only real limits are that it is
// non-empty, short enough to type, and free of characters that cannot travel
// through a chat message intact.
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 64;

// Unambiguous alphabet (no 0/O, no 1/I/L) for generated passwords — a buyer reads
// these off a receipt and types them by hand.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode(len = 10, rand = null) {
  let out = '';
  for (let i = 0; i < len; i++) {
    if (rand) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
    else out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Validate a password the admin has chosen.
 *
 * Preserves the admin's exact characters — case included — because it is their
 * secret and the bot matches it case-insensitively rather than rewriting it.
 */
export function validateResellerPassword(input) {
  const value = String(input == null ? '' : input).trim();
  const errors = [];

  if (!value) {
    errors.push('Enter a password.');
  } else if (value.length < MIN_LENGTH) {
    errors.push(`A password needs at least ${MIN_LENGTH} characters.`);
  } else if (value.length > MAX_LENGTH) {
    errors.push(`A password can be at most ${MAX_LENGTH} characters.`);
  } else if (/[\u0000-\u001f\u007f]/.test(value)) {
    // A newline or tab cannot survive being typed on one chat line, and would
    // arrive truncated rather than wrong — the hardest kind of failure to see.
    errors.push('A password cannot contain line breaks or tabs.');
  }

  return { ok: errors.length === 0, errors, value };
}

/** The statuses a reseller password can hold. */
export const STATUSES = ['unused', 'active', 'disabled'];

/** Human wording for a row's status, used by both the table and the API. */
export function statusLabel(status) {
  switch (status) {
    case 'active': return 'CLAIMED';
    case 'disabled': return 'DISABLED';
    default: return 'READY';
  }
}

/**
 * Normalise a phone number for comparison with `activated_by`.
 *
 * Mirrors the bot's own normaliser. Kept in step deliberately: the admin search
 * has to agree with how the bot stores the value, or a reseller looks unbound here
 * while the bot happily recognises them.
 */
export function normalizePhone(raw) {
  let p = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  return /^254\d{9}$/.test(p) ? p : '';
}
