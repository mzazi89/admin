// MZAZI TECH — a small JavaScript tokenizer for the command code editor.
//
// WHY THIS EXISTS RATHER THAN A LIBRARY
// The editor needs syntax colouring. Every off-the-shelf option (prismjs,
// highlight.js, shiki, codemirror, monaco) is a new dependency, and the only
// thing this screen has to colour is a bot command handler — a few lines to a
// few hundred. A dependency would have to be installed, bundled and kept
// current for that, so this stays a self-contained tokenizer instead.
//
// WHY IT IS PLAIN COMMONJS WITH NO React IMPORT
// It is a pure string -> tokens function. React lives in CodeEditor.js, which
// turns these tokens into elements. Keeping this file free of React and of the
// DOM means it can be run and checked on its own under node.
//
// THE ONE INVARIANT THAT MATTERS
// Concatenating every token's `v` MUST reproduce the input byte for byte.
// The editor draws these tokens in a layer behind a real <textarea> holding the
// same text, so a tokenizer that drops or duplicates a character would show the
// user something different from what they are actually editing. Every branch
// below is written to satisfy that, including the unterminated-string and
// unterminated-template cases, where the remainder of the file becomes the
// token rather than being discarded.

'use strict';

// ─── classifications resolved after scanning ─────────────────────────────────

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'default', 'break', 'continue', 'new', 'class',
  'extends', 'super', 'typeof', 'instanceof', 'in', 'of', 'await', 'async',
  'yield', 'try', 'catch', 'finally', 'throw', 'delete', 'void', 'export',
  'import', 'from', 'as', 'static', 'get', 'set',
]);

// Value-like words rather than control flow, so they get their own colour.
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'this']);

// Host objects the bot handlers actually reach for — the WhatsApp socket, the
// reply helpers' module-level companions, node built-ins, and the globals a
// handler is compiled with. Colouring these is most of the readability win on
// this screen, since a handler is mostly calls into them.
const BUILTINS = new Set([
  'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Symbol', 'BigInt', 'Promise', 'Date', 'RegExp', 'Error', 'TypeError',
  'RangeError', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'Intl',
  'globalThis', 'global', 'process', 'Buffer', 'require', 'module', 'exports',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'structuredClone', 'document', 'window', 'fetch',
  'axios', 'fs', 'path', 'crypto',
]);

// ─── scanner ─────────────────────────────────────────────────────────────────
//
// One alternation, tried in precedence order. Comments come before punctuation
// so `//` is never split into two operators, and strings come before
// identifiers so a keyword inside a string stays a string.
//
// The string and block-comment patterns make their closing delimiter OPTIONAL
// (`?`). That is deliberate: while the user is mid-keystroke the code is
// routinely unterminated, and without the `?` the scanner would fall through to
// the punctuation rule and colour the rest of the line as operators.
//
// This is kept as SOURCE rather than as a compiled regex on purpose. A RegExp
// with the `g` flag carries its position in `lastIndex`, and scan() found inside
// pushTemplate() re-enters through tokenize() — so a single shared instance
// would have its position reset by the inner call while the outer loop was
// still mid-iteration, sending the outer loop back to index 0 and round for
// ever. That is not a theoretical hazard: it exhausted the heap. Each scan()
// now compiles its own instance and there is no shared state to clobber.
const MASTER_SOURCE = [
    '(?<block>/\\*[\\s\\S]*?(?:\\*/|$))',
    '(?<line>//[^\\n]*)',
    '(?<tpl>`(?:\\\\[\\s\\S]|[^`\\\\])*`?)',
    "(?<sq>'(?:\\\\[\\s\\S]|[^'\\\\\\n])*'?)",
    '(?<dq>"(?:\\\\[\\s\\S]|[^"\\\\\\n])*"?)',
    // A number is matched WITHOUT word-boundary assertions and with tolerant
    // quantifiers, so a digit run can never fail to match. The earlier version
    // required `\b` at both ends and at least one digit after a base prefix,
    // which meant `10px`, `1e`, `0x`, `3d` and `100abc` matched no alternative
    // at all at the digit — no rule can start on a digit except this one — so
    // the scan stepped over the leading digit and silently dropped it from the
    // token stream. `0x` and `1e` are exactly what a half-typed literal looks
    // like, so that was reachable in the editor.
    '(?<num>0[xX][0-9a-fA-F_]*|0[bB][01_]*|0[oO][0-7_]*|\\d[\\d_]*(?:\\.[\\d_]*)?(?:[eE][+-]?\\d*)?n?)',
    '(?<id>[A-Za-z_$][\\w$]*)',
    '(?<ws>\\s+)',
    // Punctuation must NOT include a quote or a backtick. It runs last and is
    // greedy over non-word characters, so `("` would otherwise be consumed as
    // one punctuation run — swallowing the string's opening delimiter and
    // leaving the scanner to treat everything up to the next quote as an
    // unterminated string. That is the commonest shape on this screen
    // (`mzazireply("...")`), so the delimiters are excluded here and the string
    // rules above get their chance.
    "(?<punct>[^\\s\\w$\"'`]+)",
  ].join('|');

const MAX_HIGHLIGHT = 20000;

/**
 * Expand a template literal into a flat token stream.
 *
 * `${ ... }` interiors are re-scanned as code rather than being left as string
 * text, which is what makes `${prefix}${command}` read like code inside a
 * string — the commonest pattern in these handlers.
 */
