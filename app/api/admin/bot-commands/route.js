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
// A command's bot. '' is the column default and means "the primary bot" — the
// behaviour every admin-created command had before bot profiles existed. It is
// deliberately NOT treated as "all bots": an edit aimed at one bot must never
// be able to touch another bot's row of the same name.
const PROFILE_RE = /^[A-Za-z0-9_-]{0,64}$/;

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

/**
 * The id of the primary bot profile — the first entry of the `bot_profiles`
 * setting, which is the same rule the bots use (`profiles.primary()`).
 * Defaults to 'quartz', matching every deployment that predates profiles.
 */
async function primaryProfileId() {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'bot_profiles'`;
    const parsed = JSON.parse(rows[0]?.value || '');
    if (Array.isArray(parsed) && parsed.length && parsed[0]?.id) return String(parsed[0].id);
  } catch {
    // Unset or unparseable means a single bot; both bots treat that as primary.
  }
  return 'quartz';
}

export async function GET(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').toLowerCase();
    const category = searchParams.get('category') || '';
    // ?profile= — absent or 'all' means no filter (today's behaviour); '' means
    // rows with no profile (the legacy/primary bot); anything else that bot.
    const profileParam = searchParams.get('profile');
    const filterProfile = profileParam !== null && profileParam !== 'all' ? profileParam : null;

    const rows = await sql`
      SELECT id, name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, profile, updated_at
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
      profile: r.profile || '',
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
    // A row with an empty profile predates bot profiles and belongs to the
    // PRIMARY bot — that is the rule the bots themselves apply (see
    // quartz/lib/remoteCommands.js `inProfile`, which resolves an empty profile
    // to profiles.primary().id). So selecting the primary bot must also return
    // those rows, or they show a QUARTZ XD badge and then disappear the moment
    // you filter by QUARTZ XD.
    if (filterProfile !== null) {
      const primary = await primaryProfileId();
      list = list.filter((c) => {
        const p = c.profile || '';
        return p === filterProfile || (p === '' && filterProfile === primary);
      });
    }

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

    // Absent profile means '' — the primary bot — exactly as before profiles
    // existed. It never means "all bots".
    const profile = typeof body.profile === 'string' ? body.profile : '';
    if (!PROFILE_RE.test(profile)) {
      return NextResponse.json({ error: 'Invalid profile — use a-z, A-Z, 0-9, _ or - (max 64 chars)' }, { status: 400 });
    }

    // Duplicate names are only a clash WITHIN a bot; another bot may own the
    // same command name.
    const exists = await sql`SELECT 1 FROM bot_commands WHERE name = ${body.name} AND profile = ${profile}`;
    if (exists.length) return NextResponse.json({ error: 'A command with this name already exists for this bot' }, { status: 409 });

    const ins = await sql`
      INSERT INTO bot_commands (name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code, profile)
      VALUES (${body.name}, ${JSON.stringify(body.aliases || [])}::jsonb, ${body.description || ''}, ${body.category || 'General'},
              ${body.usage || ''}, ${!!body.ownerOnly}, ${!!body.adminOnly}, ${!!body.groupOnly},
              ${body.enabled !== false}, ${body.code}, ${profile})
      RETURNING id, name, enabled, profile
    `;

    // Push the change to the running bot immediately (~15s). Targeting the
    // profile means only that bot is woken — not whichever bot polls first.
    await requestBotCommandSync(profile);

    return NextResponse.json({ ok: true, command: ins[0] }, { status: 201 });
  } catch (error) {
    console.error('Admin bot-commands create error:', error);
    return NextResponse.json({ error: 'Failed to create command' }, { status: 500 });
  }
}
