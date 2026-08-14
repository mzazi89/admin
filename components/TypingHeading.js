'use client';
import { useState, useEffect } from 'react';

// Typewriter heading with an infinite type → pause → delete → pause → retype
// loop and a blinking blue caret.
//
// Props:
//   text         full string to type
//   as           element tag (default 'h1')
//   speed        ms per character while typing (default 45)
//   deleteSpeed  ms per character while deleting (default 22)
//   holdMs       pause when fully typed (default 1800)
//   restMs       pause when empty before retyping (default 500)
//   loop         repeat forever (default true); false = type once and stop
//   delay        ms before the very first character (default 0)
//   highlight    substring to render with a gradient/accent (optional)
//   highlightStyle  style for the highlighted span (default: blue gradient)
//   className, style
export default function TypingHeading({
  text,
  as: Tag = 'h1',
  speed = 45,
  deleteSpeed = 22,
  holdMs = 1800,
  restMs = 500,
  loop = true,
  delay = 0,
  highlight,
  highlightStyle,
  className = '',
  style,
}) {
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | typing | holding | deleting | resting | done

  // Reset the whole cycle whenever the text changes (e.g. step-based headings).
  useEffect(() => {
    setDisplayed('');
    setPhase(delay > 0 ? 'idle' : 'typing');
    if (delay <= 0) return;
    const t = setTimeout(() => setPhase('typing'), delay);
    return () => clearTimeout(t);
  }, [text, delay]);

  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return;

    if (phase === 'typing') {
      if (displayed.length < text.length) {
        const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed);
        return () => clearTimeout(t);
      }
      // fully typed → hold, then delete
      const t = setTimeout(() => setPhase('deleting'), holdMs);
      return () => clearTimeout(t);
    }

    if (phase === 'deleting') {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length - 1)), deleteSpeed);
        return () => clearTimeout(t);
      }
      // fully deleted → rest, then retype (or stop if loop is off)
      if (!loop) {
        setPhase('done');
        return;
      }
      const t = setTimeout(() => setPhase('typing'), restMs);
      return () => clearTimeout(t);
    }
  }, [phase, displayed, text, speed, deleteSpeed, holdMs, restMs, loop]);

  // Render the typed prefix with an accent applied to the highlight substring.
  const renderText = () => {
    if (!highlight) return displayed;
    const idx = text.indexOf(highlight);
    if (idx === -1 || displayed.length <= idx) return displayed;
    const start = Math.min(idx, displayed.length);
    return (
      <>
        {displayed.slice(0, start)}
        <span
          className={highlightStyle ? undefined : 'gradient-text'}
          style={highlightStyle}
        >
          {displayed.slice(start)}
        </span>
      </>
    );
  };

  const active = phase !== 'idle' && phase !== 'done';

  return (
    <Tag className={className} style={style}>
      {renderText()}
      {active && <span className="typing-caret" />}
    </Tag>
  );
}
