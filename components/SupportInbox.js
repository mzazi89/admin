'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState, Icons } from '@/components/ui';

// MZAZI ADMIN — support conversations.
//
// Shared by /admin/chat and the Support chat tab on /admin/inquiries, so the
// inbox a person checks and the inbox the nav points at cannot disagree.
// Left: threads with unread counts. Right: the conversation, polled from the
// last id so a reply appears without a refresh.
export default function SupportInbox() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const listRef = useRef(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch('/api/admin/chat');
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    setThreads(d.threads || []);
    setActive((cur) => cur || d.threads?.[0] || null);
  }, []);

  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, 10000);
    return () => clearInterval(t);
  }, [loadThreads]);

  const loadMessages = useCallback(async (userId, after = 0) => {
    const res = await fetch(`/api/admin/chat/${userId}?after=${after}`);
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    const fresh = d.messages || [];
    if (!fresh.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = fresh.filter((m) => !seen.has(m.id));
      if (!add.length) return prev;
      lastId.current = Math.max(lastId.current, ...add.map((m) => m.id));
      return [...prev, ...add];
    });
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    setMessages([]);
    lastId.current = 0;
    loadMessages(active.user_id, 0);
    const t = setInterval(() => loadMessages(active.user_id, lastId.current), 3000);
    return () => clearInterval(t);
  }, [active, loadMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setDraft('');
    try {
      const res = await fetch(`/api/admin/chat/${active.user_id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.message) {
        setMessages((prev) => [...prev, d.message]);
        lastId.current = Math.max(lastId.current, d.message.id);
        loadThreads();
      }
    } finally { setSending(false); }
  };

  const nameOf = (t) => [t.firstname, t.lastname].filter(Boolean).join(' ') || t.email || `Account #${t.user_id}`;

  if (!threads.length) {
    return <EmptyState icon={<Icons.Chat size={24} />} title="No messages yet" description="Anything sent from the support button on the site or the app lands here instantly." />;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 280px) minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
      <Card style={{ padding: 0, overflow: 'hidden', maxHeight: '64vh', overflowY: 'auto' }}>
        {threads.map((t) => (
          <button
            key={t.user_id}
            type="button"
            onClick={() => setActive(t)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
              background: active?.user_id === t.user_id ? 'var(--brand-tint)' : 'transparent',
              border: 0, borderBottom: '1px solid var(--line-soft)', cursor: 'pointer',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <strong style={{ fontSize: 13 }}>{nameOf(t)}</strong>
              {t.unread > 0 && <Badge tone="brand">{t.unread}</Badge>}
            </div>
            <p className="text-muted" style={{ margin: '2px 0 0', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.last_body}
            </p>
          </button>
        ))}
      </Card>

      <Card style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '64vh' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-soft)' }}>
          <strong style={{ fontSize: 13 }}>{active ? nameOf(active) : 'Select a thread'}</strong>
          {active?.email && <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>{active.email}</p>}
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
              <div style={{
                padding: '7px 10px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5,
                background: m.sender === 'admin' ? 'var(--brand)' : 'rgba(255,255,255,0.05)',
                color: m.sender === 'admin' ? '#fff' : 'var(--ink)',
              }}>{m.body}</div>
              <p className="text-muted" style={{ margin: '2px 0 0', fontSize: 10 }}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--line-soft)' }}>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply as MZAZI support…" maxLength={1200} />
          <Button type="submit" disabled={sending || !draft.trim()}>{sending ? '…' : 'Send'}</Button>
        </form>
      </Card>
    </div>
  );
}
