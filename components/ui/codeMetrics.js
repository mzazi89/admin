// MZAZI TECH — the one measurement the code editor's three layers agree on.
//
// WHY THIS IS ITS OWN MODULE
// CodeEditor draws the code three times (a coloured <pre>, an invisible copy in
// the gutter, the real textarea) and they only stay aligned if all three wrap at
// the same column. That depends entirely on this number, and this number is
// arithmetic — exactly the kind of arithmetic that gets "fixed" in one place and
// left stale in the other. Keeping it here means the component and the render
// harness that checks it cannot drift apart.
//
// Kept free of React so it can be exercised on its own.

'use strict';

/**
 * The width, in CSS pixels, at which the code layers must wrap.
 *
 * Returns the element's PADDING box — not its content box.
 *
 * That distinction is the whole point. The <pre> and the gutter cell are handed
 * this value as their `width` and apply the same horizontal padding of their own
 * (box-sizing: border-box), so their content boxes come out equal to the
 * textarea's. Subtracting the padding HERE as well double-counts it: the
 * coloured layer ends up two paddings narrower than the control, wraps a row
 * earlier, and from that point every coloured line sits a row away from the
 * caret it belongs to.
 *
 * The scrollbar is removed because it comes out of the control's own box, and
 * the other two layers have none. It is taken as the integer difference between
 * the border box and the padding box, where rounding cannot bite.
 *
 * The value is deliberately NOT el.clientWidth: that is a WebIDL long and is
 * rounded to whole pixels, which on a fractional layout is enough to move a wrap
 * point on a line that lands near the boundary. getBoundingClientRect keeps the
 * fraction.
 *
 * @param {HTMLElement|null} el the textarea
 * @returns {number} width in px, or 0 if it cannot be measured
 */
function measureWrapWidth(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return 0;
  const cs = getComputedStyle(el);
  const border = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  const scrollbar = el.offsetWidth - el.clientWidth;
  const width = el.getBoundingClientRect().width - (border || 0) - (scrollbar || 0);
  return width > 0 ? width : 0;
}

module.exports = { measureWrapWidth };
