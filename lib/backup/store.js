// MZAZI ADMIN — the inbuilt backup store.
//
// Objects live in Vercel Blob under `backups/`, which is the only durable
// storage this deployment can reach without adding another account: the admin
// runs on Vercel, where the filesystem is thrown away between invocations, so a
// SQLite file or a directory on disk would look like it worked and then silently
// lose everything on the next cold start.
//
// The store holds two kinds of object:
//   backups/<iso>-<id>.mzab     an encrypted, gzipped NDJSON snapshot
//   backups/manifest.json       index of snapshots — counts, sizes, timestamps
//
// The manifest is deliberately NOT encrypted: it contains no rows, only table
// names and counts, and the admin UI has to be able to show the archive without
// first fetching and decrypting a 20 MB object.

import { put, list, del } from '@vercel/blob';

const PREFIX = 'backups/';
export const MANIFEST_PATH = `${PREFIX}manifest.json`;

/** Blob needs a read/write token; without it the feature is inert, not broken. */
export function storeReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function putObject(path, body, contentType = 'application/octet-stream') {
  return put(path, body, {
    access: 'public',
    contentType,
    // Snapshot names are already unique; a random suffix would only make the
    // manifest's links harder to read.
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function readManifest() {
  if (!storeReady()) return { snapshots: [] };
  try {
    const { blobs } = await list({ prefix: MANIFEST_PATH, limit: 1 });
    if (!blobs.length) return { snapshots: [] };
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return { snapshots: [] };
    const data = await res.json();
    return Array.isArray(data.snapshots) ? data : { snapshots: [] };
  } catch {
    return { snapshots: [] };
  }
}

export async function writeManifest(manifest) {
  return putObject(MANIFEST_PATH, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');
}

export async function listSnapshots() {
  if (!storeReady()) return [];
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  return blobs
    .filter((b) => b.pathname !== MANIFEST_PATH && /\.mzab$/.test(b.pathname))
    .sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)));
}

export async function deleteObject(url) {
  try {
    await del(url);
    return true;
  } catch {
    return false;
  }
}

/** Fetch an encrypted snapshot object back out of the store. */
export async function fetchObject(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not read the snapshot (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
