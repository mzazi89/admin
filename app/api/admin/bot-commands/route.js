// MZAZI API — /api/admin/bot-commands
// Admin CRUD for the bot command registry (list / create).
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

function validateCommand(body) {
  if (!body || typeof body !== 'object') return 'Invalid body';
  if (typeof body.name !== 'string' || !NAME_RE.test(body.name)) {
    return 'Invalid name — use a-z, 0-9, _ or - (max 64 chars)';
  }
  if (typeof body.code !== 'string' || !body.code.trim()) return 'code is required';
  if (body.code.length > 60000) return 'code is too long (max 60000 chars)';
  if (body.aliases !== undefined && (!Array.isArray(body.aliases) || body.aliases.some((a) => typeof a !== 'string' || !NAME_RE.test(a)))) {
    return 'Invalid aliases — must be an array of a-z, 0-9, _ or - names';
  }
  return null;
}

export async function GET(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').toLowerCase();
    const category = searchParams.get('category') || '';

    const rows = await sql`
      SELECT id, name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, updated_at
      FROM bot_commands ORDER BY name ASC
    `;

    let list = rows.map((r) => ({
      id: r.id,
      name: r.name,
      aliases: Array.isArray(r.aliases) ? r.aliases : [],
      description: r.description || '',
      category: r.category || 'General',
      usage: r.usage || '',
      ownerOnly: !!r.owner_only,
      adminOnly: !!r.admin_only,
      groupOnly: !!r.group_only,
      enabled: r.enabled !== false,
      updatedAt: r.updated_at,
    }));

    if (q) {
      list = list.filter(
        (c) =>
          c.name.includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.aliases || []).some((a) => a.includes(q))
      );
    }
    if (category && category !== 'all') list = list.filter((c) => c.category === category);

    return NextResponse.json({ commands: list });
  } catch (error) {
    console.error('Admin bot-commands error:', error);
    return NextResponse.json({ error: 'Failed to fetch commands' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const body = await request.json();
    const err = validateCommand(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const exists = await sql`SELECT 1 FROM bot_commands WHERE name = ${body.name}`;
    if (exists.length) return NextResponse.json({ error: 'A command with this name already exists' }, { status: 409 });

    const ins = await sql`
      INSERT INTO bot_commands (name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code)
      VALUES (${body.name}, ${JSON.stringify(body.aliases || [])}::jsonb, ${body.description || ''}, ${body.category || 'General'},
              ${body.usage || ''}, ${!!body.ownerOnly}, ${!!body.adminOnly}, ${!!body.groupOnly},
              ${body.enabled !== false}, ${body.code})
      RETURNING id, name, enabled
    `;

    // Push the change to the running bot immediately (~15s).
    await requestBotCommandSync();

    return NextResponse.json({ ok: true, command: ins[0] }, { status: 201 });
  } catch (error) {
    console.error('Admin bot-commands create error:', error);
    return NextResponse.json({ error: 'Failed to create command' }, { status: 500 });
  }
}
