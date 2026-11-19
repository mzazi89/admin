import { adminJwtSecret } from '@/lib/authSecret';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { addImage, removeImage, MAX_IMAGE_BYTES } from '@/lib/cars';

export const dynamic = 'force-dynamic';

async function verifyAdmin() {
  try {
    const store = await cookies();
    const token = store.get('admin_token');
    if (!token) return null;
    return jwt.verify(token.value, adminJwtSecret());
  } catch { return null; }
}

// MZAZI ADMIN — photos for a vehicle.
//   POST   { data: 'data:image/jpeg;base64,…' }   one photo, appended
//   DELETE ?imageId=123                            one photo, gone
//
// The type comes from the file's first bytes, never from the label in front of the
// comma: a `data:image/png` prefix on an HTML file would otherwise be stored and
// then served from the customer site's own origin.
const SIGNATURES = [
  { mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: 'image/webp',
    test: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export async function POST(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const raw = String(body.data || '');
    const comma = raw.indexOf(',');
    const encoded = raw.startsWith('data:') && comma !== -1 ? raw.slice(comma + 1) : raw;
    const clean = encoded.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
      return NextResponse.json({ error: 'That file could not be read' }, { status: 400 });
    }

    const bytes = Buffer.from(clean, 'base64');
    if (!bytes.length) return NextResponse.json({ error: 'That file is empty' }, { status: 400 });
    if (bytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'That photo is too large — keep it under 1.8 MB' }, { status: 413 });
    }

    const type = SIGNATURES.find((s) => s.test(bytes));
    if (!type) return NextResponse.json({ error: 'Use a JPG, PNG or WebP photo' }, { status: 415 });

    const image = await addImage(Number(id), {
      mime: type.mime,
      bytes: bytes.toString('base64'),
      size: bytes.length,
    });
    return NextResponse.json({ image });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not save that photo' }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const imageId = Number(searchParams.get('imageId'));
  if (!imageId) return NextResponse.json({ error: 'Missing photo id' }, { status: 400 });

  try {
    await removeImage(Number(id), imageId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/car images] DELETE', e?.message || e);
    return NextResponse.json({ error: 'Could not remove that photo' }, { status: 500 });
  }
}
