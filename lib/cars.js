// ─────────────────────────────────────────────────────────────────────────────
// lib/cars.js (admin) — the dealer's side of the Golden Lion Motors showroom.
//
// The customer site owns the public reads (web/lib/cars.js). This module owns the
// writes, because the admin panel is a separate deployment with its own auth and
// its own DATABASE_URL. The table shape is duplicated here on purpose: a shared
// library between two Next apps would need a build step neither has.
// ─────────────────────────────────────────────────────────────────────────────
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });

export const MAX_IMAGES = 8;
export const MAX_IMAGE_BYTES = 1_800_000;
export const BODY_TYPES = ['Pickup', 'Light Truck', 'Heavy Truck', 'Prime Mover', 'Tipper Truck', 'Van', 'Bus', 'SUV', 'Tractor'];
export const CONDITIONS = ['Brand new', 'Foreign used', 'Locally used', 'Refurbished'];
export const FUELS = ['Diesel', 'Petrol', 'Electric', 'Hybrid'];
export const TRANSMISSIONS = ['Manual', 'Automatic'];
export const STATUSES = ['draft', 'published', 'sold'];

let ready = null;
export function ensureCars() {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cars (
          id SERIAL PRIMARY KEY, slug VARCHAR(140) UNIQUE NOT NULL, title VARCHAR(160) NOT NULL,
          model VARCHAR(80), body VARCHAR(40), year INTEGER, price_kes BIGINT,
          negotiable BOOLEAN DEFAULT true, mileage_km INTEGER, fuel VARCHAR(30),
          transmission VARCHAR(30), drive VARCHAR(20), engine VARCHAR(80), seats INTEGER,
          payload_kg INTEGER, color VARCHAR(40), condition VARCHAR(40), description TEXT,
          features TEXT[] DEFAULT '{}', status VARCHAR(12) NOT NULL DEFAULT 'draft',
          featured BOOLEAN DEFAULT false, views INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KES'`;
      await sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '[]'::jsonb`;
      await sql`
        CREATE TABLE IF NOT EXISTS car_images (
          id SERIAL PRIMARY KEY, car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
          mime VARCHAR(40) NOT NULL, bytes TEXT NOT NULL, size_bytes INTEGER DEFAULT 0,
          position INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const clean = (v, max = 200) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const int = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
};

export function slugify(input) {
  return String(input || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

async function uniqueSlug(base, exceptId = null) {
  const root = slugify(base) || `vehicle-${Date.now().toString(36)}`;
  let candidate = root;
  for (let i = 2; i < 50; i += 1) {
    const clash = exceptId
      ? await sql`SELECT id FROM cars WHERE slug = ${candidate} AND id <> ${exceptId} LIMIT 1`
      : await sql`SELECT id FROM cars WHERE slug = ${candidate} LIMIT 1`;
    if (!clash[0]) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function saveCar(input, { id = null } = {}) {
  await ensureCars();
  const title = clean(input.title, 160);
  if (title.length < 3) throw new Error('Give the vehicle a title (at least 3 characters)');

  const values = {
    title,
    model: clean(input.model, 80) || null,
    body: BODY_TYPES.includes(input.body) ? input.body : null,
    year: int(input.year) || null,
    price_kes: (() => { const p = int(input.price_kes); return p && p > 0 ? p : null; })(),
    negotiable: input.negotiable === undefined ? true : Boolean(input.negotiable),
    mileage_km: int(input.mileage_km),
    fuel: FUELS.includes(input.fuel) ? input.fuel : null,
    transmission: TRANSMISSIONS.includes(input.transmission) ? input.transmission : null,
    drive: clean(input.drive, 20) || null,
    engine: clean(input.engine, 80) || null,
    seats: int(input.seats) || null,
    payload_kg: int(input.payload_kg) || null,
    color: clean(input.color, 40) || null,
    condition: CONDITIONS.includes(input.condition) ? input.condition : null,
    description: clean(input.description, 6000) || null,
    features: Array.isArray(input.features)
      ? input.features.map((f) => clean(f, 60)).filter(Boolean).slice(0, 24)
      : String(input.features || '').split('\n').map((f) => clean(f, 60)).filter(Boolean).slice(0, 24),
    status: STATUSES.includes(input.status) ? input.status : 'draft',
    currency: ['KES', 'USD'].includes(String(input.currency || '').toUpperCase())
      ? String(input.currency).toUpperCase()
      : 'KES',
    specs: Array.isArray(input.specs)
      ? input.specs.filter((r) => r && r.label && r.value).map((r) => ({ label: clean(r.label, 60), value: clean(r.value, 120) })).slice(0, 30)
      : String(input.specs || '')
        .split('\n')
        .map((line) => {
          const idx = line.indexOf(':');
          if (idx === -1) return null;
          const label = clean(line.slice(0, idx), 60);
          const value = clean(line.slice(idx + 1), 120);
          return label && value ? { label, value } : null;
        })
        .filter(Boolean)
        .slice(0, 30),
    featured: Boolean(input.featured),
  };

  if (id) {
    const slug = await uniqueSlug(input.slug || values.title, id);
    const rows = await sql`
      UPDATE cars SET
        slug = ${slug}, title = ${values.title}, model = ${values.model}, body = ${values.body},
        year = ${values.year}, price_kes = ${values.price_kes}, negotiable = ${values.negotiable},
        mileage_km = ${values.mileage_km}, fuel = ${values.fuel}, transmission = ${values.transmission},
        drive = ${values.drive}, engine = ${values.engine}, seats = ${values.seats},
        payload_kg = ${values.payload_kg}, color = ${values.color}, condition = ${values.condition},
        description = ${values.description}, features = ${values.features}::text[],
        status = ${values.status}, currency = ${values.currency},
        specs = ${JSON.stringify(values.specs)}::jsonb,
        featured = ${values.featured}, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    return rows[0] || null;
  }

  const slug = await uniqueSlug(input.slug || values.title);
  const rows = await sql`
    INSERT INTO cars
      (slug, title, model, body, year, price_kes, negotiable, mileage_km, fuel, transmission,
       drive, engine, seats, payload_kg, color, condition, description, features, status,
       currency, specs, featured)
    VALUES
      (${slug}, ${values.title}, ${values.model}, ${values.body}, ${values.year}, ${values.price_kes},
       ${values.negotiable}, ${values.mileage_km}, ${values.fuel}, ${values.transmission},
       ${values.drive}, ${values.engine}, ${values.seats}, ${values.payload_kg}, ${values.color},
       ${values.condition}, ${values.description}, ${values.features}::text[], ${values.status},
       ${values.currency}, ${JSON.stringify(values.specs)}::jsonb, ${values.featured})
    RETURNING *
  `;
  return rows[0];
}

export async function adminCars({ status = 'all', q = '' } = {}) {
  await ensureCars();
  const wanted = STATUSES.includes(status) ? status : 'all';
  const term = clean(q, 60);
  return sql`
    SELECT c.id, c.slug, c.title, c.status, c.price_kes, c.currency, c.year, c.body, c.views, c.updated_at, c.featured,
           (SELECT i.id FROM car_images i WHERE i.car_id = c.id ORDER BY i.position, i.id LIMIT 1) AS cover_id,
           (SELECT COUNT(*)::int FROM car_images i WHERE i.car_id = c.id) AS image_count
    FROM cars c
    WHERE (${wanted} = 'all' OR c.status = ${wanted})
      AND (${term} = '' OR c.title ILIKE '%' || ${term} || '%')
    ORDER BY c.updated_at DESC
    LIMIT 200
  `;
}

export async function adminCar(id) {
  await ensureCars();
  const rows = await sql`SELECT * FROM cars WHERE id = ${Number(id)} LIMIT 1`;
  const car = rows[0];
  if (!car) return null;
  const images = await sql`
    SELECT id FROM car_images WHERE car_id = ${car.id} ORDER BY position, id
  `;
  return { ...car, images: images.map((i) => i.id) };
}

export async function deleteCar(id) {
  await ensureCars();
  await sql`DELETE FROM car_images WHERE car_id = ${Number(id)}`;
  await sql`DELETE FROM cars WHERE id = ${Number(id)}`;
}

export async function addImage(carId, { mime, bytes, size }) {
  await ensureCars();
  const count = await sql`SELECT COUNT(*)::int AS c FROM car_images WHERE car_id = ${Number(carId)}`;
  if (Number(count[0]?.c || 0) >= MAX_IMAGES) throw new Error(`A listing holds at most ${MAX_IMAGES} photos`);

  const pos = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM car_images WHERE car_id = ${Number(carId)}`;
  const rows = await sql`
    INSERT INTO car_images (car_id, mime, bytes, size_bytes, position)
    VALUES (${Number(carId)}, ${mime}, ${bytes}, ${size}, ${Number(pos[0]?.p || 0)})
    RETURNING id
  `;
  await sql`UPDATE cars SET updated_at = NOW() WHERE id = ${Number(carId)}`;
  return rows[0];
}

export async function removeImage(carId, imageId) {
  await sql`DELETE FROM car_images WHERE id = ${Number(imageId)} AND car_id = ${Number(carId)}`;
  await sql`UPDATE cars SET updated_at = NOW() WHERE id = ${Number(carId)}`;
}
