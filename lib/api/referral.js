// MZAZI referral system
// Referrer earns KSH 20 (REFERRAL_BONUS env, configurable) whenever a referred
// user completes a panel purchase. Credits go straight to the referrer's wallet.
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const REFERRAL_BONUS = parseFloat(process.env.REFERRAL_BONUS || '20');

export function generateReferralCode() {
  // 8-char unambiguous base32-ish code (no 0/O/1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// Make sure a user has a unique referral code (backfill)
export async function ensureReferralCode(userId) {
  const rows = await sql`SELECT referral_code FROM users WHERE id = ${userId} LIMIT 1`;
  if (rows.length === 0) return null;
  if (rows[0].referral_code) return rows[0].referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      await sql`UPDATE users SET referral_code = ${code} WHERE id = ${userId} AND referral_code IS NULL`;
      return code;
    } catch {
      // unique collision — try again
    }
  }
  return null;
}

// Resolve a referral code to a user id (null if invalid)
export async function resolveReferralCode(code) {
  if (!code || typeof code !== 'string') return null;
  const rows = await sql`
    SELECT id FROM users WHERE UPPER(referral_code) = UPPER(${code.trim()}) LIMIT 1
  `;
  return rows.length > 0 ? rows[0].id : null;
}

// Credit the referrer when a referred user completes a purchase.
// Idempotent (UNIQUE order_id) — safe to call multiple times. Never throws.
export async function creditReferralCommission({ orderId, buyerUserId, reference, amount = REFERRAL_BONUS }) {
  try {
    if (!buyerUserId) return null;

    const buyer = await sql`
      SELECT u.referred_by FROM users u WHERE u.id = ${buyerUserId} LIMIT 1
    `;
    if (buyer.length === 0 || !buyer[0].referred_by) return null;

    const referrerId = buyer[0].referred_by;
    if (referrerId === buyerUserId) return null; // self-referral guard

    // Guard: commission already paid for this order
    const existing = await sql`
      SELECT id FROM referral_commissions WHERE order_id = ${orderId} LIMIT 1
    `;
    if (existing.length > 0) return null;

    // 1) commission record (status paid — instant credit)
    await sql`
      INSERT INTO referral_commissions (referrer_user_id, referred_user_id, order_id, amount, status)
      VALUES (${referrerId}, ${buyerUserId}, ${orderId}, ${amount}, 'paid')
    `;

    // 2) credit the referrer's wallet
    await sql`
      INSERT INTO wallet (user_id, balance)
      VALUES (${referrerId}, ${amount})
      ON CONFLICT (user_id) DO UPDATE SET
        balance = wallet.balance + ${amount},
        updated_at = CURRENT_TIMESTAMP
    `;

    // 3) wallet transaction record
    await sql`
      INSERT INTO wallet_transactions (user_id, type, amount, reference, description, status)
      VALUES (${referrerId}, 'referral', ${amount}, ${reference || null},
              ${`Referral bonus — KSH ${amount} for a referred purchase${orderId ? ` (#${orderId})` : ''}`},
              'success')
    `;

    return { referrerId, amount };
  } catch (e) {
    // A commission failure must never break the purchase flow
    console.error('[mzazi] referral commission failed:', e.message);
    return null;
  }
}
