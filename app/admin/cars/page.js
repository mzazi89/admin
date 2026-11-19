'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MZAZI ADMIN — Golden Lion Motors stock.
//
// The showroom on the customer site is server-rendered from the `cars` table;
// this page is the only thing that writes to it. One list, one editor, and a
// publish switch that does not need the whole form to be resubmitted.
//
// Photos are compressed in the browser before upload (1600 px, JPEG) for the same
// reason chat photos are: the server caps a decoded image at 1.8 MB and a phone
// photo is three times that.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtKes } from '@/lib/currency';
import {
  Alert, Badge, Button, Card, DataTable, EmptyState, ErrorState, Field, Input,
  Modal, PageHeader, Select, Skeleton, Textarea, Toggle, humaniseError, useToast, Icons,
} from '@/components/ui';

const BODY_TYPES = ['Pickup', 'Light Truck', 'Heavy Truck', 'Van', 'Bus', 'SUV', 'Tractor'];
const CONDITIONS = ['Brand new', 'Foreign used', 'Locally used', 'Refurbished'];
const FUELS = ['Diesel', 'Petrol', 'Electric', 'Hybrid'];
const TRANSMISSIONS = ['Manual', 'Automatic'];
const STATUS_TONE = { published: 'good', draft: 'warn', sold: 'bad' };

const blank = () => ({
  title: '', model: '', body: 'Pickup', year: new Date().getFullYear(), price_kes: '',
  negotiable: true, mileage_km: '', fuel: 'Diesel', transmission: 'Manual', drive: '4x2',
  engine: '', seats: '', payload_kg: '', color: '', condition: 'Brand new',
  description: '', features: '', status: 'draft', featured: false,
});

/** 1600 px, JPEG — a 4 MB camera photo lands around 300 KB. */
async function compress(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('That file is not an image'));
    el.src = dataUrl;
  });

  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.84);
}

