// MZAZI TECH — find and replace for the code editor.
//
// Kept free of React and of the DOM, like codeHighlight.js, so the parts that are
// easy to get subtly wrong — offsets, case handling, and what a replacement does
// with a `$` in it — can be exercised directly in node against real handler code.
//
// THE QUERY IS NEVER A PATTERN
// A search box that treats input as a regex is a trap: someone searching for
// `a+b`, `(x)` or a lone backslash gets a different match, a syntax error, or a
// throw. Everything here escapes the query first, so it is matched literally.

'use strict';

// Searching a single letter in one of the large menu commands produces thousands
// of hits, and every hit becomes an element in the coloured layer. Finding them is
// cheap; rendering them is not. The cap keeps a stray keystroke from building tens
// of thousands of nodes on a phone. Callers can tell they hit it by comparing the
// count to MAX_MATCHES.
const MAX_MATCHES = 2000;

/** Escape every character that would otherwise be read as a pattern. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every place `query` occurs in `code`, in document order, non-overlapping.
 *
 * Indices are into `code` as-is. Deliberately NOT done by lower-casing both sides
 * and using indexOf: for a few characters (Turkish İ, for one) toLowerCase()
 * changes the string's LENGTH, which would shift every offset after it and put the
 * highlights — and the replacements — in the wrong place. A regex with the `i`
 * flag reports positions in the original string, which is what the rest of this
 * module relies on.
 *
 * @returns {Array<{start:number,end:number}>} at most MAX_MATCHES entries
 */
function findMatches(code, query, caseSensitive) {
  if (typeof code !== 'string' || typeof query !== 'string' || query === '') return [];

  const re = new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi');
  const out = [];
  let m;
  while ((m = re.exec(code)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
    if (out.length >= MAX_MATCHES) break;
    // A zero-length match cannot happen for a non-empty literal query, but a stuck
    // lastIndex would hang the tab, so advance defensively.
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

/**
 * Split one token into the pieces needed to draw it, marking which pieces are
 * inside a match.
 *
 * The tokenizer hands back tokens with no offsets, but they tile the source
 * exactly (codeHighlight.js guarantees that byte for byte), so a running total is
 * all that is needed to place them. A piece is `{ text, hit }` where `hit` is the
 * index of the match it belongs to, or null.
 *
 * A match that spans two tokens simply produces a piece in each; the caller draws
 * both with the same hit index, so a match crossing a token boundary still reads
 * as one highlight.
 *
 * @param {string} value     the token's text
 * @param {number} start     the token's absolute offset in the document
 * @param {Array}  matches   from findMatches()
 */
function tokenPieces(value, start, matches) {
  const text = typeof value === 'string' ? value : '';
  const end = start + text.length;
  const pieces = [];
  let cursor = start;

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (match.end <= start) continue;
    if (match.start >= end) break;

    const from = Math.max(match.start, start);
    const to = Math.min(match.end, end);
    if (from > cursor) pieces.push({ text: text.slice(cursor - start, from - start), hit: null });
    pieces.push({ text: text.slice(from - start, to - start), hit: i });
    cursor = to;
  }

  if (cursor < end) pieces.push({ text: text.slice(cursor - start), hit: null });
  return pieces.length ? pieces : [{ text, hit: null }];
}

/**
 * Replace every occurrence.
 *
 * The replacement is passed as a FUNCTION to String.replace on purpose: with a
 * string replacement, `$&`, `$1` and `$'` inside it are special and a user
 * replacing a word with `$&` or `price $1` would get something they never typed.
 * A function replacer is taken literally.
 */
function replaceAll(code, query, replacement, caseSensitive) {
  if (typeof code !== 'string' || typeof query !== 'string' || query === '') return code;
  const re = new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi');
  return code.replace(re, () => (typeof replacement === 'string' ? replacement : ''));
}

/** How many occurrences a replace-all would change, for reporting it back. */
function countMatches(code, query, caseSensitive) {
  if (typeof code !== 'string' || typeof query !== 'string' || query === '') return 0;
  const re = new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi');
  let n = 0;
  let m;
  while ((m = re.exec(code)) !== null) {
    n += 1;
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return n;
}

/** Step through matches, wrapping at both ends. */
function stepIndex(current, count, delta) {
  if (count <= 0) return -1;
  return ((current + delta) % count + count) % count;
}

module.exports = {
  findMatches,
  tokenPieces,
  replaceAll,
  countMatches,
  stepIndex,
  escapeRegExp,
  MAX_MATCHES,
};
