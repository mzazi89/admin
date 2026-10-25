'use client';

import { useState, useEffect, useRef } from 'react';
import { PageHeader, Card, Icons, Button, Badge } from '@/components/ui';

export default function AdminCommunityChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const lastIdRef = useRef(0);
  const audioRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const r = await fetch(`/api/admin/community/messages?lastId=${lastIdRef.current}`);
      if (r.ok) {
        const d = await r.json();
        if (d.messages?.length > 0) {
          const newMessages = d.messages;
          const lastMsg = newMessages[newMessages.length - 1];
          
          // Play notification if a user sent a message
          if (lastIdRef.current > 0) {
            const hasUserMsg = newMessages.some(m => m.role === 'user');
            if (hasUserMsg && audioRef.current) {
              audioRef.current.play().catch(() => {});
            }
          }

          setMessages(prev => [...prev, ...newMessages]);
          lastIdRef.current = lastMsg.id;
        }
      }
    } catch (err) {}
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/community/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() }),
      });
      if (res.ok) {
        setInput('');
        loadMessages();
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="container-admin">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" preload="auto" />
      
      <PageHeader 
        title="Community Management" 
        subtitle="Live waitlist chat monitoring and founder responses."
        icon={<Icons.Users />}
      >
        <Badge tone="brand">Live Mode</Badge>
      </PageHeader>

      <div className="flex flex-col anim-fade-up" style={{ height: '700px', maxWidth: '900px', marginInline: 'auto' }}>
        
        {/* ── WhatsApp Style Container ── */}
        <div className="card overflow-hidden flex flex-col h-full" style={{ border: '1px solid var(--line)' }}>
          
          {/* Header */}
          <div style={{ padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-tint)', color: 'var(--brand)', display: 'grid', placeItems: 'center' }}>
              <Icons.Zap size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800 }}>MZAZI TECH Community</h3>
              <p style={{ fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>Dominic (Admin) + Members</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ 
            flex: 1, 
            background: 'rgba(4, 6, 13, 0.2)', 
            backgroundImage: 'radial-gradient(var(--brand-tint) 1px, transparent 0)',
            backgroundSize: '24px 24px',
            overflowY: 'auto', 
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {messages.map(msg => {
              const isAdmin = msg.role === 'admin';
              return (
                <div key={msg.id} style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}>
                  {!isAdmin && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', marginLeft: 4, marginBottom: 2 }}>
                      {msg.user_name}
                    </span>
                  )}
                  <div style={{ 
                    background: isAdmin ? 'var(--brand)' : 'var(--surface)', 
                    color: isAdmin ? '#FFF' : 'var(--ink)',
                    padding: '8px 12px',
                    borderRadius: isAdmin ? '12px 0 12px 12px' : '0 12px 12px 12px',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <p style={{ fontSize: 14 }}>{msg.message}</p>
                    <div style={{ fontSize: 9, opacity: 0.7, textAlign: 'right', marginTop: 4 }}>
                      {fmtTime(msg.created_at)} {isAdmin && '✓✓'}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{ padding: 16, background: 'var(--surface)', borderTop: '1px solid var(--line)', display: 'flex', gap: 12 }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Reply to community..."
              className="flex-1"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--line-soft)',
                borderRadius: '20px',
                padding: '8px 20px',
                outline: 'none',
                color: 'var(--ink)'
              }}
            />
            <Button type="submit" tone="brand" loading={loading}>Send</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
