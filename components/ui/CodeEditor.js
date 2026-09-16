'use client';

// MZAZI TECH — a code editor for handler scripts.
//
// WHY IT IS BUILT THIS WAY
// A textarea cannot colour its own text. The technique here is the standard one:
// a syntax-highlighted <pre> renders the same characters behind a <textarea>
// whose text is transparent but whose caret is not. The user edits the real
// textarea; they see the <pre>.
//
// That only works if the two layers agree on their text metrics down to the
// pixel — same font, same size, same line-height, same padding, no wrapping.
// A single discrepancy and the caret drifts away from the glyphs it is supposed
// to be sitting between. So the metrics are declared ONCE as CSS variables on
// .code-editor and consumed by both layers, and no wrapping is allowed at all
// (wrap="off"): with soft wrapping the two layers would have to agree on where
// every line broke, which they cannot be relied upon to do.
//
// The textarea is the scroll container. The <pre> and the gutter are moved with
// a transform on each scroll event rather than being scrolled themselves, so
// there is exactly one set of scrollbars and nothing can get out of step.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { tokenize } from './codeHighlight';

const INDENT = '  ';

// Types that need no <span>. Whitespace is the bulk of any source file; emitting
// an element per space would triple the node count for no visual difference.
const PLAIN_TYPES = new Set(['ws', 'plain']);

// Token type -> class suffix. Kept here rather than in the tokenizer so the
// tokenizer stays free of presentation concerns.
const CLASS_FOR = {
  comment: 'tok-comment',
  string: 'tok-string',
  tplstr: 'tok-string',
  tplstart: 'tok-punct',
  tplend: 'tok-punct',
  number: 'tok-number',
  keyword: 'tok-keyword',
  literal: 'tok-literal',
  builtin: 'tok-builtin',
  fn: 'tok-fn',
  prop: 'tok-prop',
  punct: 'tok-punct',
};

