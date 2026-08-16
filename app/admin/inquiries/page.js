'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_TAG = { open: 'tag-amber', replied: 'tag-green', closed: '' };

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [messages, setMessages]   = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply]         = useState('');
  const [replying, setReplying]   = useState(false);
  const [filter, setFilter]       = useState('all');
  // Mobile: 'list' | 'chat'
  const [mobileView, setMobileView] = useState('list');
  const bottomRef = useRef(null);
  const router    = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      loadInquiries();
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadInquiries = async () => {
    const r = await fetch('/api/admin/inquiries');
    if (r.ok) { const d = await r.json(); setInquiries(d.inquiries || []); }
    setLoading(false);
  };

  const openThread = async (inq) => {
    setSelected(inq);
    setReply('');
    setMobileView('chat');
    setMsgLoading(true);
    try {
      const r = await fetch(`/api/admin/inquiries/${inq.id}/messages`);
      if (r.ok) {
        const d = await r.json();
        if (d.messages && d.messages.length > 0) {
          setMessages(d.messages);
        } else {
          const legacy = [{ id: 'lg-u', sender: 'user', message: inq.message, created_at: inq.created_at }];
          if (inq.admin_reply) legacy.push({ id: 'lg-a', sender: 'admin', message: inq.admin_reply, created_at: inq.replied_at || inq.created_at });
          setMessages(legacy);
        }
      }
    } finally { setMsgLoading(false); }
  };

  const handleReply = async () => {
    if (!reply.trim() || !selected) return;
    setReplying(true);
    const res = await fetch('/api/admin/inquiries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, admin_reply: reply, status: 'replied' }),
    });
    if (res.ok) {
      setMessages(m => [...m, { id: Date.now(), sender: 'admin', message: reply, created_at: new Date().toISOString() }]);
      setReply('');
      await loadInquiries();
      setSelected(p => ({ ...p, admin_reply: reply, status: 'replied' }));
    }
    setReplying(false);
  };

  const closeInquiry = async () => {
    await fetch('/api/admin/inquiries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id }),
    });
    await loadInquiries();
    setSelected(p => ({ ...p, status: 'closed' }));
  };

  const filtered = inquiries.filter(i => filter === 'all' || i.status === filter);

  const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '';
  const fmtDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts), today = new Date(), yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  };

  const openCount = inquiries.filter(i => i.status === 'open').length;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="eyebrow mb-4">Support desk</div>
          <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>Member inquiries</h1>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'open', 'replied', 'closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="mono btn"
              style={{
                fontSize: 10.5, padding: '8px 14px', textTransform: 'uppercase',
                backgroundColor: filter === f ? '#F2A93B' : 'transparent',
                color: filter === f ? '#14100A' : '#79818A',
                border: `1px solid ${filter === f ? '#F2A93B' : '#262C33'}`,
                cursor: 'pointer',
              }}>
              {f}{f === 'open' && openCount > 0 ? ` (${openCount})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Chat UI */}
      <div className="card overflow-hidden">
        {/* ─── MOBILE ─── */}
        <div className="block md:hidden" style={{ height: 'calc(100dvh - 220px)', minHeight: '480px', display: 'flex', flexDirection: 'column' }}>

          {mobileView === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #262C33', backgroundColor: '#0F1215', flexShrink: 0 }}>
                <p className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#79818A', margin: 0 }}>
                  {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div className="flex items-center justify-center h-full"><div className="spinner" /></div>
                ) : filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="mono" style={{ color: '#4C535B' }}>No inquiries</p>
                  </div>
                ) : filtered.map(inq => (
                  <AdminThreadRow key={inq.id} inq={inq} active={false} onClick={() => openThread(inq)} fmtDate={fmtDate} />
                ))}
              </div>
            </div>
          )}

          {mobileView === 'chat' && selected && (
            <AdminChatWindow
              selected={selected} messages={messages} msgLoading={msgLoading}
              reply={reply} setReply={setReply}
              replying={replying} onReply={handleReply} onClose={closeInquiry}
              bottomRef={bottomRef} fmtTime={fmtTime} fmtDate={fmtDate}
              onBack={() => setMobileView('list')}
              showBack={true}
            />
          )}
        </div>

        {/* ─── DESKTOP ─── */}
        <div className="hidden md:flex" style={{ height: '620px' }}>
          {/* Left: thread list */}
          <div style={{ width: 300, minWidth: 240, borderRight: '1px solid #262C33', display: 'flex', flexDirection: 'column', flexShrink: 0, backgroundColor: '#0F1215' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #262C33', flexShrink: 0 }}>
              <p className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#79818A', margin: 0 }}>
                {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full"><div className="spinner" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="mono" style={{ color: '#4C535B' }}>No inquiries</p>
                </div>
              ) : filtered.map(inq => (
                <AdminThreadRow key={inq.id} inq={inq} active={selected?.id === inq.id} onClick={() => openThread(inq)} fmtDate={fmtDate} />
              ))}
            </div>
          </div>

          {/* Right: chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {selected ? (
              <AdminChatWindow
                selected={selected} messages={messages} msgLoading={msgLoading}
                reply={reply} setReply={setReply}
                replying={replying} onReply={handleReply} onClose={closeInquiry}
                bottomRef={bottomRef} fmtTime={fmtTime} fmtDate={fmtDate}
                showBack={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-6">
                <p className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4C535B' }}>No thread selected</p>
                <p className="lede" style={{ fontSize: '0.9rem', textAlign: 'center' }}>Select an inquiry on the left to open the conversation.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared sub-components ─────────────────────────────────────────────────── */

function AdminThreadRow({ inq, active, onClick, fmtDate }) {
  const tagCls = STATUS_TAG[inq.status] || 'tag-amber';
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3 transition-colors"
      style={{
        backgroundColor: active ? 'rgba(242,169,59,0.05)' : 'transparent',
        borderBottom: '1px solid #1B2026',
        borderLeft: `2px solid ${active ? '#F2A93B' : 'transparent'}`,
        cursor: 'pointer',
      }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            {inq.status === 'open' && <span className="dot anim-pulse" style={{ color: '#F2A93B' }} />}
            <p style={{ fontSize: 12.5, fontWeight: 700, color: '#E9E7E2', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inq.user_name || inq.user_email || 'Unknown'}
            </p>
          </div>
          <p className="mono" style={{ fontSize: 10.5, color: '#79818A', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {inq.subject}
          </p>
          <p className="mono" style={{ fontSize: 10, color: '#4C535B', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {inq.last_sender === 'admin' ? '[staff] ' : ''}{(inq.last_message || inq.message || '').slice(0, 35)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="mono" style={{ fontSize: 10, color: '#4C535B', margin: 0 }}>{fmtDate(inq.updated_at || inq.created_at)}</p>
          <span className={`tag ${tagCls}`} style={{ fontSize: 9.5, padding: '2px 8px' }}>{inq.status}</span>
        </div>
      </div>
    </button>
  );
}

function AdminChatWindow({ selected, messages, msgLoading, reply, setReply, replying, onReply, onClose, bottomRef, fmtTime, fmtDate, onBack, showBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid #262C33', backgroundColor: '#0F1215', flexShrink: 0 }}>
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <button onClick={onBack}
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 30, height: 30, color: '#AEB5BD', backgroundColor: '#14181D', border: '1px solid #262C33', cursor: 'pointer' }}
              aria-label="Back to list">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M8.5 2.5L4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          )}
          <span className="mono flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, border: '1px solid #262C33', borderRadius: 3, fontSize: 13, fontWeight: 600, color: '#F2A93B', backgroundColor: '#14181D' }}>
            {(selected.user_name || selected.user_email || 'U')[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <p style={{ fontWeight: 700, fontSize: 13.5, color: '#E9E7E2', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selected.user_name || selected.user_email}
            </p>
            <p className="mono" style={{ fontSize: 10.5, color: '#79818A', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selected.subject}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`tag ${STATUS_TAG[selected.status] || 'tag-amber'}`}>{selected.status}</span>
          {selected.status !== 'closed' && (
            <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 10, padding: '6px 12px', color: '#79818A' }}>
              Close
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {msgLoading ? (
          <div className="flex items-center justify-center h-full"><div className="spinner" /></div>
        ) : messages.map((msg, i) => {
          const isAdmin = msg.sender === 'admin';
          const showDate = i === 0 || fmtDate(messages[i - 1].created_at) !== fmtDate(msg.created_at);
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4C535B' }}>
                    {fmtDate(msg.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} mb-1.5`}>
                <div
                  className="px-3.5 py-2 text-sm leading-relaxed"
                  style={{
                    maxWidth: 'min(75%, 380px)',
                    background: isAdmin ? '#F2A93B' : '#1A1F25',
                    color: isAdmin ? '#14100A' : '#E9E7E2',
                    border: `1px solid ${isAdmin ? 'rgba(242,169,59,0.6)' : '#262C33'}`,
                    borderRadius: isAdmin ? '4px 4px 2px 4px' : '4px 4px 4px 2px',
                  }}
                >
                  <p className="whitespace-pre-wrap break-words" style={{ margin: 0, fontSize: 13.5 }}>{msg.message}</p>
                  <p className="mono" style={{ fontSize: 10, color: isAdmin ? 'rgba(20,16,10,0.6)' : '#4C535B', margin: '4px 0 0', textAlign: 'right' }}>
                    {fmtTime(msg.created_at)}{isAdmin ? ' · sent' : ''}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid #262C33', backgroundColor: '#0F1215', flexShrink: 0 }}>
        {selected.status === 'closed' ? (
          <p className="mono text-center py-1" style={{ fontSize: 11, color: '#4C535B', margin: 0 }}>This inquiry is closed.</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onReply(); } }}
              placeholder="Type your reply — Enter to send"
              rows={1}
              className="input flex-1"
              style={{ resize: 'none', maxHeight: 100, borderRadius: 3 }}
            />
            <button onClick={onReply} disabled={replying || !reply.trim()}
              className="btn btn-primary"
              style={{ padding: '11px 18px', opacity: replying || !reply.trim() ? 0.5 : 1, flexShrink: 0 }}>
              {replying ? 'Sending' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
