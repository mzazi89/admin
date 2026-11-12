'use client';

// MZAZI ADMIN — Backups.
//
// The archive fills itself; this page is where an operator looks at it and, when
// the time comes, moves it into a new database. Nothing here runs on a timer that
// the operator cannot see: the schedule is stated on the page, and the last
// snapshot's age is the first number on it.

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input,
  PageHeader, Select, Skeleton, StatCard, humaniseError, useToast,
  Icons,
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
  const [targetUrl, setTargetUrl] = useState('');
  const [objectUrl, setObjectUrl] = useState('latest');
  const [transfer, setTransfer] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [confirmWrite, setConfirmWrite] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/backup', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load backup status');
      setStatus(d);
      if (d.snapshots?.length && objectUrl === 'latest') setObjectUrl(d.snapshots[0].object);
    } catch (e) {
      setError(humaniseError(e));
    } finally {
      setLoading(false);
    }
  }, [objectUrl]);

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

  const runTransfer = async (dryRun) => {
    setTransferring(true);
    setTransfer(null);
    try {
      const res = await fetch('/api/admin/backup/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, objectUrl, dryRun }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Transfer failed');
      setTransfer(d);
      if (!dryRun) toast.success(`Transferred ${d.totals?.inserted ?? 0} rows`);
      else setConfirmWrite(false);
    } catch (e) {
      toast.error(humaniseError(e));
      setConfirmWrite(false);
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Backups" description="Automatic archive of accounts, balances and payments." icon={<Icons.Refresh size={20} />} />
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
        description="Money and people, archived automatically — and movable into a new database in one step."
        icon={<Icons.Refresh size={20} />}
        actions={
          <Button onClick={snapshotNow} loading={running} icon={<Icons.Upload size={15} />}>
            Snapshot now
          </Button>
        }
      />

      {error && <Alert kind="error" title="Could not load status">{error}</Alert>}

      {!status?.storeReady && (
        <Alert kind="warn" title="No backup store is connected">
          <p style={{ margin: '0 0 8px' }}>
            The archive needs somewhere to write. Set <code>BACKUP_REPO</code> to a private
            repository (<code>owner/name</code>) — <code>GITHUB_TOKEN</code> is already available —
            or connect a Vercel Blob store. Snapshots are encrypted either way, so what leaves this
            deployment is ciphertext.
          </p>
          <p style={{ margin: 0 }}>
            Encryption is already in place ({status?.keyReady ? `key from ${status.keySource}` : 'no key set'}),
            so anything written to the store is unreadable without this deployment&apos;s secret.
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
            If it has hit its quota, the archive below is what you have — transfer it to a new database.
          </span>
        </Alert>
      )}

      <Card className="card" style={{ marginBottom: 16 }}>
        <CardHeader
          title="What is covered"
          description="Live counts next to the newest archive. A row that exists live but not in the snapshot arrived after the last run."
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
          description={`The newest ${status?.keep || 12} snapshots are kept; older ones are deleted automatically so the store cannot fill up.`}
        />
        {(status?.snapshots || []).length === 0 ? (
          <EmptyState
            title="Nothing archived yet"
            description={status?.storeReady ? 'Take a snapshot, or wait for the nightly run.' : 'Connect a Blob store first.'}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setObjectUrl(s.object); setTransfer(null); }}
                  >
                    Select for transfer
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card className="card">
        <CardHeader
          title="Move the archive to a new database"
          description="Creates the tables in the target, copies every row, and advances its id sequences. Safe to run twice — existing rows are left alone."
          icon={<Icons.ArrowRight size={16} />}
        />

        <Field
          label="Target database URL"
          id="targetUrl"
          hint="A fresh postgres:// connection string. The current database is refused on purpose."
        >
          <Input
            id="targetUrl"
            type="password"
            autoComplete="off"
            placeholder="postgresql://user:password@host/dbname?sslmode=require"
            value={targetUrl}
            onChange={(e) => { setTargetUrl(e.target.value); setConfirmWrite(false); }}
          />
        </Field>

        <Field label="Snapshot" id="objectUrl" hint={`${(status?.snapshots || []).length} archived`}>
          <Select id="objectUrl" value={objectUrl} onChange={(e) => { setObjectUrl(e.target.value); setTransfer(null); }}>
            {(status?.snapshots || []).map((s) => (
              <option key={s.object} value={s.object}>
                {new Date(s.createdAt).toLocaleString()} — {(s.rowTotal ?? 0).toLocaleString()} rows
              </option>
            ))}
          </Select>
        </Field>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="ghost" onClick={() => runTransfer(true)} loading={transferring && transfer == null}>
            Check first (no writes)
          </Button>
          {confirmWrite ? (
            <Button variant="danger" onClick={() => runTransfer(false)} loading={transferring}>
              Yes — write {transfer?.totals?.rows?.toLocaleString() ?? ''} rows to that database
            </Button>
          ) : (
            <Button
              onClick={() => setConfirmWrite(true)}
              disabled={!targetUrl.trim() || !(status?.snapshots || []).length}
            >
              Transfer…
            </Button>
          )}
          {confirmWrite && (
            <Button variant="ghost" onClick={() => setConfirmWrite(false)}>Cancel</Button>
          )}
        </div>

        {transfer && (
          <div style={{ marginTop: 16 }}>
            <Alert kind={transfer.dryRun ? 'info' : 'success'} title={transfer.dryRun ? 'Dry run — nothing was written' : 'Transfer finished'}>
              {transfer.dryRun ? 'This is what would be inserted: ' : 'Inserted '}
              <strong>{transfer.totals?.inserted?.toLocaleString() ?? 0}</strong> of{' '}
              {transfer.totals?.rows?.toLocaleString() ?? 0} rows
              {transfer.totals?.skipped ? `, ${transfer.totals.skipped.toLocaleString()} skipped` : ''}.
            </Alert>
            <DataTable columns={['Table', 'Rows', 'Inserted', 'Skipped', 'Error']}>
              {Object.entries(transfer.tables || {}).map(([t, v]) => (
                <tr key={t}>
                  <td><code>{t}</code></td>
                  <td>{(v.rows ?? 0).toLocaleString()}</td>
                  <td>{(v.inserted ?? 0).toLocaleString()}</td>
                  <td>{(v.skipped ?? 0).toLocaleString()}</td>
                  <td style={{ color: v.error ? 'var(--bad)' : 'var(--dim)', maxWidth: 320 }}>{v.error || '—'}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
      </Card>
    </>
  );
}
