'use client';

// MZAZI ADMIN — Backups.
//
// The archive fills itself; this page shows what is in it and how fresh it is.
// Moving it into a new database lives on its own page (Database), because that is
// a different decision with a different set of risks, and one screen that both
// checks backups and writes to a database is how data ends up in the wrong place.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert, Badge, Button, Card, CardHeader, DataTable, EmptyState, PageHeader,
  Skeleton, StatCard, humaniseError, useToast, Icons,
} from '@/components/ui';

const fmtBytes = (n) => {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
};

const fmtWhen = (iso) => {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(iso).toLocaleString();
};

export default function AdminBackups() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/backup', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load backup status');
      setStatus(d);
    } catch (e) {
      setError(humaniseError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const snapshotNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Snapshot failed');
      toast.success(`Snapshot stored — ${d.snapshot?.rowTotal ?? 0} rows`);
      await load();
    } catch (e) {
      toast.error(humaniseError(e));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Backups" description="Automatic archive of accounts, balances and payments." icon={<Icons.Shield size={20} />} />
        <Skeleton h={120} />
      </>
    );
  }

  const latest = status?.snapshots?.[0];
  const liveTotal = Object.values(status?.database?.counts || {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Backups"
        description="Money and people, archived automatically every night — and whenever you ask."
        icon={<Icons.Shield size={20} />}
        actions={
          <Button onClick={snapshotNow} loading={running} icon={<Icons.Upload size={15} />}>
            Snapshot now
          </Button>
        }
      />

      {error && <Alert kind="error" title="Could not load status">{error}</Alert>}

      {!status?.storeReady && (
        <Alert kind="warn" title="No archive store is configured">
          <p style={{ margin: 0 }}>
            Set <code>BACKUP_REPO</code> to a private repository (<code>owner/name</code>) —{' '}
            <code>GITHUB_TOKEN</code> is already available — or connect a Vercel Blob store.
            Snapshots are encrypted either way, so what leaves this deployment is ciphertext.
          </p>
        </Alert>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
        <StatCard label="Last snapshot" value={fmtWhen(latest?.createdAt)} hint={latest?.reason === 'cron' ? 'automatic' : latest ? 'manual' : 'no archive yet'} icon={<Icons.Clock size={16} />} />
        <StatCard label="Rows archived" value={latest?.rowTotal?.toLocaleString() || '0'} hint={`across ${status?.tables?.length || 0} tables`} icon={<Icons.Download size={16} />} tone="blue" />
        <StatCard
          label="Stored size"
          value={fmtBytes(latest?.storedBytes)}
          hint={status?.backend?.kind === 'github' ? `in ${status.backend.target}` : status?.backend?.kind === 'blob' ? 'Vercel Blob' : 'not connected'}
          icon={<Icons.Shield size={16} />}
          tone="good"
        />
        <StatCard label="Database size" value={fmtBytes(status?.database?.bytes)} hint={status?.database?.error ? 'unreachable' : `${liveTotal.toLocaleString()} rows live`} icon={<Icons.Dashboard size={16} />} tone="pink" />
      </div>

      {status?.database?.error && (
        <Alert kind="error" title="The database did not answer">
          {status.database.error}
          <br />
          <span style={{ opacity: 0.75 }}>
            If it has hit its quota, the archive below is what you have — move it to a new database.
          </span>
        </Alert>
      )}

      <Card className="card" style={{ marginBottom: 16 }}>
        <CardHeader
          title="What is covered"
          description="Live counts beside the newest archive. A table that is larger live than in the archive gained rows after the last run."
        />
        <DataTable columns={['Table', 'Live rows', 'In archive', '']}>
          {(status?.tables || []).map((t) => {
            const live = status?.database?.counts?.[t];
            const archived = latest?.rows?.[t];
            const behind = typeof live === 'number' && typeof archived === 'number' && live > archived;
            return (
              <tr key={t}>
                <td><code>{t}</code></td>
                <td>{live == null ? '—' : live.toLocaleString()}</td>
                <td>{archived == null ? '—' : archived.toLocaleString()}</td>
                <td>{behind ? <Badge tone="warn">newer than archive</Badge> : <Badge tone="good">caught up</Badge>}</td>
              </tr>
            );
          })}
        </DataTable>
      </Card>

      <Card className="card" style={{ marginBottom: 16 }}>
        <CardHeader
          title="Archive"
          description={`The newest ${status?.keep || 12} snapshots stay in the working tree; older ones remain in the repository history.`}
        />
        {(status?.snapshots || []).length === 0 ? (
          <EmptyState
            title="Nothing archived yet"
            description={status?.storeReady ? 'Take a snapshot, or wait for the nightly run at 02:00.' : 'Configure a store first.'}
            icon={<Icons.Clock size={22} />}
          />
        ) : (
          <DataTable columns={['Taken', 'Trigger', 'Rows', 'Size', '']}>
            {(status.snapshots || []).map((s) => (
              <tr key={s.object}>
                <td>{new Date(s.createdAt).toLocaleString()}</td>
                <td><Badge tone={s.reason === 'cron' ? 'brand' : 'neutral'}>{s.reason}</Badge></td>
                <td>{(s.rowTotal ?? 0).toLocaleString()}</td>
                <td>{fmtBytes(s.storedBytes)}</td>
                <td>
                  <Link href="/admin/database" style={{ fontSize: 13 }}>Restore in Database →</Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card className="card">
        <CardHeader
          title="Move the archive to a new database"
          description="Enter the new connection string, test it, then sync. Tables, rows and id sequences are handled in one step."
          icon={<Icons.Copy size={16} />}
        />
        <p style={{ color: 'var(--dim)', margin: '0 0 12px' }}>
          This lives on its own page so a connection string is never typed onto the screen you check
          backups on.
        </p>
        <Button href="/admin/database" icon={<Icons.ArrowRight size={15} />}>Open Database</Button>
      </Card>
    </>
  );
}
