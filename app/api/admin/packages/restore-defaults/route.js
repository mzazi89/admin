import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

const DEFAULTS = [
  { name: 'Starter',  price: 50,  cpu: 20,  ram: 512,   disk: 2048,  description: 'Perfect for small bots and lightweight servers',        popular: false, accent: '#1e3a8a', sort_order: 1 },
  { name: 'Standard', price: 75,  cpu: 50,  ram: 1024,  disk: 5120,  description: 'Great for Minecraft, Discord bots & medium workloads',  popular: true,  accent: '#2563eb', sort_order: 2 },
  { name: 'Premium',  price: 100, cpu: 100, ram: 5120,  disk: 10240, description: 'Full power for high-performance game servers',           popular: false, accent: '#1d4ed8', sort_order: 3 },
  { name: 'Ultimate', price: 120, cpu: 0,   ram: 0,     disk: 0,     description: 'No limits. Maximum performance for any workload.',      popular: false, accent: '#4f46e5', sort_order: 4 },
];

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return false;
  try { const d = jwt.verify(token.value, ADMIN_JWT_SECRET); return d.role === 'admin'; }
  catch { return false; }
}

export async function POST() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS packages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        cpu INTEGER NOT NULL DEFAULT 0,
        ram INTEGER NOT NULL DEFAULT 0,
        disk INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        popular BOOLEAN DEFAULT false,
        accent VARCHAR(20) DEFAULT '#2563eb',
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // DELETE all existing packages first so restore doesn't create duplicates
    await sql`DELETE FROM packages`;

    // Reset the ID sequence so IDs start cleanly from 1
    await sql`ALTER SEQUENCE packages_id_seq RESTART WITH 1`;

    const inserted = [];
    for (const pkg of DEFAULTS) {
      const rows = await sql`
        INSERT INTO packages (name, price, cpu, ram, disk, description, popular, accent, active, sort_order)
        VALUES (${pkg.name}, ${pkg.price}, ${pkg.cpu}, ${pkg.ram}, ${pkg.disk}, ${pkg.description}, ${pkg.popular}, ${pkg.accent}, true, ${pkg.sort_order})
        RETURNING *
      `;
      inserted.push(rows[0]);
    }
    return NextResponse.json({ message: `Restored ${inserted.length} default packages`, packages: inserted });
  } catch (error) {
    console.error('Restore defaults error:', error);
    return NextResponse.json({ error: 'Failed to restore defaults' }, { status: 500 });
  }
}
