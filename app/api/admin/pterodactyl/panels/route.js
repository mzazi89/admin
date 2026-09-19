// MZAZI API — /api/admin/pterodactyl/panels
// Admin: the list of Pterodactyl panels the site can work with.
//   GET  → every panel, with the API key masked
//   POST { action } where action is one of:
//          create      { name, url, api_key, is_default }
//          update      { id, name, url, api_key? }   (a blank key leaves the stored one)
//          delete      { id }
//          set_default { id }
//          test        { id }                        (asks the panel if the key works)
//
// A STORED API KEY IS NEVER RETURNED. The panel page and this route are read by a
// browser, and a key that can be read back is a key that leaks through a saved
// page, a screenshot or a shared screen. Responses carry a last-4 hint instead.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { ensureDatabase } from '@/lib/database';
import { validatePanelInput } from '@/lib/panelSelection';
import {
  listPanelsMasked,
  createPanel,
  updatePanel,
  deletePanel,
  setDefault,
  testPanel,
  resolvePanel,
} from '@/lib/pterodactylPanels';

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

/** The id in a payload, as a positive integer, or null when it is not usable. */
function idOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();
  try {
    const panels = await listPanelsMasked();
    // Reported alongside the list so the page can say why it is empty and offer the
    // legacy settings as the explanation rather than looking simply broken.
    let legacy = null;
    try {
      const r = await resolvePanel(null);
      legacy = r.source === 'legacy' ? { url: r.url, hasKey: !!r.key } : null;
    } catch {}
    return NextResponse.json({ panels, legacy });
  } catch (e) {
    console.error('Panels GET error:', e.message);
    return NextResponse.json({ error: 'Failed to load panels' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureDatabase();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected a JSON object.' }, { status: 400 });
  }

  const action = String(body.action || '');
  const id = idOrNull(body.id);

  try {
    if (action === 'create') {
      const checked = validatePanelInput(body);
      if (!checked.ok) return NextResponse.json({ error: checked.errors.join(' ') }, { status: 400 });
      const created = await createPanel({
        name: checked.value.name,
        url: checked.value.url,
        apiKey: body.api_key,
        isDefault: body.is_default === true,
      });
      return NextResponse.json({ ok: true, panels: await listPanelsMasked(), created: created?.id ?? null });
    }

    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'A panel id is required.' }, { status: 400 });
      const checked = validatePanelInput(body);
      if (!checked.ok) return NextResponse.json({ error: checked.errors.join(' ') }, { status: 400 });
      const updated = await updatePanel(id, {
        name: checked.value.name,
        url: checked.value.url,
        apiKey: body.api_key,
      });
      if (!updated) return NextResponse.json({ error: 'That panel no longer exists.' }, { status: 404 });
      return NextResponse.json({ ok: true, panels: await listPanelsMasked() });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'A panel id is required.' }, { status: 400 });
      const res = await deletePanel(id);
      if (!res.deleted) return NextResponse.json({ error: 'That panel no longer exists.' }, { status: 404 });
      return NextResponse.json({ ok: true, panels: await listPanelsMasked() });
    }

    if (action === 'set_default') {
      if (!id) return NextResponse.json({ error: 'A panel id is required.' }, { status: 400 });
      const res = await setDefault(id);
      if (!res) return NextResponse.json({ error: 'That panel no longer exists.' }, { status: 404 });
      return NextResponse.json({ ok: true, panels: await listPanelsMasked() });
    }

    if (action === 'test') {
      const result = await testPanel(id);
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Panels POST error:', e.message);
    return NextResponse.json({ error: e.message || 'Panel request failed' }, { status: 500 });
  }
}
