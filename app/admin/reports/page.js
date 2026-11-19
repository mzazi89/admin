'use client';

// MZAZI ADMIN — reports from community chats.
//
// Each row is a message someone flagged plus who wrote it and who reported it.
// Nothing here is visible to either party, so this queue is the whole story:
// resolve it when the message has been dealt with, reopen if it comes back.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Badge, Button, Card, DataTable, EmptyState, ErrorState, PageHeader,
  Skeleton, humaniseError, useToast, Icons,
} from '@/components/ui';

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];

export default function AdminReports() {
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState('open');
  const [reports, setReports] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(0);

  const load = useCallback(async (status = filter) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/community/reports?status=${status}`, { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not load reports');
      setReports(d.reports || []);
      setCounts(d.counts || {});
    } catch (e) {
      setError(humaniseError(e, 'We could not load reports right now.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const update = async (row, status) => {
    setBusyId(row.id);
    try {
      const res = await fetch('/api/admin/community/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not update that report');
      toast.success(status === 'resolved' ? 'Marked resolved' : 'Reopened');
      await load();
    } catch (e) {
      toast.error(humaniseError(e, 'Could not update that report'));
    } finally {
      setBusyId(0);
    }
  };

  const open = counts.open || 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader
        title="Community reports"
        subtitle="Messages flagged by customers. Reports are private: neither the reporter nor the sender sees them in the chat."
        actions={<Button variant="ghost" icon={<Icons.Refresh size={15} />} onClick={() => load()}>Refresh</Button>}
      />

      <Alert kind={open ? 'warn' : 'info'} title={open ? `${open} open report${open === 1 ? '' : 's'}` : 'Nothing waiting'}>
        {open
          ? 'Read the message, then either deal with the sender in the group or resolve it here. Deleting a message from the founder chat still leaves the tombstone in the customer view.'
          : 'When someone long-presses a message and chooses “Report to MZAZI”, it lands here.'}
      </Alert>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Button key={f.id} size="sm" variant={filter === f.id ? 'primary' : 'ghost'} onClick={() => setFilter(f.id)}>
              {f.label}{f.id !== 'all' && counts[f.id] ? ` · ${counts[f.id]}` : ''}
            </Button>
          ))}
        </div>

        {error ? (
          <ErrorState title="Could not load reports" message={error} onRetry={() => load()} />
        ) : loading ? (
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} h={56} />)}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<Icons.Shield size={26} />}
            title={filter === 'open' ? 'No open reports' : 'Nothing here'}
            description={filter === 'open' ? 'Reported messages will appear here with the text, the sender and the reporter.' : 'Try another filter.'}
          />
        ) : (
          <DataTable columns={['Message', 'Reported by', 'Reason', 'When', '']}>
            {reports.map((r) => (
              <tr key={r.id}>
                <td data-label="Message" style={{ maxWidth: 420 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {r.deleted_at ? <i style={{ color: 'var(--dim)' }}>Message deleted</i> : (r.message_body || `[${r.kind || 'attachment'}]`)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>
                    from {r.sender_name || r.sender_email || `user ${r.sender_id}`} · {r.chat_title || (r.chat_kind === 'dm' ? 'direct message' : 'group')}
                  </div>
                </td>
                <td data-label="Reported by">
                  <div style={{ fontSize: 12.5 }}>{r.reporter_name || '—'}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>{r.reporter_email}</div>
                </td>
                <td data-label="Reason">
                  <Badge tone="warn">{r.reason}</Badge>
                  {r.note && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3, maxWidth: 220 }}>{r.note}</div>}
                </td>
                <td data-label="When" className="mono" style={{ fontSize: 11.5, color: 'var(--dim)' }}>
                  {new Date(r.created_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td data-label="">
                  {r.status === 'open' ? (
                    <Button size="sm" variant="primary" loading={busyId === r.id} onClick={() => update(r, 'resolved')}>
                      Resolve
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => update(r, 'open')}>
                      Reopen
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
