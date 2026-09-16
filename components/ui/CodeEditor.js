'use client';

// MZAZI TECH — a code editor for handler scripts.
//
// WHY IT IS BUILT THIS WAY
// A textarea cannot colour its own text. The technique here is the standard one:
// a syntax-highlighted <pre> renders the same characters behind a <textarea>
// whose text is transparent but whose caret is not. The user edits the real
// textarea; they see the <pre>.
//
// That only works if the layers agree on where every line BREAKS as well as on
// their text metrics — same font, same size, same line-height, same padding, and
// the same wrap width. A single discrepancy and the caret drifts away from the
// glyphs it is supposed to be sitting between. So the metrics and the wrap rules
// are declared ONCE and applied to every layer, and the wrap width is published
// as a CSS variable measured from the textarea's own content box (see
// syncScroll): a desktop scrollbar takes width out of that box, and without the
// measurement the <pre> would break its lines at a different column than the
// control it sits behind.
//
// Lines soft-wrap, so code is never pushed off the right edge.
//
// The textarea is the scroll container. The <pre> and the gutter are moved with
// a transform on each scroll event rather than being scrolled themselves, so
// there is exactly one set of scrollbars and nothing can get out of step.
//
// ── THE GUTTER, AND WHY WRAPPING IS THE HARD PART ──────────────────────────
// One logical line can occupy several visual rows, but it must still get exactly
// one number. So each gutter cell holds an invisible copy of its own line as well
// as the number, laid out at the same wrap width as the code — the browser wraps
// that copy exactly as it wraps the real line, so the cell grows to the same
// height and the numbers stay in step with the code no matter how it spills.
// Nothing here re-implements the line-breaking rules; the browser's own layout is
// what keeps the two in agreement.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { tokenize } from './codeHighlight';
import { measureWrapWidth } from './codeMetrics';

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
  const containerRef = useRef(null);
  const taRef = useRef(null);
  const preRef = useRef(null);
  const gutterRef = useRef(null);
  const gutterInnerRef = useRef(null);
  // Last published wrap width, so the observer-driven re-measure below cannot
  // rewrite an unchanged value (see syncScroll).
  const lastWrapW = useRef(0);

  const code = value == null ? '' : String(value);
  const lines = useMemo(() => code.split('\n'), [code]);
  const tokens = useMemo(() => tokenize(code), [code]);

  // ─── scroll / wrap-width sync ──────────────────────────────────────────────
  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;

    // ── Publish the width every layer must wrap at ──────────────────────────
    // A padding-box width, measured fractionally — see codeMetrics.js for why it
    // is the padding box and why it is not clientWidth.
    const box = containerRef.current;
    if (box) {
      const width = measureWrapWidth(ta);
      // Only written when it actually changed: this also runs from a
      // ResizeObserver, and rewriting an unchanged value would invite a
      // measure → write → measure loop.
      if (width > 0 && Math.abs(width - lastWrapW.current) > 0.01) {
        lastWrapW.current = width;
        box.style.setProperty('--code-wrap-w', `${width}px`);
      }
    }

    // Written straight to the DOM: this fires on every scroll frame, and a
    // React state update per frame would re-render the whole token list. The
    // horizontal term is always 0 now that lines wrap, and is kept so that
    // going back to horizontal scrolling would need no change here.
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

  // Everything that can move the wrap width without the code changing.
  useEffect(() => {
    const ta = taRef.current;
    const box = containerRef.current;
    if (!ta) return undefined;
    syncScroll();

    window.addEventListener('resize', syncScroll);

    // A window resize is NOT the only way this box changes width. The gutter is
    // sized in `ch`, so when the mono webfont arrives the gutter gets wider,
    // the viewport gets narrower, and the wrap width moves with it — after the
    // one measurement useLayoutEffect already did. Anything that resizes the
    // dialog without resizing the window (a modal, an inspector panel, a
    // rotate) has the same effect. Both are covered here rather than left to a
    // stale value, which would leave the layers consistent with each other but
    // both wrapping at the wrong column.
    let observer;
    if (box && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncScroll);
      observer.observe(box);
    }

    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    let alive = true;
    if (fonts) {
      const onFontsLoaded = () => { if (alive) syncScroll(); };
      if (fonts.ready && typeof fonts.ready.then === 'function') {
        fonts.ready.then(onFontsLoaded).catch(() => {});
      }
      if (typeof fonts.addEventListener === 'function') {
        fonts.addEventListener('loadingdone', onFontsLoaded);
      }
      return () => {
        alive = false;
        window.removeEventListener('resize', syncScroll);
        if (observer) observer.disconnect();
        if (typeof fonts.removeEventListener === 'function') {
          fonts.removeEventListener('loadingdone', onFontsLoaded);
        }
      };
    }

    return () => {
      alive = false;
      window.removeEventListener('resize', syncScroll);
      if (observer) observer.disconnect();
    };
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
      ref={containerRef}
      style={{
        // How wide the number column is, in mono characters. The numbers are
        // what set it, so the measure has to be taken in the mono font — which
        // is why .code-editor-gutter declares it. A command with 4-digit line
        // counts gets a wider column than one with 2.
        '--code-gutter-ch': gutterCh,
        ...(minHeight ? { height: minHeight } : null),
      }}
      data-invalid={error ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
      data-lines={rows}
    >
      {/* aria-hidden: these are decorative duplicates of the real value, and
          exposing them would make a screen reader read the code twice. */}
      <div className="code-editor-gutter" aria-hidden="true">
        <div className="code-editor-gutter-inner" ref={gutterRef}>
          <div className="code-editor-gutter-track" ref={gutterInnerRef}>
            {/* One cell per LOGICAL line: the number, plus an invisible copy of
                that line. The copy is what gives the cell the height of the
                line's wrapped rows, which is what keeps the numbers beside the
                right code when a line spills onto several rows. An empty line
                needs a zero-width space or its cell would have no height. */}
            {lines.map((line, i) => (
              <div className="code-ln-cell" key={i}>
                <span className="code-ln-num">{i + 1}</span>
                <span className="code-ln-mirror">{line || '\u200b'}</span>
              </div>
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
          // Soft wrap: a long line continues on the next row instead of
          // scrolling sideways. The <pre> behind this control wraps identically
          // — same width, same rules — which is what keeps the caret on the
          // right glyph. See the note at the top of this file.
          wrap="soft"
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
