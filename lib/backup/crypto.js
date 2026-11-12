// MZAZI ADMIN — encryption for backup objects.
//
// Vercel Blob objects are readable by anyone holding the URL; there is no
// private access mode on this plan. A snapshot of `users` and `wallet` is exactly
// the data you must not leave reachable behind an unguessable string, because
// URLs leak — into logs, screenshots, the browser history of whoever listed the
// store, and any future CDN misconfiguration.
//
// So everything is sealed before it is uploaded: AES-256-GCM, authenticated, with
// the IV and tag carried in the envelope. A blob without the key is noise.
//
// Key source, in order of preference:
//   1. BACKUP_ENCRYPTION_KEY  — set this to keep backups readable if the admin
//      session secret is ever rotated.
//   2. ADMIN_JWT_SECRET       — works today with no new configuration, but
//      rotating it makes older snapshots unreadable. That is a real trade and
//      it is why (1) exists.
//
// Envelope layout:  [ 'MZAB' ][ version 1 ][ iv 12 ][ tag 16 ][ ciphertext ]

import crypto from 'crypto';

const MAGIC = Buffer.from('MZAB', 'ascii');
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

/** True when a key can be derived — i.e. a backup can be encrypted and read back. */
export function keyReady() {
  return Boolean(process.env.BACKUP_ENCRYPTION_KEY || process.env.ADMIN_JWT_SECRET);
}

/** Which secret is in use, without revealing it. Surfaced in the admin UI so an
 *  operator can see whether rotating the JWT secret would strand the archive. */
export function keySource() {
  if (process.env.BACKUP_ENCRYPTION_KEY) return 'BACKUP_ENCRYPTION_KEY';
  if (process.env.ADMIN_JWT_SECRET) return 'ADMIN_JWT_SECRET (derived)';
  return null;
}

function deriveKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY || process.env.ADMIN_JWT_SECRET;
  if (!raw) throw new Error('No backup key: set BACKUP_ENCRYPTION_KEY or ADMIN_JWT_SECRET');
  // A fixed label keeps the backup key independent of any other use of the same
  // secret — the JWT signing key and this key are different keys derived from
  // the same material.
  return crypto.createHash('sha256').update(`mzazi-backup-v1:${raw}`).digest();
}

export function encrypt(buffer) {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

export function decrypt(buffer) {
  const buf = Buffer.from(buffer);
  if (buf.length < MAGIC.length + 1 + IV_LEN + TAG_LEN) {
    throw new Error('Backup object is truncated');
  }
  if (!buf.subarray(0, 4).equals(MAGIC)) {
    throw new Error('Not a MZAZI backup object (bad magic)');
  }
  const version = buf[4];
  if (version !== VERSION) throw new Error(`Unsupported backup version ${version}`);
  const iv = buf.subarray(5, 5 + IV_LEN);
  const tag = buf.subarray(5 + IV_LEN, 5 + IV_LEN + TAG_LEN);
  const body = buf.subarray(5 + IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}
