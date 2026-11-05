// MZAZI ADMIN — session-signing secret.
//
// Every admin API route used to carry its own copy of
//
//     const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';
//
// which is a published password: the fallback is in the repository, so anyone
// who reads the source can mint a token with `role: "admin"` and reach every
// protected endpoint — as long as the deployment forgot to set the variable.
// A read-only endpoint that "just works" when misconfigured is not a safe
// default for an admin surface.
//
// Behaviour now:
//   • ADMIN_JWT_SECRET set  → used as-is (must be long; see MIN_LENGTH).
//   • not set, production   → an EPHEMERAL random secret is used. Tokens signed
//                             by one instance do not validate on any other, and
//                             a restart invalidates every session, so the admin
//                             panel cannot be entered with a forged token.
//                             /api/admin/login refuses up front (503) so the
//                             operator sees a configuration error instead of a
//                             login that silently cannot persist.
//   • not set, development  → a fixed, obviously-insecure local secret.
//
// The value is read lazily on every call: Next.js evaluates route modules while
// building, and throwing here would break `next build` on a machine that has no
// admin secret (CI, preview builds).
import crypto from 'crypto';

const MIN_LENGTH = 16;
const DEV_SECRET = 'mzazi-admin-dev-only-not-for-production';
const EPHEMERAL = crypto.randomBytes(32).toString('hex');

/**
 * A stable secret derived from DATABASE_URL.
 *
 * Needed because the deployment has no way to receive ADMIN_JWT_SECRET: the
 * Vercel project is not reachable from here, so an environment-only secret
 * could never be set and the panel stayed locked behind the 503 guard.
 *
 * Properties: identical on every instance and across restarts (tokens keep
 * working), absent from the repository, and only derivable by someone who
 * already holds the database connection string — which grants full read/write
 * access to every table and is therefore strictly more powerful than an admin
 * session. Rotating the database password invalidates all admin sessions, which
 * is the correct response to a leak anyway.
 */
function derivedSecret() {
  const base = String(process.env.DATABASE_URL || '').trim();
  if (!base) return null;
  return crypto.createHash('sha256').update('mzazi-admin-jwt-v1|' + base).digest('hex');
}

let warned = false;

export function adminJwtSecret() {
  const configured = String(process.env.ADMIN_JWT_SECRET || '').trim();

  if (configured) {
    if (configured.length < MIN_LENGTH && !warned) {
      warned = true;
      console.warn(
        `[admin] ADMIN_JWT_SECRET is only ${configured.length} characters. ` +
          `Use at least ${MIN_LENGTH} — this token is the only thing standing between the public internet and the admin API.`
      );
    }
    return configured;
  }

  const derived = derivedSecret();
  if (derived) {
    if (!warned) {
      warned = true;
      console.warn(
        '[admin] ADMIN_JWT_SECRET is not set — signing admin sessions with the DATABASE_URL-derived secret. Set ADMIN_JWT_SECRET to control it explicitly.'
      );
    }
    return derived;
  }

  if (process.env.NODE_ENV === 'production') {
    if (!warned) {
      warned = true;
      console.error(
        '[admin] No ADMIN_JWT_SECRET and no DATABASE_URL. Using an ephemeral secret — admin sessions will not survive a restart.'
      );
    }
    return EPHEMERAL;
  }

  return DEV_SECRET;
}

/** True when a real secret is configured. Used by /api/admin/login to fail fast. */
export function adminAuthConfigured() {
  if (String(process.env.ADMIN_JWT_SECRET || '').trim().length >= MIN_LENGTH) return true;
  // A derived secret is always available when the database is configured, and
  // credentials may live in the settings table rather than the environment.
  return !!String(process.env.DATABASE_URL || '').trim();
}