export default function AdminCars() {
  const router = useRouter();
  const toast = useToast();

  const [cars, setCars] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);      // the car being edited
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(0);
  const fileRef = useRef(null);

  const load = useCallback(async (status = filter, term = q) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/cars?status=${status}&q=${encodeURIComponent(term)}`, { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not load the stock list');
      setCars(d.cars || []);
      setCounts(d.counts || {});
    } catch (e) {
      setError(humaniseError(e, 'We could not load the stock list.'));
    } finally {
      setLoading(false);
    }
  }, [filter, q]);

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => load(filter, q), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const openNew = () => setEditing(blank());

  const openEdit = async (id) => {
    try {
      const res = await fetch(`/api/admin/cars/${id}`, { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not open that vehicle');
      setEditing({ ...d.car, features: (d.car.features || []).join('\n'), images: d.car.images || [] });
    } catch (e) {
      toast.error(humaniseError(e, 'Could not open that vehicle'));
    }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = { ...editing, features: String(editing.features || '').split('\n').filter((f) => f.trim()) };
      const res = await fetch(
        editing.id ? `/api/admin/cars/${editing.id}` : '/api/admin/cars',
        {
          method: editing.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save that vehicle');

      // A brand-new listing stays open so photos can be added straight away.
      if (!editing.id) {
        setEditing({ ...d.car, features: (d.car.features || []).join('\n'), images: [] });
        toast.success('Saved — now add photos');
        await load();
      } else {
        setEditing(null);
        toast.success('Vehicle saved');
        await load();
      }
    } catch (e) {
      toast.error(humaniseError(e, 'Could not save that vehicle'));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (car, status) => {
    setBusyId(car.id);
    try {
      const res = await fetch(`/api/admin/cars/${car.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', status }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not update that vehicle');
      toast.success(status === 'published' ? 'Published to the showroom' : status === 'sold' ? 'Marked as sold' : 'Moved back to draft');
      await load();
    } catch (e) {
      toast.error(humaniseError(e, 'Could not update that vehicle'));
    } finally {
      setBusyId(0);
    }
  };

  const remove = async (car) => {
    if (!window.confirm(`Delete “${car.title}”? Its photos go too.`)) return;
    setBusyId(car.id);
    try {
      const res = await fetch(`/api/admin/cars/${car.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete that vehicle');
      toast.success('Vehicle deleted');
      await load();
    } catch (e) {
      toast.error(humaniseError(e, 'Could not delete that vehicle'));
    } finally {
      setBusyId(0);
    }
  };

  const uploadPhotos = async (files) => {
    if (!editing?.id || !files?.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const data = await compress(file);
        const res = await fetch(`/api/admin/cars/${editing.id}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Could not save a photo');
      }
      const fresh = await fetch(`/api/admin/cars/${editing.id}`, { cache: 'no-store' }).then((r) => r.json());
      setEditing((prev) => ({ ...prev, images: fresh.car?.images || [] }));
      toast.success('Photos added');
      await load();
    } catch (e) {
      toast.error(humaniseError(e, 'Could not save those photos'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async (imageId) => {
    if (!editing?.id) return;
    try {
      const res = await fetch(`/api/admin/cars/${editing.id}/images?imageId=${imageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove that photo');
      setEditing((prev) => ({ ...prev, images: (prev.images || []).filter((i) => i !== imageId) }));
      await load();
    } catch (e) {
      toast.error(humaniseError(e, 'Could not remove that photo'));
    }
  };

  const set = (key) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setEditing((prev) => ({ ...prev, [key]: value }));
  };

  const published = counts.published || 0;
  const drafts = counts.draft || 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader
        title="Car showroom"
        subtitle="Golden Lion Motors Co. · FOTON. Published vehicles appear on mzazi.shop/cars within a minute."
        actions={(
          <>
            <Button variant="ghost" icon={<Icons.Refresh size={15} />} onClick={() => load()}>Refresh</Button>
            <Button variant="primary" icon={<Icons.Plus size={15} />} onClick={openNew}>New vehicle</Button>
          </>
        )}
      />

      <Alert kind={published ? 'info' : 'warn'} title={`${published} live · ${drafts} draft`}>
        {published
          ? 'Draft listings are invisible to customers. Mark a vehicle sold when it leaves the yard — it stays on the page with a SOLD plate instead of vanishing from a link someone saved.'
          : 'Nothing is live yet. Add a vehicle, attach photos, then set it to Published.'}
      </Alert>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'published', label: 'Live' },
            { id: 'draft', label: 'Drafts' },
            { id: 'sold', label: 'Sold' },
          ].map((f) => (
            <Button key={f.id} size="sm" variant={filter === f.id ? 'primary' : 'ghost'} onClick={() => setFilter(f.id)}>
              {f.label}{f.id !== 'all' && counts[f.id] ? ` · ${counts[f.id]}` : ''}
            </Button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ width: 240 }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vehicles" aria-label="Search vehicles" />
          </div>
        </div>

        {error ? (
          <ErrorState title="Could not load the stock list" message={error} onRetry={() => load()} />
        ) : loading ? (
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} h={56} />)}
          </div>
        ) : cars.length === 0 ? (
          <EmptyState
            icon={<Icons.Car size={26} />}
            title={q ? 'Nothing matches that' : 'No vehicles yet'}
            description={q ? 'Try another search.' : 'Add the first FOTON and it will appear on the showroom page.'}
            action={<Button variant="primary" onClick={openNew}>Add a vehicle</Button>}
          />
        ) : (
          <DataTable columns={['', 'Vehicle', 'Price', 'Status', 'Photos', 'Views', '']}>
            {cars.map((c) => (
              <tr key={c.id}>
                <td data-label="" style={{ width: 64 }}>
                  <div style={{ width: 52, height: 40, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-2)', display: 'grid', placeItems: 'center' }}>
                    {c.cover_id
                      ? <img src={`/api/cars/image/${c.cover_id}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Icons.Car size={16} style={{ color: 'var(--dim)' }} />}
                  </div>
                </td>
                <td data-label="Vehicle">
                  <div style={{ fontWeight: 600 }}>{c.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>
                    {[c.year, c.body].filter(Boolean).join(' · ')} · /cars/{c.slug}
                  </div>
                </td>
                <td data-label="Price" style={{ fontWeight: 700 }}>
                  {c.price_kes ? fmtKes(Number(c.price_kes)) : <span style={{ color: 'var(--dim)', fontWeight: 500 }}>On request</span>}
                </td>
                <td data-label="Status">
                  <Badge tone={STATUS_TONE[c.status] || 'brand'}>{c.status}</Badge>
                  {c.featured && <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 2 }}>featured</div>}
                </td>
                <td data-label="Photos" className="mono" style={{ fontSize: 12.5 }}>{c.image_count}</td>
                <td data-label="Views" className="mono" style={{ fontSize: 12.5 }}>{c.views || 0}</td>
                <td data-label="">
                  <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c.id)}>Edit</Button>
                    {c.status !== 'published' && (
                      <Button size="sm" variant="primary" loading={busyId === c.id} onClick={() => setStatus(c, 'published')}>
                        Publish
                      </Button>
                    )}
                    {c.status === 'published' && (
                      <>
                        <Button size="sm" variant="ghost" loading={busyId === c.id} onClick={() => setStatus(c, 'sold')}>Sold</Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus(c, 'draft')}>Unpublish</Button>
                      </>
                    )}
                    {c.status === 'sold' && (
                      <Button size="sm" variant="ghost" loading={busyId === c.id} onClick={() => setStatus(c, 'published')}>Relist</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(c)} aria-label={`Delete ${c.title}`}>
                      <Icons.Trash size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {/* ── editor ─────────────────────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit vehicle' : 'New vehicle'}
        description={editing?.id ? 'Changes go live as soon as the listing is Published.' : 'Save once, then add photos.'}
        size="lg"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {editing?.id ? 'Save changes' : 'Create vehicle'}
            </Button>
          </>
        )}
      >
        {editing && (
          <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)' }} className="car-form">
            <div>
              <Field label="Title" required hint="What customers see first — include the model and body.">
                <Input value={editing.title} onChange={set('title')} placeholder="FOTON Tunland 4x4 Pickup" />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Model">
                  <Input value={editing.model || ''} onChange={set('model')} placeholder="Tunland" />
                </Field>
                <Field label="Body">
                  <Select value={editing.body || ''} onChange={set('body')}>
                    <option value="">—</option>
                    {BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </Field>
                <Field label="Year">
                  <Input type="number" value={editing.year || ''} onChange={set('year')} placeholder="2024" />
                </Field>
                <Field label="Condition">
                  <Select value={editing.condition || ''} onChange={set('condition')}>
                    <option value="">—</option>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Price (KES)" hint="Leave blank to show “Price on request”.">
                  <Input type="number" value={editing.price_kes || ''} onChange={set('price_kes')} placeholder="4250000" />
                </Field>
                <Field label="Mileage (km)">
                  <Input type="number" value={editing.mileage_km ?? ''} onChange={set('mileage_km')} placeholder="0" />
                </Field>
                <Field label="Engine">
                  <Input value={editing.engine || ''} onChange={set('engine')} placeholder="2.8L Turbo Diesel" />
                </Field>
                <Field label="Fuel">
                  <Select value={editing.fuel || ''} onChange={set('fuel')}>
                    <option value="">—</option>
                    {FUELS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </Select>
                </Field>
                <Field label="Transmission">
                  <Select value={editing.transmission || ''} onChange={set('transmission')}>
                    <option value="">—</option>
                    {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Drive">
                  <Input value={editing.drive || ''} onChange={set('drive')} placeholder="4x4" />
                </Field>
                <Field label="Seats">
                  <Input type="number" value={editing.seats || ''} onChange={set('seats')} placeholder="5" />
                </Field>
                <Field label="Payload (kg)">
                  <Input type="number" value={editing.payload_kg || ''} onChange={set('payload_kg')} placeholder="1000" />
                </Field>
                <Field label="Colour">
                  <Input value={editing.color || ''} onChange={set('color')} placeholder="Silver" />
                </Field>
              </div>

              <Field label="Description" hint="Condition, service history, what it is good for.">
                <Textarea rows={5} value={editing.description || ''} onChange={set('description')} />
              </Field>

              <Field label="Features" hint="One per line.">
                <Textarea rows={4} value={editing.features || ''} onChange={set('features')} placeholder={'Air conditioning\nReverse camera\nABS'} />
              </Field>
            </div>

            <div>
              <Field label="Photos" hint="First photo is the cover. Up to 8, compressed automatically.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(editing.images || []).map((imageId, i) => (
                    <div key={imageId} style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
                      <img src={`/api/cars/image/${imageId}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {i === 0 && (
                        <span style={{ position: 'absolute', left: 4, bottom: 4, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', background: 'rgba(10,10,12,0.75)', color: '#F5F1E5', padding: '2px 5px', borderRadius: 3 }}>
                          COVER
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(imageId)}
                        aria-label="Remove photo"
                        style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(10,10,12,0.72)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                      >
                        <Icons.X size={12} />
                      </button>
                    </div>
                  ))}

                  {editing.id ? (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      style={{
                        aspectRatio: '4 / 3', borderRadius: 8, border: '1px dashed var(--line)',
                        background: 'var(--bg-2)', color: 'var(--dim)', display: 'grid', placeItems: 'center',
                        cursor: uploading ? 'default' : 'pointer', gap: 4,
                      }}
                    >
                      <Icons.Upload size={16} />
                      <span style={{ fontSize: 10.5 }}>{uploading ? 'Uploading…' : 'Add photos'}</span>
                    </button>
                  ) : (
                    <div style={{ aspectRatio: '4 / 3', borderRadius: 8, border: '1px dashed var(--line)', display: 'grid', placeItems: 'center', color: 'var(--dim)', fontSize: 10.5, textAlign: 'center', padding: 8 }}>
                      Save first, then add photos
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => uploadPhotos(Array.from(e.target.files || []))}
                />
              </Field>

              <Field label="Visibility">
                <Select value={editing.status} onChange={set('status')}>
                  <option value="draft">Draft — hidden</option>
                  <option value="published">Published — live</option>
                  <option value="sold">Sold — visible with a SOLD plate</option>
                </Select>
              </Field>

              <Toggle
                checked={!!editing.featured}
                onChange={(v) => setEditing((prev) => ({ ...prev, featured: v }))}
                label="Featured"
                description="Pinned to the top of the showroom."
              />
              <Toggle
                checked={editing.negotiable !== false}
                onChange={(v) => setEditing((prev) => ({ ...prev, negotiable: v }))}
                label="Price negotiable"
                description="Shows “negotiable” beside the price."
              />

              {editing.updated_at && (
                <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8 }}>
                  Last saved {new Date(editing.updated_at).toLocaleString('en-KE')}
                </p>
              )}
            </div>

            <style>{`
              @media (max-width: 860px) { .car-form { grid-template-columns: minmax(0, 1fr) !important; } }
            `}</style>
          </div>
        )}
      </Modal>
    </div>
  );
}
