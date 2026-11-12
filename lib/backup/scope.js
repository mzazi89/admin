// MZAZI ADMIN — what the inbuilt backup covers.
//
// Scope was decided deliberately: MONEY AND PEOPLE. These are the tables whose
// loss cannot be repaired by re-running anything — an account, a balance, a
// payment, a voucher somebody paid for. Everything else in the database is
// either regenerable (packages, announcements), rebuildable from another source
// (bot_commands lives in git as data/bot-commands.json), or operational noise
// (api_requests, bot_status).
//
// Adding a table here is the only edit needed: the snapshot, the schema capture
// and the transfer all drive off this list.

export const PROTECTED_TABLES = [
  'users',
  'wallet',
  'wallet_transactions',
  'orders',
  'vps_orders',
  'payments',
  'subscriptions',
  'voucher_codes',
  'referral_commissions',
  'packages',
  'vps_packages',
];

/**
 * A table or column name that is safe to interpolate into SQL.
 *
 * Every identifier that reaches a query string is checked against this first.
 * The list above is a constant, so this is belt-and-braces rather than the only
 * defence — but a backup tool that can be tricked into reading an arbitrary
 * table is a data-exfiltration tool, and the check costs nothing.
 */
export function safeIdent(name) {
  return typeof name === 'string' && /^[a-z_][a-z0-9_]*$/.test(name);
}

/** Rows per INSERT in the transfer. Big enough to be fast, small enough to stay
 *  under Neon's per-request limits. */
export const TRANSFER_BATCH_ROWS = 200;
