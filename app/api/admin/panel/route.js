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
import { ensureDatabase } from '@/lib/database';
import { parseWantedId } from '@/lib/panelSelection';
import { resolvePanel } from '@/lib/pterodactylPanels';

export const dynamic = 'force-dynamic';

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

// Which panel this request acts on.
//
// No panel_id means the default panel; a panel_id that does not exist is an error
// and never a quiet fallback to another one. This route deletes users and servers,
// so acting on a different host than the admin was looking at is the one mistake
// with no undo — see admin/lib/panelSelection.js.
async function pteroConfig(panelId = null) {
  const panel = await resolvePanel(panelId);
  return { url: panel.url, key: panel.key, panel };
}

async function pteroFetch(path, method = 'GET', body = null, panelId = null) {
  const { url, key, panel } = await pteroConfig(panelId);
  if (!key) throw new Error('Pterodactyl API key not configured — add a panel on the Settings page');
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
  // `panel` travels back with every response so the page can show which panel the
  // answer came from — with several configured, the same username can exist on two
  // of them and the reply would otherwise be ambiguous.
  return { status: res.status, data, panel };
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

  // A panel_id that is present but unusable must be refused outright: guessing here
  // would mean listing — and then deleting — on a panel nobody asked for.
  const wanted = parseWantedId(searchParams.get('panel_id'));
  if (!wanted.ok) {
    return NextResponse.json({ error: 'panel_id must be a positive whole number.' }, { status: 400 });
  }

  try {
    if (action === 'users') {
      const r = await pteroFetch('/users?per_page=100', 'GET', null, wanted.id);
      if (r.status !== 200) return NextResponse.json({ error: pteroErr(r.data) }, { status: 502 });
      return NextResponse.json({
        panel: r.panel,
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
      const uid = parseInt(searchParams.get('user_id'), 10);
      if (!Number.isInteger(uid) || uid <= 0) {
        return NextResponse.json({ error: 'invalid user_id' }, { status: 400 });
      }
      // Fetch ALL servers (paginated) and filter by owner id. The dedicated
      // /users/{id}/servers endpoint returns empty on some Pterodactyl
      // versions even when the user has servers, which made "delete user"
      // wrongly assume there were none.
      const servers = [];
      let page = 1;
      let totalPages = 1;
      let panelInfo = null;
      while (page <= totalPages && page <= 50) {
        const r = await pteroFetch(`/servers?per_page=100&page=${page}`, 'GET', null, wanted.id);
        panelInfo = r.panel;
        if (r.status !== 200) return NextResponse.json({ error: pteroErr(r.data) }, { status: 502 });
        for (const s of r.data?.data || []) {
          const a = s.attributes || {};
          if (parseInt(a.user, 10) === uid) {
            const node = a.node?.attributes || {};
            servers.push({
              id: a.id,
              name: a.name,
              node: node.name || null,
              limits: a.limits || null,
            });
          }
        }
        totalPages = r.data?.meta?.pagination?.total_pages || 1;
        page += 1;
      }
      return NextResponse.json({ servers, panel: panelInfo });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    // resolvePanel marks a missing panel as 404 so a stale page reads as "reload",
    // not as "the panel is broken".
    return NextResponse.json({ error: e.message || 'Panel API error' }, { status: e.status || 500 });
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

    // Deletes go to the panel the admin was looking at. A malformed or unknown id
    // is refused rather than defaulted: the wrong panel here is unrecoverable.
    const wanted = parseWantedId(body.panel_id);
    if (!wanted.ok) {
      return NextResponse.json({ error: 'panel_id must be a positive whole number.' }, { status: 400 });
    }

    // 1) Delete the selected servers first.
    const deletedServers = [];
    const failedServers = [];
    for (const sid of serverIds) {
      const r = await pteroFetch(`/servers/${sid}`, 'DELETE', null, wanted.id);
      if (r.status === 204 || r.status === 200) deletedServers.push(sid);
      else failedServers.push({ id: sid, error: pteroErr(r.data) });
    }

    // 2) Delete the user (only if every selected server was removed —
    //    the panel rejects deleting a user who still has servers).
    let userDeleted = false;
    if (deleteUser && failedServers.length === 0) {
      const r = await pteroFetch(`/users/${userId}`, 'DELETE', null, wanted.id);
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
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: e.status || 500 });
  }
}
