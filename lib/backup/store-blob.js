// MZAZI ADMIN — the archive, stored in Vercel Blob.
//
// Kept as an alternative to the git backend: Blob suits archives too large for a
// repository, and it needs no repository at all. Pick it by setting
// BLOB_READ_WRITE_TOKEN and leaving BACKUP_REPO unset — see store.js for how the
// backend is chosen.
//
// Objects here are public-by-URL; the payload is sealed before it is uploaded,
// so what a URL exposes is ciphertext.

import { put, list, del } from '@vercel/blob';

const PREFIX = 'backups/';

export const KIND = 'blob';

export function ready() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function target() {
  return process.env.BLOB_WEBHOOK || 'Vercel Blob';
}

export async function putObject(path, body, contentType = 'application/octet-stream') {
  return put(path, body, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function fetchObject(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not read the snapshot (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteObject(url) {
  try {
    await del(url);
    return true;
  } catch {
    return false;
  }
}

export async function listObjects(prefix = PREFIX) {
  const { blobs } = await list({ prefix, limit: 1000 });
  return blobs.map((b) => ({ pathname: b.pathname, url: b.url }));
}

export async function readText(path) {
  const found = await listObjects(path);
  const hit = found.find((b) => b.pathname === path);
  if (!hit) return null;
  const buf = await fetchObject(hit.url);
  return buf.toString('utf8');
}

export async function writeText(path, text) {
  return putObject(path, Buffer.from(text, 'utf8'), 'application/json');
}
