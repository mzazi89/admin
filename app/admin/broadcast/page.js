'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Badge, Button, Card, ConfirmDialog, ErrorState, Field, Input, PageHeader,
  Textarea, WizardSteps, humaniseError, useToast,
  Icons,
} from '@/components/ui';

const STEPS = ['Audience', 'Message', 'Preview', 'Confirm'];
const MAX_LEN = 4096;

// WhatsApp's own limits, and hard ones: a label of 21 characters or a fourth
// button is not trimmed by the receiving client, it fails to deliver.
const MAX_BUTTON_LABEL = 20;
const MAX_BUTTON_COMMAND = 60;

// What the bot attaches when the operator chooses nothing. Shown in the preview
// so the operator can see the whole message, not just the words they typed — the
// empty field would otherwise look like the broadcast arrives with no buttons.
const DEFAULT_BUTTONS = [
  { text: '📜 Menu', id: '.menu' },
  { text: '💳 Plans', id: '.plans' },
];

const IMAGE_PATTERN = /^https?:\/\//i;

// The ONLY delivery target the bot implements today. The other options are
// shown for transparency but are disabled: nothing in the API filters by plan.
const AUDIENCES = [
  {
    key: 'groups',
    title: 'Connected WhatsApp groups',
    description: 'Every group the bot is in across all of its connected WhatsApp sessions.',
    available: true,
  },
  {
    key: 'free',
    title: 'Free plan members',
    description: 'Segment targeting is not implemented on the bot yet.',
    available: false,
  },
  {
    key: 'premium',
    title: 'Paid plan members',
    description: 'Segment targeting is not implemented on the bot yet.',
    available: false,
  },
];

