// Shared helpers for the WhatsApp pairing APIs (/api/pair/*)
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'mzazi-tech-secret-2024';

// WhatsApp Bot plans (mirror of the bot's PLANS in lib/subscription.js)
// prices are in KSH (the wallet stores KSH; the UI shows MTC via fmtMtc)
export const PLANS = {
  PLAN_5:    { key: 'PLAN_5',    name: '5 Devices',   maxDevices: 5,   priceKsh: 100, days: 30 },
  PLAN_10:   { key: 'PLAN_10',   name: '10 Devices',  maxDevices: 10,  priceKsh: 150, days: 30 },
  PLAN_20:   { key: 'PLAN_20',   name: '20 Devices',  maxDevices: 20,  priceKsh: 200, days: 30 },
  UNLIMITED: { key: 'UNLIMITED', name: 'Unlimited',   maxDevices: 999, priceKsh: 250, days: 30 },
};

export async function auth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');
  if (!token) return null;
  try {
    return jwt.verify(token.value, JWT_SECRET);
  } catch {
    return null;
  }
}

export function normalizeNumber(n) {
  const digits = String(n || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

// find the bot-side account (prisma "User" keyed by telegramId = site user id)
export async function getAccount(sql, siteUserId) {
  const rows = await sql`SELECT id FROM "User" WHERE "telegramId" = ${Number(siteUserId)} LIMIT 1`;
  return rows[0] || null;
}

export async function ensureAccount(sql, siteUserId) {
  const rows = await sql`
    INSERT INTO "User" ("telegramId", "updatedAt")
    VALUES (${Number(siteUserId)}, CURRENT_TIMESTAMP)
    ON CONFLICT ("telegramId") DO UPDATE SET
      "telegramId" = EXCLUDED."telegramId",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING id
  `;
  return rows[0];
}
