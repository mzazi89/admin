// MZAZI currency — coins
// 10 KSH = 1 MTC (MZAZI Tech Coin). The database and payment providers
// keep working in KSH/KES; MTC is the user-facing currency.
export const KSH_PER_MTC = 10;

// Convert a KSH value (DB) to MTC
export function toMtc(kshValue) {
  return (parseFloat(kshValue) || 0) / KSH_PER_MTC;
}

// Convert an MTC value to KSH (for API calls / payments)
export function mtcToKsh(mtcValue) {
  return Math.round((parseFloat(mtcValue) || 0) * KSH_PER_MTC * 100) / 100;
}

// Format a KSH value as "N MTC" (up to 2 decimals, trailing zeros trimmed)
export function fmtMtc(kshValue, digits = 2) {
  const n = Number(toMtc(kshValue).toFixed(digits));
  return `${n.toLocaleString()} MTC`;
}

// Format an MTC number directly as "N MTC"
export function fmtMtcValue(mtcValue, digits = 2) {
  const n = Number((parseFloat(mtcValue) || 0).toFixed(digits));
  return `${n.toLocaleString()} MTC`;
}
