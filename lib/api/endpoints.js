// MZAZI API — endpoint registry helpers
import { neon } from '@neondatabase/serverless';
import { qmark } from './utils';

const sql = neon(process.env.DATABASE_URL);

export async function getEndpoint(path) {
  const m = qmark();
  const rows = await sql`SELECT * FROM endpoints WHERE path = ${path} AND ${m} = ${m} LIMIT 1`;
  return rows.length > 0 ? rows[0] : null;
}

export async function listEndpoints({ activeOnly = false } = {}) {
  const rows = await sql`
    SELECT * FROM endpoints
    ${activeOnly ? sql`WHERE is_active = true` : sql``}
    ORDER BY category ASC, path ASC
  `;
  // (unique marker not needed: list reads tolerate staleness)
  return rows;
}

export async function setEndpointActive(id, isActive) {
  const m = qmark();
  await sql`UPDATE endpoints SET is_active = ${isActive} WHERE id = ${id} AND ${m} = ${m}`;
}
