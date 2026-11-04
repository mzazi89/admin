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

  if (process.env.NODE_ENV === 'production') {
    if (!warned) {
      warned = true;
      console.error(
        '[admin] ADMIN_JWT_SECRET is not set. Using an ephemeral secret — admin sessions will not survive a restart. Set it in the deployment environment.'
      );
    }
    return EPHEMERAL;
  }

  return DEV_SECRET;
}

/** True when a real secret is configured. Used by /api/admin/login to fail fast. */
export function adminAuthConfigured() {
  return String(process.env.ADMIN_JWT_SECRET || '').trim().length >= MIN_LENGTH;
}
