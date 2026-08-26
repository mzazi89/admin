// ─────────────────────────────────────────────────────────────────────────────
// lib/ssh.js — minimal ssh2 wrapper for the Panel Hosting (deploy) feature.
// Every call opens a short-lived connection, runs a command, closes.
// ─────────────────────────────────────────────────────────────────────────────
import { Client } from 'ssh2';

export function sshConnect({ host, port = 22, username = 'root', password = '', privateKey = '' }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const cfg = { host, port: Number(port) || 22, username, readyTimeout: 15000 };
    if (privateKey && privateKey.trim()) cfg.privateKey = privateKey;
    else cfg.password = password;
    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(err));
    conn.connect(cfg);
  });
}

export function sshExec(conn, command, { timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { conn.end(); } catch {}
      reject(new Error('SSH command timed out'));
    }, timeout);
    conn.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
      stream.on('data', (d) => { stdout += d.toString(); });
      stream.stderr.on('data', (d) => { stderr += d.toString(); });
    });
  });
}

export function sshWriteFile(conn, remotePath, content) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const handle = (e, writeStream) => {
        if (e) return reject(e);
        writeStream.on('close', () => resolve());
        writeStream.on('error', (we) => reject(we));
        writeStream.end(content);
      };
      sftp.open(remotePath, 'w', handle);
    });
  });
}

export function sshClose(conn) {
  try { conn.end(); } catch {}
}
