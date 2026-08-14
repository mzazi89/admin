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

export async function GET(request, { params }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await ensureDatabase();
    const rows = await sql`
      SELECT name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code, updated_at
      FROM bot_commands WHERE name = ${params.name}
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

    if (typeof body.code !== 'string' || !body.code.trim()) return NextResponse.json({ error: 'code is required' }, { status: 400 });
    if (body.code.length > 60000) return NextResponse.json({ error: 'code is too long (max 60000 chars)' }, { status: 400 });
    if (body.aliases !== undefined && (!Array.isArray(body.aliases) || body.aliases.some((a) => typeof a !== 'string' || !NAME_RE.test(a)))) {
      return NextResponse.json({ error: 'Invalid aliases' }, { status: 400 });
    }

    const upd = body.code && String(body.code).trim()
      ? await sql`
          UPDATE bot_commands SET
            aliases = ${JSON.stringify(Array.isArray(body.aliases) ? body.aliases : [])}::jsonb,
            description = ${typeof body.description === 'string' ? body.description : ''},
            category = ${typeof body.category === 'string' && body.category ? body.category : 'General'},
            usage = ${typeof body.usage === 'string' ? body.usage : ''},
            owner_only = ${!!body.ownerOnly},
            admin_only = ${!!body.adminOnly},
            group_only = ${!!body.groupOnly},
            enabled = ${body.enabled !== false},
            code = ${body.code},
            updated_at = CURRENT_TIMESTAMP
          WHERE name = ${name}
          RETURNING id, name, enabled
        `
      : await sql`
          UPDATE bot_commands SET
            aliases = ${JSON.stringify(Array.isArray(body.aliases) ? body.aliases : [])}::jsonb,
            description = ${typeof body.description === 'string' ? body.description : ''},
            category = ${typeof body.category === 'string' && body.category ? body.category : 'General'},
            usage = ${typeof body.usage === 'string' ? body.usage : ''},
            owner_only = ${!!body.ownerOnly},
            admin_only = ${!!body.adminOnly},
            group_only = ${!!body.groupOnly},
            enabled = ${body.enabled !== false},
            updated_at = CURRENT_TIMESTAMP
          WHERE name = ${name}
          RETURNING id, name, enabled
        `;
    if (!upd.length) return NextResponse.json({ error: 'Command not found' }, { status: 404 });

    // Push the change to the running bot immediately (~15s).
    await requestBotCommandSync();

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
    const del = await sql`DELETE FROM bot_commands WHERE name = ${params.name} RETURNING id`;
    if (!del.length) return NextResponse.json({ error: 'Command not found' }, { status: 404 });

    // Push the change to the running bot immediately (~15s).
    await requestBotCommandSync();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Admin bot-commands delete error:', error);
    return NextResponse.json({ error: 'Failed to delete command' }, { status: 500 });
  }
}
