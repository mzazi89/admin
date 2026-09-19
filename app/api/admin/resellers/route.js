// MZAZI API — /api/admin/resellers
// Admin: the reseller passwords for the WhatsApp panel system.
//   GET                              → every password with its status, plus panels made under it
//   POST { count }                   → generate `count` random passwords (returned ONCE)
//   POST { action:'create', code }   → create ONE password the admin chose
//   POST { action:'disable', id }    → stop it being claimable (and revoke a claimed one)
//   POST { action:'enable',  id }    → make it claimable again
//   POST { action:'reset',   id }    → unbind the number that claimed it, so it can be claimed again
//   POST { action:'delete',  id }
//
// The admin owns this list: they choose the password and decide whether it is live.
// A reseller then binds their own number by sending `.panel <password>` once.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { initializeDatabase } from '@/lib/database';
import { validateResellerPassword, generateCode } from '@/lib/resellerCodes';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return false;
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    return payload?.role === 'admin';
  } catch { return false; }
}

// The list, in the one shape the page needs. Used by every mutating action as its
// response body, so the page can simply replace its rows instead of re-fetching —
// and so the table can never drift from what the server holds.
async function listAll() {
  return await sql`
    SELECT r.id, r.code, r.status, r.activated_by, r.activated_at, r.created_at,
           (SELECT COUNT(*) FROM whatsapp_panels w WHERE w.reseller_phone = r.activated_by) AS panels_created
    FROM reseller_passwords r
    ORDER BY r.id DESC
    LIMIT 500
  `;
}

/** The id in a payload, as a positive integer, or null when it is unusable. */
function idOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await initializeDatabase();
    return NextResponse.json({ passwords: await listAll() });
  } catch (e) {
    console.error('Resellers list error:', e.message);
    return NextResponse.json({ error: 'Failed to load reseller passwords' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body = {};
  try {
    body = await request.json();
  } catch { /* an empty body means "generate one" */ }
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

  const action = String(body.action || '').trim();

  try {
    await initializeDatabase();

    // ── Create ONE password the admin typed ──────────────────────────────────
    if (action === 'create') {
      const checked = validateResellerPassword(body.code);
      if (!checked.ok) {
        return NextResponse.json({ error: checked.errors.join(' ') }, { status: 400 });
      }
      try {
        const rows = await sql`
          INSERT INTO reseller_passwords (code)
          VALUES (${checked.value})
          RETURNING id, code, status, created_at, activated_by, activated_at
        `;
        return NextResponse.json({
          passwords: await listAll(),
          created: rows[0] || null,
        });
      } catch (e) {
        // 23505 = unique violation. Saying so is the whole point: the admin picked
        // this string, so "that password is already in the list" is actionable,
        // whereas silently creating a second copy or a random one would not be.
        if (e.code === '23505') {
          return NextResponse.json(
            { error: 'That password is already in the list. Choose a different one.' },
            { status: 409 }
          );
        }
        throw e;
      }
    }

    // ── Generate `count` random passwords ────────────────────────────────────
    if (!action || action === 'generate') {
      const count = Math.min(100, Math.max(1, parseInt(body.count) || 1));
      const codes = [];
      for (let i = 0; i < count; i++) {
        let inserted = false;
        for (let attempt = 0; attempt < 8 && !inserted; attempt++) {
          const code = generateCode(10);
          try {
            const res = await sql`
              INSERT INTO reseller_passwords (code)
              VALUES (${code})
              RETURNING id, code, status, created_at, activated_by, activated_at
            `;
            codes.push(res[0]);
            inserted = true;
          } catch (e) {
            if (e.code !== '23505') throw e; // collision → try another
          }
        }
        if (!inserted) throw new Error('Could not generate a unique password — please retry');
      }
      return NextResponse.json({ passwords: codes, all: await listAll() });
    }

    // ── Everything else acts on one existing row ─────────────────────────────
    const id = idOrNull(body.id);
    if (!id) return NextResponse.json({ error: 'A password id is required.' }, { status: 400 });

    const existing = await sql`SELECT id, status FROM reseller_passwords WHERE id = ${id}`;
    if (!existing.length) {
      return NextResponse.json({ error: 'That password no longer exists.' }, { status: 404 });
    }

    if (action === 'disable') {
      await sql`UPDATE reseller_passwords SET status = 'disabled' WHERE id = ${id}`;
      return NextResponse.json({ ok: true, passwords: await listAll() });
    }

    if (action === 'enable') {
      // Enabling must not silently strip a number that already claimed it, so the
      // status alone is restored and `activated_by` is left untouched.
      await sql`
        UPDATE reseller_passwords
        SET status = CASE WHEN activated_by IS NULL THEN 'unused' ELSE 'active' END
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true, passwords: await listAll() });
    }

    if (action === 'reset') {
      await sql`
        UPDATE reseller_passwords
        SET status = 'unused', activated_by = NULL, activated_at = NULL
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true, passwords: await listAll() });
    }

    if (action === 'delete') {
      await sql`DELETE FROM reseller_passwords WHERE id = ${id}`;
      return NextResponse.json({ ok: true, passwords: await listAll() });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Resellers POST error:', e.message);
    return NextResponse.json({ error: 'Request failed: ' + e.message }, { status: 500 });
  }
}
