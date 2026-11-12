// MZAZI ADMIN — the inbuilt backup store, backend-agnostic.
//
// Two backends, same contract, chosen by configuration:
//
//   BACKUP_REPO + GITHUB_TOKEN   → a git repository (default)
//   BLOB_READ_WRITE_TOKEN        → Vercel Blob
//
// The repository is the default because it needs nothing a Vercel project does
// not already have: a token that can write, and a private repo. Every snapshot is
// a commit, so the archive carries its own history, and there is no second
// account to keep alive.
//
// Both stores hold the same two kinds of object:
//   backups/<stamp>.mzab     an encrypted, gzipped NDJSON snapshot
//   backups/manifest.json    index of snapshots — counts, sizes, timestamps
//
// The manifest is deliberately NOT encrypted: it holds table names and counts and
// nothing else, and the console has to show the archive without first downloading
// and decrypting a multi-megabyte object.

import * as blob from './store-blob';
import * as github from './store-github';

export const MANIFEST_PATH = 'backups/manifest.json';

const BACKENDS = { github, blob };

/** The configured backend, or null when the archive has nowhere to write. */
export function backend() {
  if (github.ready()) return github;
  if (blob.ready()) return blob;
  return null;
}

/** Blob needs a token, git needs a repo and a token; without either, inert. */
export function storeReady() {
  return Boolean(backend());
}

/** What the console shows: which store is in use, and where it points. */
export function backendInfo() {
  const b = backend();
  if (!b) {
    return {
      kind: null,
      ready: false,
      target: null,
      hint: 'Set BACKUP_REPO (owner/name) with GITHUB_TOKEN, or connect a Vercel Blob store.',
    };
  }
  return { kind: b.KIND, ready: true, target: b.target() };
}

function requireBackend() {
  const b = backend();
  if (!b) {
    throw new Error(
      'No backup store configured. Set BACKUP_REPO to a private repository (with GITHUB_TOKEN), or connect a Vercel Blob store.'
    );
  }
  return b;
}

export async function putObject(path, body, contentType) {
  return requireBackend().putObject(path, body, contentType);
}

export async function fetchObject(object) {
  return requireBackend().fetchObject(object);
}

export async function deleteObject(object) {
  return requireBackend().deleteObject(object);
}

/** Every snapshot object in the store, newest first. */
export async function listSnapshots() {
  const b = backend();
  if (!b) return [];
  const objects = await b.listObjects('backups/');
  return objects
    .filter(
      (o) =>
        o.pathname !== MANIFEST_PATH &&
        /\.mzab$/.test(o.pathname) &&
        !/\.part\d+$/.test(o.pathname)
    )
    .sort((a, b2) => String(b2.pathname).localeCompare(String(a.pathname)));
}

export async function readManifest() {
  const b = backend();
  if (!b) return { snapshots: [] };
  try {
    const text = await b.readText(MANIFEST_PATH);
    if (!text) return { snapshots: [] };
    const data = JSON.parse(text);
    return Array.isArray(data.snapshots) ? data : { snapshots: [] };
  } catch {
    // A missing or unreadable manifest must not take the console down — the
    // snapshots themselves are still listed from the store.
    return { snapshots: [] };
  }
}

export async function writeManifest(manifest) {
  const b = requireBackend();
  return b.writeText(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'backup: manifest');
}