export default function AdminBroadcast() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [audience, setAudience] = useState('groups');
  const [message, setMessage] = useState('');
  // Both optional. Empty means "whatever the bot attaches by itself".
  const [buttonLabel, setButtonLabel] = useState('');
  const [buttonCommand, setButtonCommand] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const activeSessions = sessions.filter((s) => s.active);
  const targetCount = activeSessions.length;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/sessions');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load sessions');
      setSessions(d.sessions || []);
    } catch (e) {
      setError(humaniseError(e, 'We could not load the connected devices right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only sent when BOTH halves are filled in: half a button is not a button, and
  // the bot's own two are a better outcome than one that does nothing when tapped.
  const customButton = buttonLabel.trim() && buttonCommand.trim()
    ? { text: buttonLabel.trim().slice(0, MAX_BUTTON_LABEL), id: buttonCommand.trim().slice(0, MAX_BUTTON_COMMAND) }
    : null;
  const imageIsUrl = IMAGE_PATTERN.test(imageUrl.trim());

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/admin/bot-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'broadcast',
          payload: {
            message,
            ...(customButton ? { buttons: [customButton] } : {}),
            ...(imageIsUrl ? { image: imageUrl.trim() } : {}),
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to queue the broadcast');
      toast.success('Broadcast queued — the bot picks it up within ~15 seconds.');
      setConfirmOpen(false);
      setMessage('');
      setButtonLabel('');
      setButtonCommand('');
      setImageUrl('');
      setStep(0);
      load();
    } catch (e) {
      toast.error(humaniseError(e, 'We could not queue the broadcast. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const canContinue = step !== 1 || (message.trim().length > 0 && message.length <= MAX_LEN);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <PageHeader
          title="Broadcast"
          description="Send one WhatsApp message to the bot's connected groups."
          icon={<Icons.Send size={20} />}
        />

        <Alert kind="brand" title="Where this message actually goes">
          The bot delivers a broadcast to <strong>the WhatsApp groups of every active session</strong> it is
          connected to. It does <strong>not</strong> target members by plan or any other filter.
        </Alert>

        {error ? (
          <Card style={{ marginTop: 18 }}>
            <ErrorState title="Could not load devices" message={error} onRetry={load} />
          </Card>
        ) : (
          <Card style={{ marginTop: 18 }}>
            <WizardSteps steps={STEPS} current={step} />

            {/* ── Step 1: audience ── */}
            {step === 0 && (
              <div className="anim-fade-up">
                <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Choose an audience</h2>
                <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 14 }}>
                  Delivery is always to the bot&apos;s connected WhatsApp groups — the options below describe the target honestly.
                </p>
                <div style={{ display: 'grid', gap: 10 }} role="radiogroup" aria-label="Audience">
                  {AUDIENCES.map((a) => {
                    const selected = audience === a.key;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!a.available}
                        className={`option-card ${selected ? 'is-selected' : ''}`}
                        onClick={() => a.available && setAudience(a.key)}
                        style={!a.available ? { opacity: 0.62, cursor: 'not-allowed' } : undefined}
                      >
                        <span aria-hidden="true" style={{ marginTop: 2, color: selected ? 'var(--brand)' : 'var(--dim)' }}>
                          {selected ? <Icons.CheckCircle size={20} /> : <Icons.Send size={20} />}
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 15 }}>{a.title}</strong>
                            {a.available
                              ? <Badge tone="good">Current target</Badge>
                              : <Badge tone="neutral">Not available</Badge>}
                          </span>
                          <span style={{ display: 'block', marginTop: 3, color: 'var(--muted)', fontSize: 13.5 }}>{a.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 2: message ── */}
            {step === 1 && (
              <div className="anim-fade-up">
                <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Write your message</h2>
                <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 14 }}>Plain text. Emoji and line breaks are preserved.</p>
                <Textarea
                  id="broadcast-message"
                  rows={7}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type the message you want every connected group to receive…"
                  maxLength={MAX_LEN}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12.5, color: 'var(--dim)' }}>
                  <span className="mono">{message.length} / {MAX_LEN} characters</span>
                  {message.length > MAX_LEN && <span style={{ color: 'var(--bad)' }}>Too long</span>}
                </div>

                {/* ── Optional: your own button, and your own picture ── */}
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                  <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                    Button &amp; picture <span style={{ color: 'var(--dim)', fontWeight: 400, fontSize: 13.5 }}>(optional)</span>
                  </h3>
                  <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.5 }}>
                    By default the bot adds its own picture and the buttons{' '}
                    {DEFAULT_BUTTONS.map((b, i) => (
                      <span key={b.id}>
                        {i > 0 && ' and '}
                        <strong>{b.text}</strong>
                      </span>
                    ))}
                    . Fill in both boxes below to send one of your own <em>instead of</em> those two.
                  </p>

                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    <Field label="Button label" id="broadcast-button-label" hint={`${MAX_BUTTON_LABEL} characters maximum — WhatsApp refuses longer.`}>
                      <Input
                        id="broadcast-button-label"
                        value={buttonLabel}
                        maxLength={MAX_BUTTON_LABEL}
                        onChange={(e) => setButtonLabel(e.target.value)}
                        placeholder="📢 Join our channel"
                      />
                    </Field>
                    <Field label="Command it sends" id="broadcast-button-command" hint="Exactly as it is typed in WhatsApp, prefix included.">
                      <Input
                        id="broadcast-button-command"
                        value={buttonCommand}
                        maxLength={MAX_BUTTON_COMMAND}
                        onChange={(e) => setButtonCommand(e.target.value)}
                        placeholder=".channel"
                      />
                    </Field>
                  </div>

                  {(buttonLabel.trim() || buttonCommand.trim()) && !customButton && (
                    <p style={{ margin: '-4px 0 12px', fontSize: 13, color: 'var(--warn)' }}>
                      A button needs both a label and a command — fill in the other box, or clear this one.
                    </p>
                  )}

                  <Field
                    label="Image URL"
                    id="broadcast-image"
                    hint="Leave empty to use the bot's own menu picture."
                  >
                    <Input
                      id="broadcast-image"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/poster.jpg"
                    />
                  </Field>
                  {imageUrl.trim() && !imageIsUrl && (
                    <p style={{ margin: '-4px 0 0', fontSize: 13, color: 'var(--warn)' }}>
                      That is not a link, so the bot's own picture will be used instead.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3: preview ── */}
            {step === 2 && (
              <div className="anim-fade-up">
                <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Preview</h2>
                <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 14 }}>
                  How the message will look in a WhatsApp group — picture, text and buttons.
                </p>
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: 20, border: '1px solid var(--line)' }}>
                  <div
                    style={{
                      maxWidth: 460, marginLeft: 'auto', background: 'var(--good-tint)',
                      border: '1px solid var(--line)', borderRadius: '14px 14px 4px 14px',
                      padding: '12px 14px', color: 'var(--ink)', fontSize: 14.5, lineHeight: 1.55,
                      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                    }}
                  >
                    {/* The picture the bot actually attaches: the operator's URL, or
                        the bot's own menu image, which is not in this bundle — hence
                        the stand-in rather than a broken <img>. */}
                    {imageIsUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl.trim()}
                        alt=""
                        style={{ width: '100%', borderRadius: 10, marginBottom: 10, display: 'block' }}
                      />
                    ) : (
                      <div
                        style={{
                          borderRadius: 10, marginBottom: 10, padding: '22px 12px', textAlign: 'center',
                          border: '1px dashed var(--line)', color: 'var(--dim)', fontSize: 13,
                        }}
                      >
                        🖼 The bot&rsquo;s own menu picture
                      </div>
                    )}

                    {message || <span style={{ color: 'var(--dim)' }}>Your message will appear here…</span>}

                    <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                      {(customButton ? [customButton] : DEFAULT_BUTTONS).map((b) => (
                        <div
                          key={b.id}
                          style={{
                            textAlign: 'center', padding: '9px 10px', borderRadius: 8,
                            border: '1px solid var(--line)', background: 'var(--surface)',
                            color: 'var(--brand)', fontSize: 13.5, fontWeight: 600,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {b.text}
                        </div>
                      ))}
                    </div>

                    <div className="mono" style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--dim)', marginTop: 8 }}>
                      {new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} ✓✓
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: confirm ── */}
            {step === 3 && (
              <div className="anim-fade-up">
                <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Confirm</h2>
                <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 14 }}>
                  You are about to send this message to the WhatsApp groups of{' '}
                  <strong className="tnum">{loading ? '…' : targetCount}</strong> connected device{targetCount === 1 ? '' : 's'}.
                </p>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14, whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.55, maxHeight: 220, overflowY: 'auto' }}>
                  {message || '—'}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <Button variant="ghost" onClick={() => setStep(2)}>Cancel</Button>
                  <Button
                    variant="primary"
                    icon={<Icons.Send size={16} />}
                    disabled={loading || !message.trim() || targetCount === 0}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Send Broadcast
                  </Button>
                </div>
                {targetCount === 0 && !loading && (
                  <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--warn)' }}>
                    No active sessions are connected, so there are no groups to deliver to.
                  </p>
                )}
              </div>
            )}

            {/* ── Wizard navigation ── */}
            {step < 3 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                  Back
                </Button>
                <Button variant="primary" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={!canContinue}>
                  Continue
                </Button>
              </div>
            )}
          </Card>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={send}
          loading={sending}
          title="Send this broadcast?"
          description={`This queues a message to the WhatsApp groups of ${targetCount} connected device${targetCount === 1 ? '' : 's'}. It cannot be recalled once the bot sends it.`}
          confirmLabel="Send Broadcast"
        />
    </div>
  );
}
