// MZAZI ADMIN — where the operator's username and password live.
//
// Precedence: the shared Neon `settings` table, then the environment.
//
// Why the database first: the admin project on Vercel has no API token in this
// environment and no dashboard access, so a credential change that required an
// environment edit could not be applied at all. The settings rows are written
// by an operator with database access and take effect on the next login — no
// redeploy, no dashboard.
//
// Only a bcrypt hash is ever stored in the settings table. The plaintext
// variable is honoured for the environment path because that is how the
// project was originally configured, and is deliberately NOT read from settings:
// a password should not be recoverable from a row dump.
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

let _sql = null;
function db() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
  }
  return _sql;
}

const KEYS = ['admin_username', 'admin_email', 'admin_password_hash'];

/**
 * The credentials to check a login against, and whether they are usable at all.
 * Never throws: a missing table or a dead database degrades to the environment.
 */
export async function adminCredentials() {
  const settings = {};
  try {
    const rows = await db()`SELECT key, value FROM settings WHERE key IN ('admin_username', 'admin_email', 'admin_password_hash')`;
    for (const r of rows) settings[r.key] = String(r.value || '');
  } catch (e) {
    console.warn('[admin][credentials] settings read failed:', e.message);
  }

  const username =
    settings.admin_username ||
    settings.admin_email ||
    process.env.ADMIN_EMAIL ||
    'admin@mzazi.shop';

  const hash = settings.admin_password_hash || process.env.ADMIN_PASSWORD_HASH || '';
  // Only consulted when no hash exists anywhere.
  const plain = hash ? '' : process.env.ADMIN_PASSWORD || '';

  return { username, hash, plain };
}

/** Constant-time-ish comparison of the submitted name against the configured one. */
export function sameUsername(submitted, configured) {
  const a = Buffer.from(String(submitted || '').trim().toLowerCase());
  const b = Buffer.from(String(configured || '').trim().toLowerCase());
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(submitted, { hash, plain }) {
  if (hash) return bcrypt.compare(String(submitted || ''), hash);
  if (plain) return String(submitted || '') === plain;
  return false;
}

export { KEYS };