function pushTemplate(out, raw) {
  const n = raw.length;
  let buf = raw[0] || ''; // the opening backtick
  let i = 1;

  const flush = () => {
    if (buf) {
      out.push({ t: 'tplstr', v: buf });
      buf = '';
    }
  };

  while (i < n) {
    const c = raw[i];

    // An escaped character cannot close the template.
    if (c === '\\') {
      buf += raw.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === '`') {
      buf += '`';
      i += 1;
      break;
    }
    if (c === '$' && raw[i + 1] === '{') {
      flush();
      out.push({ t: 'tplstart', v: '${' });

      // Walk to the matching brace, skipping over nested strings so a `}` inside
      // one does not close the expression early.
      let depth = 1;
      let j = i + 2;
      let inner = '';
      let closed = false;
      while (j < n) {
        const d = raw[j];
        if (d === '\\') {
          inner += raw.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (d === '{') {
          depth += 1;
        } else if (d === '}') {
          depth -= 1;
          if (depth === 0) {
            closed = true;
            break;
          }
        }
        inner += d;
        j += 1;
      }

      for (const tk of tokenize(inner)) out.push(tk);

      // Only emit the closing brace when it was actually there. Emitting it
      // unconditionally would add a character the user never typed and break the
      // byte-for-byte invariant that keeps the caret aligned with these glyphs.
      if (closed) {
        out.push({ t: 'tplend', v: '}' });
        i = j + 1;
      } else {
        i = n;
      }
      continue;
    }

    buf += c;
    i += 1;
  }

  flush();
}

/** Raw scan: splits the source into lexical chunks, without deciding colour. */
function scan(code) {
  const out = [];
  // Own instance per call — see MASTER_SOURCE above for why this cannot be
  // hoisted to module scope.
  const re = new RegExp(MASTER_SOURCE, 'g');
  let m;
  // Where the previous token ended. `exec` with the g flag SEARCHES FORWARD from
  // lastIndex, so any offset the rules cannot match is stepped over silently —
  // which is how a character went missing before. Comparing against this makes
  // that impossible: whatever the scan skips is still the user's code and is
  // emitted as a plain token rather than dropped.
  let at = 0;
  while ((m = re.exec(code)) !== null) {
    const g = m.groups || {};

    if (m.index > at) out.push({ t: 'plain', v: code.slice(at, m.index) });

    if (g.block !== undefined) out.push({ t: 'comment', v: g.block });
    else if (g.line !== undefined) out.push({ t: 'comment', v: g.line });
    else if (g.tpl !== undefined) pushTemplate(out, g.tpl);
    else if (g.sq !== undefined || g.dq !== undefined) out.push({ t: 'string', v: m[0] });
    else if (g.num !== undefined) out.push({ t: 'number', v: g.num });
    else if (g.id !== undefined) out.push({ t: 'id', v: g.id });
    else if (g.ws !== undefined) out.push({ t: 'ws', v: g.ws });
    else out.push({ t: 'punct', v: g.punct });

    // Advance from the MATCH END rather than reading lastIndex, so a
    // zero-length match (which should be impossible — every pattern consumes at
    // least one character) still leaves `at` where the text actually resumed and
    // the gap-fill above can recover the character instead of losing it.
    at = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }

  // Whatever the rules never reached — e.g. a trailing character at EOF.
  if (at < code.length) out.push({ t: 'plain', v: code.slice(at) });
  return out;
}

const prevSignificant = (toks, i) => {
  for (let k = i - 1; k >= 0; k -= 1) {
    if (toks[k].t !== 'ws') return toks[k];
  }
  return null;
};

const nextSignificant = (toks, i) => {
  for (let k = i + 1; k < toks.length; k += 1) {
    if (toks[k].t !== 'ws') return toks[k];
  }
  return null;
};

/**
 * Tokenize JavaScript into typed chunks for colouring.
 *
 * Types: comment, string, tplstr, tplstart, tplend, number, keyword, literal,
 * builtin, fn, prop, plain, punct, ws.
 *
 * Very large inputs are returned as a single `plain` token: colouring them would
 * be a lot of spans for a screen nobody is reading, and the paste should never
 * be able to lock the page.
 */
function tokenize(code) {
  const src = code == null ? '' : String(code);
  if (!src) return [];
  if (src.length > MAX_HIGHLIGHT) return [{ t: 'plain', v: src }];

  const toks = scan(src);

  for (let i = 0; i < toks.length; i += 1) {
    const tk = toks[i];
    if (tk.t !== 'id') continue;

    if (KEYWORDS.has(tk.v)) {
      tk.t = 'keyword';
      continue;
    }
    if (LITERALS.has(tk.v)) {
      tk.t = 'literal';
      continue;
    }
    if (BUILTINS.has(tk.v)) {
      tk.t = 'builtin';
      continue;
    }

    // Property first, so `obj.method(` is a property rather than a function —
    // which is how editors colour it.
    const prev = prevSignificant(toks, i);
    if (prev && prev.t === 'punct' && (prev.v === '.' || prev.v.endsWith('.'))) {
      tk.t = 'prop';
      continue;
    }

    const next = nextSignificant(toks, i);
    tk.t = next && next.t === 'punct' && next.v.startsWith('(') ? 'fn' : 'plain';
  }

  return toks;
}

module.exports = { tokenize, MAX_HIGHLIGHT };
