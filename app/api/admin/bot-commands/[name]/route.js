// MZAZI API — /api/admin/bot-commands/[name]
// Admin update / delete for a single bot command.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';
import { requestBotCommandSync } from '@/lib/botSync';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mzazi-admin-secret-2024';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');
  if (!token) return false;
  try {
    const d = jwt.verify(token.value, ADMIN_JWT_SECRET);
    return d.role === 'admin';
  } catch {
    return false;
  }
}

const NAME_RE = /^[a-z0-9_-]{1,64}$/;
// A command's bot. '' is the column default (primary bot) — an ABSENT profile
// must mean '', never "all", so an edit can only ever touch one bot's row.
const PROFILE_RE = /^[A-Za-z0-9_-]{0,64}$/;

// `?profile=` selects which bot's row to act on; omitted → '' (the default).
function readProfile(request) {
  try {
    const raw = new URL(request.url).searchParams.get('profile');
    return raw === null ? '' : raw;
  } catch {
    return '';
  }
}

export async function GET(request, { params }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureDatabase();
    const profile = readProfile(request);
    if (!PROFILE_RE.test(profile)) {
      return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
    }
    const rows = await sql`
      SELECT name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code, profile, updated_at
      FROM bot_commands WHERE name = ${params.name} AND profile = ${profile}
    `;
    if (!rows.length) return NextResponse.json({ error: 'Command not found' }, { status: 404 });
    const r = rows[0];
    return NextResponse.json({
      command: {
        name: r.name,
        aliases: Array.isArray(r.aliases) ? r.aliases : [],
        description: r.description || '',
        category: r.category || 'General',
        usage: r.usage || '',
        ownerOnly: !!r.owner_only,
        adminOnly: !!r.admin_only,
        groupOnly: !!r.group_only,
        enabled: r.enabled !== false,
        code: r.code || '',
        profile: r.profile || '',
      },
    });
  } catch (error) {
    console.error('Admin bot-command get error:', error);
    return NextResponse.json({ error: 'Failed to fetch command' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const name = params.name;
    const body = await request.json();

    // The profile of the row being edited (which bot it currently belongs to).
    const currentProfile = readProfile(request);
    if (!PROFILE_RE.test(currentProfile)) {
      return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
    }
    // A PUT may also move the command to another bot. Absent → keep it where it is.
    const nextProfile = typeof body.profile === 'string' ? body.profile : currentProfile;
    if (!PROFILE_RE.test(nextProfile)) {
      return NextResponse.json({ error: 'Invalid profile — use a-z, A-Z, 0-9, _ or - (max 64 chars)' }, { status: 400 });
    }

    // `code` is optional on update (e.g. the table's enable/disable toggle only
    // sends metadata) — when absent, the existing code is kept untouched.
    const hasCode = typeof body.code === 'string' && body.code.trim().length > 0;
    if (body.code !== undefined && typeof body.code !== 'string') return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    if (typeof body.code === 'string' && body.code.length > 60000) return NextResponse.json({ error: 'code is too long (max 60000 chars)' }, { status: 400 });
    if (body.aliases !== undefined && (!Array.isArray(body.aliases) || body.aliases.some((a) => typeof a !== 'string' || !NAME_RE.test(a)))) {
      return NextResponse.json({ error: 'Invalid aliases' }, { status: 400 });
    }

    // Scoped by (name, profile) so exactly one row — never both bots' rows.
    const upd = await sql`
          UPDATE bot_commands SET
            aliases = ${JSON.stringify(Array.isArray(body.aliases) ? body.aliases : [])}::jsonb,
            description = ${typeof body.description === 'string' ? body.description : ''},
            category = ${typeof body.category === 'string' && body.category ? body.category : 'General'},
            usage = ${typeof body.usage === 'string' ? body.usage : ''},
            owner_only = ${!!body.ownerOnly},
            admin_only = ${!!body.adminOnly},
            group_only = ${!!body.groupOnly},
            enabled = ${body.enabled !== false},
            code = COALESCE(NULLIF(${hasCode ? body.code : ''}, ''), code),
            profile = ${nextProfile},
            updated_at = CURRENT_TIMESTAMP
          WHERE name = ${name} AND profile = ${currentProfile}
          RETURNING id, name, enabled, profile
        `;
    if (!upd.length) return NextResponse.json({ error: 'Command not found' }, { status: 404 });

    // Push the change to the running bot immediately (~15s). If the command moved
    // between bots, wake both — the old owner must drop it, the new one add it.
    await requestBotCommandSync(nextProfile);
    if (nextProfile !== currentProfile) await requestBotCommandSync(currentProfile);

    return NextResponse.json({ ok: true, command: upd[0] });
  } catch (error) {
    console.error('Admin bot-commands update error:', error);
    return NextResponse.json({ error: 'Failed to update command' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const profile = readProfile(request);
    if (!PROFILE_RE.test(profile)) {
      return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
    }

    // Scoped by (name, profile) so exactly one row is deleted — never both
    // bots' rows of the same name.
    const del = await sql`DELETE FROM bot_commands WHERE name = ${params.name} AND profile = ${profile} RETURNING id`;
    if (!del.length) return NextResponse.json({ error: 'Command not found' }, { status: 404 });

    // Push the change to the running bot immediately (~15s).
    await requestBotCommandSync(profile);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Admin bot-commands delete error:', error);
    return NextResponse.json({ error: 'Failed to delete command' }, { status: 500 });
  }
}
