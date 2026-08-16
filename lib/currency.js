// MZAZI currency — Kenyan Shillings (KES)
// All database values and payment-provider amounts are stored in KES.
// No conversion layer: what you see is what is charged.

// Format a KES value as "KES N" (up to 2 decimals, trailing zeros trimmed)
export function fmtKes(value, digits = 2) {
  const n = Number((parseFloat(value) || 0).toFixed(digits));
  return `KES ${n.toLocaleString()}`;
}
