// MZAZI API — /api/admin/panel
// Admin: manage Pterodactyl panel users + servers.
//   GET  ?action=users              → list panel users
//   GET  ?action=servers&user_id=N  → list that user's servers
//   POST { action:'delete', user_id, server_ids:[], delete_user:true|false }
//        → delete the selected servers first, then (optionally) the user —
//          Pterodactyl refuses to delete a user who still has servers.
// Panel credentials come from the shared `settings` table (Settings page)
// with env fallback — the same precedence the bot uses.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { ensureDatabase } from '@/lib/database';

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

async function pteroConfig() {
  let url = process.env.PTERODACTYL_URL || 'https://public.mzazi.shop';
  let key = process.env.PTERODACTYL_API_KEY || '';
  try {
    const rows = await sql`SELECT key, value FROM settings WHERE key = ANY(${['pterodactyl_url', 'pterodactyl_api_key']})`;
    for (const r of rows) {
      if (r.key === 'pterodactyl_url' && r.value) url = r.value;
      if (r.key === 'pterodactyl_api_key' && r.value) key = r.value;
    }
  } catch {}
  return { url: String(url).replace(/\/+$/, ''), key };
}

async function pteroFetch(path, method = 'GET', body = null) {
  const { url, key } = await pteroConfig();
  if (!key) throw new Error('Pterodactyl API key not configured — add it on the Settings page');
  const res = await fetch(`${url}/api/application${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

function pteroErr(data) {
  if (!data) return 'Unknown Pterodactyl error';
  if (Array.isArray(data.errors) && data.errors[0]?.detail) return data.errors[0].detail;
  return data.error || JSON.stringify(data).slice(0, 200);
}

export async function GET(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  try {
    if (action === 'users') {
      const r = await pteroFetch('/users?per_page=100');
      if (r.status !== 200) return NextResponse.json({ error: pteroErr(r.data) }, { status: 502 });
      return NextResponse.json({
        users: (r.data?.data || []).map((u) => {
          const a = u.attributes || {};
          return {
            id: a.id,
            username: a.username,
            first_name: a.first_name,
            last_name: a.last_name,
            email: a.email,
            root_admin: !!a.root_admin,
          };
        }),
      });
    }
    if (action === 'servers') {
      const uid = searchParams.get('user_id');
      if (!uid) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
      const r = await pteroFetch(`/users/${uid}/servers?per_page=100`);
      if (r.status !== 200) return NextResponse.json({ error: pteroErr(r.data) }, { status: 502 });
      return NextResponse.json({
        servers: (r.data?.data || []).map((s) => {
          const a = s.attributes || {};
          const node = a.node?.attributes || {};
          return {
            id: a.id,
            name: a.name,
            node: node.name || null,
            limits: a.limits || null,
          };
        }),
      });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Panel API error' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const body = await request.json();
    if (body.action !== 'delete' || !body.user_id) {
      return NextResponse.json({ error: 'action=delete + user_id required' }, { status: 400 });
    }
    const userId = parseInt(body.user_id, 10);
    const serverIds = (Array.isArray(body.server_ids) ? body.server_ids : [])
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    const deleteUser = body.delete_user !== false;

    // 1) Delete the selected servers first.
    const deletedServers = [];
    const failedServers = [];
    for (const sid of serverIds) {
      const r = await pteroFetch(`/servers/${sid}`, 'DELETE');
      if (r.status === 204 || r.status === 200) deletedServers.push(sid);
      else failedServers.push({ id: sid, error: pteroErr(r.data) });
    }

    // 2) Delete the user (only if every selected server was removed —
    //    the panel rejects deleting a user who still has servers).
    let userDeleted = false;
    if (deleteUser && failedServers.length === 0) {
      const r = await pteroFetch(`/users/${userId}`, 'DELETE');
      if (r.status === 204 || r.status === 200) userDeleted = true;
      else {
        return NextResponse.json(
          { error: pteroErr(r.data) || 'Failed to delete user', deletedServers, failedServers, userDeleted },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ ok: true, deletedServers, failedServers, userDeleted });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: 500 });
  }
}
