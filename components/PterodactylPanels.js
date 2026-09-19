'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Field, Input, Skeleton, humaniseError, useToast, Icons } from '@/components/ui';

// The Pterodactyl panels this site can work with.
//
// Self-contained on purpose: it loads and saves through its own endpoint rather
// than through the Settings page's form. The page's own "Save settings" writes the
// whole settings table at once, and a panel living in that form would be wiped by
// an unrelated save — or worse, saved with the value the page happened to be
// holding. Panels have their own table (pterodactyl_panels), so they get their own
// load/save path.
//
// The stored API key is never sent to this component. Editing a panel therefore
// shows a masked hint and an empty key field, and leaving that field alone keeps
// the existing key — see updatePanel on the server.

function emptyDraft() {
  return { id: null, name: '', url: '', api_key: '', is_default: false };
}

export default function PterodactylPanels() {
  const toast = useToast();
  const [panels, setPanels] = useState([]);
  const [legacy, setLegacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null); // null = the add/edit form is closed
  const [tested, setTested] = useState({}); // id -> { ok, message }

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pterodactyl/panels');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || 'Could not load the panels.');
      } else {
        setPanels(d.panels || []);
        setLegacy(d.legacy || null);
      }
    } catch (e) {
      setError(humaniseError(e, 'Could not load the panels.'));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const send = async (payload) => {
    const res = await fetch('/api/admin/pterodactyl/panels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'The request failed.');
    if (Array.isArray(d.panels)) setPanels(d.panels);
    return d;
  };

  const withBusy = async (tag, fn) => {
    setBusy(tag);
    setError('');
    try {
      return await fn();
    } catch (e) {
      setError(e.message || 'The request failed.');
      return null;
    } finally {
      setBusy('');
    }
  };

  const submitDraft = () =>
    withBusy('save', async () => {
      const isEdit = !!draft.id;
      await send({
        action: isEdit ? 'update' : 'create',
        id: draft.id,
        name: draft.name,
        url: draft.url,
        // On an edit an empty field means "leave the key as it is", which the
        // server honours. On create an empty key is allowed too — the panel can be
        // stored now and given a key when it is known.
        api_key: draft.api_key,
        is_default: draft.is_default,
      });
      setDraft(null);
      toast.success(isEdit ? 'Panel updated.' : 'Panel added.');
    });

  const remove = (panel) =>
    withBusy(`del:${panel.id}`, async () => {
      const others = panels.filter((p) => p.id !== panel.id).length;
      const warn = others === 0
        ? `\n\nThis is the last panel. With none left, the panel page falls back to the Pterodactyl URL and key stored on the Settings page.`
        : panel.is_default
        ? `\n\nThe remaining panel will become the default.`
        : '';
      if (!window.confirm(`Delete the panel “${panel.name}”?${warn}`)) return;
      await send({ action: 'delete', id: panel.id });
      toast.success(`Panel “${panel.name}” deleted.`);
    });

  const makeDefault = (panel) =>
    withBusy(`def:${panel.id}`, async () => {
      await send({ action: 'set_default', id: panel.id });
      toast.success(`“${panel.name}” is now the default panel.`);
    });

  const runTest = (panel) =>
    withBusy(`test:${panel.id}`, async () => {
      const d = await send({ action: 'test', id: panel.id });
      setTested((prev) => ({
        ...prev,
        [panel.id]: d.ok
          ? { ok: true, message: `Reachable — the key works on ${d.name}.` }
          : { ok: false, message: d.error || 'The panel did not answer.' },
      }));
    });

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div>
          <div className="label" style={{ marginBottom: 2 }}>Pterodactyl panels</div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)', maxWidth: 520 }}>
            Add as many panels as you use. The default is the one the bot creates new
            servers on, and the one the panel page opens on. Keys are stored on the
            server and never sent back to this page.
          </p>
        </div>
        {!draft && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Icons.Plus size={15} />}
            onClick={() => setDraft(emptyDraft())}
            style={{ flexShrink: 0 }}
          >
            Add panel
          </Button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 10 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Skeleton h={54} />
          <Skeleton h={54} />
        </div>
      ) : panels.length === 0 ? (
        <Alert kind="info">
          No panels are configured yet. The panel page and the bot are currently using the
          Pterodactyl URL and key saved below
          {legacy?.url ? ` (${legacy.url})` : ''}
          {legacy && !legacy.hasKey ? ', which has no API key set' : ''}.
          Add a panel above and it takes over from there.
        </Alert>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {panels.map((p) => (
            <div
              key={p.id}
              className="tag"
              style={{ display: 'block', width: '100%', padding: '12px 14px', textTransform: 'none', letterSpacing: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 13.5, color: 'var(--ink)' }}>{p.name}</span>
                    {p.is_default && <Badge tone="brand">DEFAULT</Badge>}
                    {!p.hasKey && <Badge tone="warn">NO KEY</Badge>}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, wordBreak: 'break-all' }}>
                    {p.url}
                    {p.keyHint ? ` · key ${p.keyHint}` : ''}
                  </div>
                  {tested[p.id] && (
                    <div
                      className="mono"
                      style={{ fontSize: 12, marginTop: 5, color: tested[p.id].ok ? 'var(--good)' : 'var(--bad)' }}
                    >
                      {tested[p.id].ok ? '✅ ' : '❌ '}{tested[p.id].message}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  <Button variant="ghost" size="sm" loading={busy === `test:${p.id}`} onClick={() => runTest(p)}>
                    Test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDraft({ id: p.id, name: p.name, url: p.url, api_key: '', is_default: p.is_default })}>
                    Edit
                  </Button>
                  {!p.is_default && (
                    <Button variant="ghost" size="sm" loading={busy === `def:${p.id}`} onClick={() => makeDefault(p)}>
                      Make default
                    </Button>
                  )}
                  <Button variant="danger" size="sm" loading={busy === `del:${p.id}`} onClick={() => remove(p)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="tag" style={{ display: 'block', width: '100%', padding: '14px', marginTop: 10, textTransform: 'none', letterSpacing: 0 }}>
          <div className="label" style={{ marginBottom: 8 }}>
            {draft.id ? 'Edit panel' : 'New panel'}
          </div>
          <Field label="Name" id="pp-name" hint="Shown in the panel dropdown and on the panel page.">
            <Input
              id="pp-name"
              value={draft.name}
              placeholder="Primary panel"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <Field label="Panel URL" id="pp-url" hint="The panel's own address, for example https://panel.example.com">
            <Input
              id="pp-url"
              value={draft.url}
              placeholder="https://panel.example.com"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            />
          </Field>
          <Field
            label="Application API key"
            id="pp-key"
            hint={
              draft.id
                ? 'Leave this empty to keep the key that is already stored.'
                : 'Create one in the panel under Admin → Application API, with the users and servers permissions.'
            }
          >
            <Input
              id="pp-key"
              type="password"
              autoComplete="off"
              value={draft.api_key}
              placeholder={draft.id ? 'Unchanged' : 'ptla_…'}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              onChange={(e) => setDraft((d) => ({ ...d, api_key: e.target.value }))}
            />
          </Field>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '4px 0 14px', fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!draft.is_default}
              onChange={(e) => setDraft((d) => ({ ...d, is_default: e.target.checked }))}
              style={{ accentColor: 'var(--brand)' }}
            />
            Use this as the default panel
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" size="sm" loading={busy === 'save'} loadingText="Saving…" onClick={submitDraft}>
              {draft.id ? 'Save changes' : 'Add panel'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
