// MZAZI ADMIN — the archive, stored in a git repository.
//
// No new service, no dashboard step, and the history comes free: every snapshot
// is a commit, so a restore point is a commit you can check out, diff or blame.
// Retention keeps the working tree small, but nothing is ever truly gone — the
// object stays in the history.
//
// WHAT LANDS IN THE REPO IS CIPHERTEXT. The repo must still be private, because
// the manifest names tables and counts and a commit message names a run — but no
// account, balance or payment is readable there without the deployment key. See
// lib/backup/crypto.js.
//
// Objects are addressed as  gh://<owner>/<repo>/<branch>/<path>  so a manifest
// entry stays meaningful outside a single process, and a stored URL can be moved
// between deployments without rewriting the archive index.

const API = 'https://api.github.com';

// GitHub's contents API takes base64 in a JSON body; 8 MB per file keeps the
// request comfortably inside its limits. Larger archives are split into parts
// with a small index alongside, and reassembled on read.
const CHUNK_BYTES = 8 * 1024 * 1024;
const PARTS_SUFFIX = '.parts';

export const KIND = 'github';

export function ready() {
  return Boolean(process.env.BACKUP_REPO && process.env.GITHUB_TOKEN);
}

export function target() {
  return process.env.BACKUP_REPO || null;
}

function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN is not set');
  return t;
}

function repo() {
  const r = process.env.BACKUP_REPO || '';
  if (!/^[\w.-]+\/[\w.-]+$/.test(r)) {
    throw new Error('BACKUP_REPO must look like owner/name — e.g. mzazi89/mzazi-backups');
  }
  return r;
}

function branch() {
  return process.env.BACKUP_REPO_BRANCH || 'main';
}

async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 240) || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Metadata for a file: its blob sha, which an update has to quote. */
async function getMeta(path) {
  const data = await gh(
    `/repos/${repo()}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch())}`
  );
  if (!data || Array.isArray(data)) return null;
  return { sha: data.sha, size: data.size };
}

async function readFile(path) {
  const data = await gh(
    `/repos/${repo()}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch())}`
  );
  if (!data || Array.isArray(data)) return null;

  // The contents API inlines base64 only up to 1 MB; above that it hands back a
  // blob sha and an empty body, so read it from the blob endpoint instead.
  if (data.content) return Buffer.from(data.content, 'base64');
  const blob = await gh(`/repos/${repo()}/git/blobs/${data.sha}`);
  if (!blob?.content) return null;
  return Buffer.from(blob.content, 'base64');
}

async function putFile(path, buffer, message) {
  const existing = await getMeta(path);
  const body = {
    message,
    content: buffer.toString('base64'),
    branch: branch(),
  };
  if (existing) body.sha = existing.sha;

  try {
    return await gh(`/repos/${repo()}/contents/${encodeURI(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // A concurrent write moved the sha between read and write. Re-read once.
    if (/409|422/.test(e.message)) {
      const retry = await getMeta(path);
      if (retry) body.sha = retry.sha;
      return gh(`/repos/${repo()}/contents/${encodeURI(path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    throw e;
  }
}

async function deleteFile(path, message) {
  const meta = await getMeta(path);
  if (!meta) return false;
  await gh(`/repos/${repo()}/contents/${encodeURI(path)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha: meta.sha, branch: branch() }),
  });
  return true;
}

export function objectId(path) {
  return `gh://${repo()}/${branch()}/${path}`;
}

function pathFromObject(object) {
  const m = /^gh:\/\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(String(object || ''));
  if (!m) throw new Error('Not a repository object reference');
  if (`${m[1]}/${m[2]}` !== repo()) throw new Error('That object belongs to a different repository');
  return m[4];
}

export async function putObject(path, body /* , contentType */) {
  if (body.length <= CHUNK_BYTES) {
    await putFile(path, body, `backup: ${path.split('/').pop()}`);
    return { url: objectId(path), pathname: path };
  }

  const parts = Math.ceil(body.length / CHUNK_BYTES);
  for (let i = 0; i < parts; i += 1) {
    const slice = body.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
    await putFile(`${path}.part${String(i).padStart(4, '0')}`, slice, `backup: part ${i + 1}/${parts}`);
  }
  await putFile(`${path}${PARTS_SUFFIX}`, Buffer.from(JSON.stringify({ parts })), `backup: index for ${path.split('/').pop()}`);
  return { url: objectId(path), pathname: path };
}

export async function fetchObject(object) {
  const path = pathFromObject(object);
  const index = await readFile(`${path}${PARTS_SUFFIX}`);
  if (!index) {
    const whole = await readFile(path);
    if (!whole) throw new Error('That snapshot is not in the repository');
    return whole;
  }
  const { parts } = JSON.parse(index.toString('utf8'));
  const buffers = [];
  for (let i = 0; i < parts; i += 1) {
    const chunk = await readFile(`${path}.part${String(i).padStart(4, '0')}`);
    if (!chunk) throw new Error(`Snapshot is incomplete — part ${i + 1} of ${parts} is missing`);
    buffers.push(chunk);
  }
  return Buffer.concat(buffers);
}

export async function deleteObject(object) {
  const path = pathFromObject(object);
  const index = await readFile(`${path}${PARTS_SUFFIX}`);
  if (index) {
    const { parts } = JSON.parse(index.toString('utf8'));
    for (let i = 0; i < parts; i += 1) {
      await deleteFile(`${path}.part${String(i).padStart(4, '0')}`, `backup: drop part ${i + 1}`);
    }
    await deleteFile(`${path}${PARTS_SUFFIX}`, 'backup: drop index');
  }
  return deleteFile(path, `backup: drop ${path.split('/').pop()}`);
}

/** Files under a directory, as { pathname, url } — same shape the Blob store returns. */
export async function listObjects(prefix) {
  const data = await gh(
    `/repos/${repo()}/contents/${encodeURI(prefix)}?ref=${encodeURIComponent(branch())}`
  );
  if (!Array.isArray(data)) return [];
  return data
    .filter((f) => f.type === 'file')
    .map((f) => ({ pathname: f.path, url: objectId(f.path) }));
}

export async function readText(path) {
  const buf = await readFile(path);
  return buf ? buf.toString('utf8') : null;
}

export async function writeText(path, text, message) {
  await putFile(path, Buffer.from(text, 'utf8'), message);
}
