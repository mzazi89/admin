'use client';

// MZAZI ADMIN — Database.
//
// One job: take the archive and put it into a new database. The order is fixed on
// purpose — paste a connection string, test it, then sync. The sync button stays
// disabled until that exact string has been tested in this session, so nobody
// watches a spinner against a host they mistyped.

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input,
  PageHeader, Select, Skeleton, StatCard, humaniseError, useToast, Icons,
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

export default function AdminDatabase() {
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const [targetUrl, setTargetUrl] = useState('');
  const [test, setTest] = useState(null);
  const [testedUrl, setTestedUrl] = useState('');
  const [testing, setTesting] = useState(false);

  const [objectUrl, setObjectUrl] = useState('latest');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmSync, setConfirmSync] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/backup', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not read the archive');
      setStatus(d);
      if (d.snapshots?.length) setObjectUrl(d.snapshots[0].object);
    } catch (e) {
      toast.error(humaniseError(e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    setConfirmSync(false);
    try {
      const res = await fetch('/api/admin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) throw new Error(d.error || 'Connection failed');
      setTest(d);
      setTestedUrl(targetUrl);
      toast.success(`Connected to ${d.database}`);
    } catch (e) {
      setTest({ ok: false, error: humaniseError(e) });
      setTestedUrl('');
      toast.error(humaniseError(e));
    } finally {
      setTesting(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/backup/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, objectUrl, dryRun: false }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Sync failed');
      setResult(d);
      toast.success(`Synced ${d.totals?.inserted ?? 0} rows`);
    } catch (e) {
      toast.error(humaniseError(e));
    } finally {
      setSyncing(false);
      setConfirmSync(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Database" description="Move the archive into a new database." icon={<Icons.Copy size={20} />} />
        <Skeleton h={160} />
      </>
    );
  }

  const snapshots = status?.snapshots || [];
  const latest = snapshots[0];
  const liveTotal = Object.values(status?.database?.counts || {}).reduce((a, b) => a + b, 0);
  const urlUntested = targetUrl.trim() && testedUrl !== targetUrl;
  const canSync = Boolean(test?.ok && testedUrl === targetUrl && snapshots.length && !syncing);

  return (
    <>
      <PageHeader
        title="Database"
        description="Point the archive at a new database and copy it across — tables, rows and id sequences."
        icon={<Icons.Copy size={20} />}
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
        <StatCard label="Current database" value={fmtBytes(status?.database?.bytes)} hint={status?.database?.error ? 'not answering' : `${liveTotal.toLocaleString()} rows`} icon={<Icons.Dashboard size={16} />} />
        <StatCard label="Restore point" value={latest ? new Date(latest.createdAt).toLocaleDateString() : 'none'} hint={latest ? `${(latest.rowTotal ?? 0).toLocaleString()} rows archived` : 'take a snapshot first'} icon={<Icons.Clock size={16} />} tone="blue" />
        <StatCard label="Archive store" value={status?.backend?.kind === 'github' ? 'Git repo' : status?.backend?.kind === 'blob' ? 'Vercel Blob' : 'none'} hint={status?.backend?.target || 'not configured'} icon={<Icons.Shield size={16} />} tone="good" />
      </div>

      {status?.database?.error && (
        <Alert kind="error" title="The current database is not answering">
          {status.database.error}
          <br />
          <span style={{ opacity: 0.75 }}>
            If it has run out of quota, this is the moment: enter the new database below and sync.
          </span>
        </Alert>
      )}

      {!snapshots.length && (
        <Alert kind="warn" title="There is nothing to sync yet">
          The archive is empty. Take a snapshot from <strong>Backups</strong> first — that is the copy
          this page moves into the new database.
        </Alert>
      )}

      <Card className="card" style={{ marginBottom: 16 }}>
        <CardHeader
          title="1. New database"
          description="The connection string of the database you want to fill. It is used for this request only and is never stored."
        />

        <Field
          label="Connection string"
          id="targetUrl"
          hint="postgres://user:password@host/dbname?sslmode=require — must be reachable from Vercel"
        >
          <Input
            id="targetUrl"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="postgresql://user:password@host/dbname?sslmode=require"
            value={targetUrl}
            onChange={(e) => { setTargetUrl(e.target.value); setTest(null); setTestedUrl(''); setResult(null); setConfirmSync(false); }}
          />
        </Field>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="ghost" onClick={runTest} loading={testing} disabled={!targetUrl.trim()} icon={<Icons.Zap size={15} />}>
            Test connection
          </Button>
          {urlUntested && <span style={{ color: 'var(--dim)', fontSize: 13 }}>Test again — this string has changed.</span>}
        </div>

        {test && (test.ok === false ? (
          <Alert kind="error" title="Could not connect">{test.error}</Alert>
        ) : (
          <Alert kind={test.existingRows ? 'warn' : 'success'} title={`Connected to ${test.database}`}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
              <Badge tone="neutral">{test.version}</Badge>
              <Badge tone={test.alreadyHasSchema ? 'warn' : 'good'}>
                {test.alreadyHasSchema ? 'tables already exist' : 'empty database'}
              </Badge>
              {test.existingRows > 0 && <Badge tone="warn">{test.existingRows.toLocaleString()} rows already present</Badge>}
            </div>
            {test.existingRows > 0
              ? 'Syncing will skip rows that are already there by primary key and add the rest. Nothing is overwritten.'
              : 'Nothing is stored in this database yet — the sync will create the tables and fill them.'}
          </Alert>
        ))}
      </Card>

      <Card className="card">
        <CardHeader
          title="2. Sync"
          description="Creates the tables in the new database, copies every archived row, then moves the id sequences past the highest restored id."
        />

        <Field label="Restore point" id="objectUrl" hint={`${snapshots.length} archived`}>
          <Select id="objectUrl" value={objectUrl} onChange={(e) => { setObjectUrl(e.target.value); setResult(null); }} disabled={!snapshots.length}>
            {snapshots.length === 0 && <option value="latest">no snapshots yet</option>}
            {snapshots.map((s) => (
              <option key={s.object} value={s.object}>
                {new Date(s.createdAt).toLocaleString()} — {(s.rowTotal ?? 0).toLocaleString()} rows
              </option>
            ))}
          </Select>
        </Field>

        {!canSync && !syncing && (
          <p style={{ color: 'var(--dim)', fontSize: 13, margin: '0 0 12px' }}>
            {!targetUrl.trim()
              ? 'Paste a connection string above to continue.'
              : !test?.ok
                ? 'Test the connection first — the sync stays locked until it passes.'
                : 'Ready.'}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {confirmSync ? (
            <>
              <Button variant="danger" onClick={runSync} loading={syncing}>
                Yes — write {latest?.rowTotal?.toLocaleString() ?? ''} rows into that database
              </Button>
              <Button variant="ghost" onClick={() => setConfirmSync(false)} disabled={syncing}>Cancel</Button>
            </>
          ) : (
            <Button onClick={() => setConfirmSync(true)} disabled={!canSync} loading={syncing} icon={<Icons.Upload size={15} />}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
          )}
        </div>

        {result && (
          <div style={{ marginTop: 16 }}>
            <Alert kind="success" title="Sync finished">
              <strong>{(result.totals?.inserted ?? 0).toLocaleString()}</strong> of{' '}
              {(result.totals?.rows ?? 0).toLocaleString()} rows written
              {result.totals?.skipped ? `, ${result.totals.skipped.toLocaleString()} skipped` : ''}.
              <br />
              <span style={{ opacity: 0.8 }}>
                Next: point <code>DATABASE_URL</code> on this project at the new database and redeploy.
                Leave the old one alone until the site is confirmed working.
              </span>
            </Alert>

            <DataTable columns={['Table', 'Rows', 'Written', 'Skipped', 'Error']}>
              {Object.entries(result.tables || {}).map(([t, v]) => (
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