export default function CodeEditor({
  id,
  value = '',
  onChange,
  readOnly = false,
  rows = 18,
  placeholder,
  error,
  hint,
  ariaLabel,
  className = '',
  minHeight,
}) {
  const taRef = useRef(null);
  const preRef = useRef(null);
  const gutterRef = useRef(null);
  const gutterInnerRef = useRef(null);

  const code = value == null ? '' : String(value);
  const lines = useMemo(() => code.split('\n'), [code]);
  const tokens = useMemo(() => tokenize(code), [code]);

  // ─── scroll / caret sync ───────────────────────────────────────────────────
  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    // Written straight to the DOM: this fires on every scroll frame, and a
    // React state update per frame would re-render the whole token list.
    if (preRef.current) {
      preRef.current.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    }
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`;
    }
  }, []);

  /** Highlight the gutter number for the line the caret is on. */
  const markActiveLine = useCallback(() => {
    const ta = taRef.current;
    const inner = gutterInnerRef.current;
    if (!ta || !inner) return;
    let line = 0;
    const pos = ta.selectionStart || 0;
    for (let i = 0; i < pos && i < code.length; i += 1) {
      if (code.charCodeAt(i) === 10) line += 1;
    }
    const prev = inner.querySelector('.code-ln-active');
    if (prev) prev.classList.remove('code-ln-active');
    const row = inner.children[line];
    if (row) row.classList.add('code-ln-active');
  }, [code]);

  // Content changes resize the scroll area, so re-sync after every commit —
  // otherwise deleting the last line leaves the layers offset.
  useLayoutEffect(() => {
    syncScroll();
    markActiveLine();
  }, [code, syncScroll, markActiveLine]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return undefined;
    syncScroll();
    // window resize can change wrapping-independent scroll extents
    window.addEventListener('resize', syncScroll);
    return () => window.removeEventListener('resize', syncScroll);
  }, [syncScroll]);

  // ─── editing ───────────────────────────────────────────────────────────────
  /**
   * Replace a range and tell the parent.
   *
   * setRangeText is used deliberately: assigning `value` would wipe the browser's
   * native undo stack, so Ctrl+Z would stop working in the editor. After the
   * native edit the DOM value is read back and pushed up, so React's controlled
   * value always matches what is on screen and never fights the caret.
   */
  const replaceRange = useCallback(
    (start, end, text, caret) => {
      const ta = taRef.current;
      if (!ta || readOnly) return;
      ta.focus();
      if (typeof ta.setRangeText === 'function') {
        ta.setRangeText(text, start, end, 'end');
      } else {
        // Pre-setRangeText fallback (very old Safari): direct assignment.
        ta.value = code.slice(0, start) + text + code.slice(end);
      }
      if (caret != null && typeof ta.setSelectionRange === 'function') {
        ta.setSelectionRange(caret, caret);
      }
      onChange(ta.value);
    },
    [code, onChange, readOnly]
  );

  const leadingWhitespace = (s) => (s.match(/^[ \t]*/) || [''])[0];
  const lineStartAt = (v, pos) => v.lastIndexOf('\n', pos - 1) + 1;
  const lineEndAt = (v, pos) => {
    const i = v.indexOf('\n', pos);
    return i === -1 ? v.length : i;
  };

  /** Shift+Tab: drop one indent step from every selected line. */
  const dedent = useCallback(
    (v, s, e) => {
      const from = lineStartAt(v, s);
      const to = lineEndAt(v, s === e ? s : e);
      const block = v.slice(from, to);
      let droppedFirst = 0;
      let droppedAll = 0;
      const next = block
        .split('\n')
        .map((line, i) => {
          let rm = 0;
          if (line.startsWith('\t')) rm = 1;
          else while (rm < INDENT.length && line[rm] === ' ') rm += 1;
          if (i === 0) droppedFirst = rm;
          droppedAll += rm;
          return line.slice(rm);
        })
        .join('\n');
      if (next === block) return;
      replaceRange(from, to, next, Math.max(from, s - droppedFirst), Math.max(from, e - droppedAll + droppedFirst));
    },
    [replaceRange]
  );

  /** Tab: insert one indent step, indenting whole lines when a block is selected. */
  const indent = useCallback(
    (v, s, e) => {
      const selected = v.slice(s, e);
      if (s !== e && selected.includes('\n')) {
        const from = lineStartAt(v, s);
        const to = lineEndAt(v, e);
        const block = v.slice(from, to);
        const added = block.split('\n').length * INDENT.length;
        replaceRange(from, to, block.split('\n').map((l) => INDENT + l).join('\n'), s + INDENT.length, e + added);
        return;
      }
      replaceRange(s, e, INDENT, s + INDENT.length);
    },
    [replaceRange]
  );

  const onKeyDown = useCallback(
    (event) => {
      if (readOnly) return;
      const ta = event.currentTarget;
      const v = ta.value;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;

      // Tab must indent, never move focus to the next control. This is the one
      // key a code editor has to intercept.
      if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) dedent(v, s, e);
        else indent(v, s, e);
        return;
      }

      // Enter keeps the current indentation, plus one level when the caret sits
      // at the end of a line that just opened a bracket.
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const from = lineStartAt(v, s);
        const to = lineEndAt(v, s);
        const line = v.slice(from, to);
        const lead = leadingWhitespace(line);
        const before = v.slice(from, s);
        const opensBracket = /[([{]\s*$/.test(before);
        const add = opensBracket ? INDENT : '';
        replaceRange(s, e, `\n${lead}${add}`, s + 1 + lead.length + add.length);
        return;
      }

      // Closing a bracket while only whitespace precedes it pulls that line back
      // one level, so a pasted-in body does not end up drifting rightwards.
      if (event.key === '}' && s === e) {
        const from = lineStartAt(v, s);
        const before = v.slice(from, s);
        if (before !== '' && before.trim() === '') {
          event.preventDefault();
          const rm = before.startsWith('\t') ? 1 : Math.min(INDENT.length, before.length);
          const nextLead = before.slice(rm);
          replaceRange(from, s, `${nextLead}}`, from + nextLead.length + 1);
        }
      }
    },
    [dedent, indent, readOnly, replaceRange]
  );

  // ─── render ────────────────────────────────────────────────────────────────
  const gutterCh = Math.max(2, String(lines.length).length);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div
      className={`code-editor ${className}`}
      style={minHeight ? { height: minHeight } : undefined}
      data-invalid={error ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
      data-lines={rows}
    >
      {/* aria-hidden: these are decorative duplicates of the real value, and
          exposing them would make a screen reader read the code twice. */}
      <div className="code-editor-gutter" aria-hidden="true">
        <div className="code-editor-gutter-inner" ref={gutterRef}>
          <div className="code-editor-gutter-track" ref={gutterInnerRef}>
            {lines.map((_, i) => (
              <div className="code-ln" key={i}>{i + 1}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="code-editor-viewport">
        <pre className="code-editor-pre" ref={preRef} aria-hidden="true">
          {tokens.map((tk, i) =>
            PLAIN_TYPES.has(tk.t)
              ? tk.v
              : <span className={CLASS_FOR[tk.t] || 'tok-plain'} key={i}>{tk.v}</span>
          )}
        </pre>

        <textarea
          id={id}
          ref={taRef}
          className="code-editor-input"
          value={code}
          onChange={(ev) => onChange(ev.target.value)}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          onSelect={markActiveLine}
          onClick={markActiveLine}
          onKeyUp={markActiveLine}
          onFocus={markActiveLine}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          rows={rows}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
        />
      </div>
    </div>
  );
}
