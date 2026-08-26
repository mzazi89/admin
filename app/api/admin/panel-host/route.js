// MZAZI API — /api/admin/panel-host
// Panel Hosting: deploy a full Pterodactyl panel (panel + node + egg) onto a
// VPS over SSH, asynchronously, with a pollable progress log.
//
//   POST { action: 'deploy', host, port, password|privateKey, ... } → starts
//        the install in the background on the VPS (/root/panel-deploy.sh,
//        log at /root/panel-deploy.log) and returns the current log tail.
//   GET  ?action=status&host=&port=&password= → { running, log, summary }
//   POST { action: 'stop', ... } → kills the background install.
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { sshConnect, sshExec, sshWriteFile, sshClose } from '@/lib/ssh';
import { buildDeployScript } from '@/lib/panelDeploy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

function connParams(body) {
  return {
    host: String(body.host || '').trim(),
    port: Number(body.port) || 22,
    username: String(body.username || 'root').trim(),
    password: String(body.password || ''),
    privateKey: String(body.privateKey || ''),
  };
}

const LOG_FILE = '/root/panel-deploy.log';
const SCRIPT_FILE = '/root/panel-deploy.sh';

export async function POST(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    const conn = connParams(body);
    if (!conn.host) return NextResponse.json({ error: 'VPS IP/host required' }, { status: 400 });
    if (!conn.password && !conn.privateKey) {
      return NextResponse.json({ error: 'SSH password or private key required' }, { status: 400 });
    }

    let ssh;
    try {
      ssh = await sshConnect(conn);
    } catch (e) {
      return NextResponse.json({ error: `SSH connection failed: ${e.message}` }, { status: 502 });
    }

    try {
      if (body.action === 'stop') {
        await sshExec(ssh, 'pkill -f panel-deploy.sh 2>/dev/null; sleep 1; pgrep -f panel-deploy.sh >/dev/null && echo STILL_RUNNING || echo STOPPED');
        return NextResponse.json({ ok: true, stopped: true });
      }
      if (body.action !== 'deploy') {
        return NextResponse.json({ error: 'unknown action' }, { status: 400 });
      }

      // Write the generated script + launch it in the background.
      const script = buildDeployScript(body);
      await sshWriteFile(ssh, SCRIPT_FILE, script);
      await sshExec(ssh, `chmod +x ${SCRIPT_FILE} && rm -f ${LOG_FILE}`);
      await sshExec(ssh, `nohup bash ${SCRIPT_FILE} >/dev/null 2>&1 & disown; echo started`);
      await new Promise((r) => setTimeout(r, 1500));
      const tail = await sshExec(ssh, `tail -n 40 ${LOG_FILE} 2>/dev/null || echo "log not ready yet"`);
      return NextResponse.json({ ok: true, log: tail.stdout || tail.stderr });
    } finally {
      sshClose(ssh);
    }
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Deploy failed' }, { status: 500 });
  }
}

export async function GET(request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const conn = connParams({
      host: searchParams.get('host'),
      port: searchParams.get('port'),
      username: searchParams.get('username'),
      password: searchParams.get('password'),
      privateKey: searchParams.get('private_key'),
    });
    if (!conn.host) return NextResponse.json({ error: 'host required' }, { status: 400 });

    let ssh;
    try {
      ssh = await sshConnect(conn);
    } catch (e) {
      return NextResponse.json({ error: `SSH connection failed: ${e.message}` }, { status: 502 });
    }

    try {
      const run = await sshExec(ssh, 'pgrep -f panel-deploy.sh >/dev/null && echo RUNNING || echo IDLE');
      const running = (run.stdout || '').includes('RUNNING');
      const tail = await sshExec(ssh, `tail -n 80 ${LOG_FILE} 2>/dev/null || true`);
      const log = (tail.stdout || '').split('\n').filter((l) => l.trim());
      const summary = {};
      for (const l of log) {
        const m = l.match(/^\[DONE\] ([A-Z_]+)=(.*)$/);
        if (m) summary[m[1]] = m[2];
      }
      const failed = log.some((l) => l.includes('[FAIL]')) || log.some((l) => l.includes('[FINISH] failed'));
      const finished = log.some((l) => l.includes('[FINISH] complete'));
      return NextResponse.json({ ok: true, running, finished, failed, log, summary });
    } finally {
      sshClose(ssh);
    }
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Status failed' }, { status: 500 });
  }
}
