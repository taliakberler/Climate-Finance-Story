// ============================================================
//  Shared chart helpers (loaded before the chart scripts)
// ============================================================
(function () {
  "use strict";

  // Width of one uppercase character in the title style, in em, for the
  // widest fallback font (Arial plus 0.05em tracking). Phones have neither
  // Franklin Gothic nor Arial Narrow, and Safari's text measurement does not
  // always match what it draws, so line breaks are decided from this
  // estimate rather than from measuring the text.
  const CHAR_EM = 0.74;

  // .ghg-line-title is 1rem
  function titlePx() {
    return parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  }

  function lineHeight() {
    return Math.round(titlePx() * 1.2);
  }

  // One line if it fits, otherwise two, broken at the space that best
  // balances them.
  function splitTitle(str, maxWidth) {
    const s = str.toUpperCase();
    if (s.length * CHAR_EM * titlePx() <= maxWidth) return [s];
    let best = -1, bestLen = Infinity;
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== " ") continue;
      const len = Math.max(i, s.length - i - 1);
      if (len < bestLen) { bestLen = len; best = i; }
    }
    return best < 0 ? [s] : [s.slice(0, best), s.slice(best + 1)];
  }

  // Extra vertical space a chart must reserve above its content so the
  // longest of its titles fits. Pass every title the chart can show.
  window.titleExtraHeight = function (titles, maxWidth) {
    const lines = Math.max.apply(null, titles.map(function (t) {
      return splitTitle(t, maxWidth).length;
    }));
    return (lines - 1) * lineHeight();
  };

  // Write a title into an SVG <text>, wrapping to two lines when needed.
  // baseY is the baseline of the LAST line, so a one-line title sits where
  // it always did and a two-line title grows upward into the reserved space.
  window.setSvgTitle = function (sel, str, maxWidth, baseY) {
    const node = sel.node();
    if (!node) return;
    const lines = splitTitle(str, maxWidth);
    const lh = lineHeight();
    const x = sel.attr("x");
    node.style.fontSize = "";
    sel.text(null).attr("y", baseY - (lines.length - 1) * lh);
    lines.forEach(function (line, i) {
      sel.append("tspan").attr("x", x).attr("dy", i ? lh : 0).text(line);
    });

    // Safety net: shrink until every line fits by both the estimate and
    // the browser's own measurement.
    const longest = Math.max.apply(null, lines.map(function (l) { return l.length; }));
    const tspans = Array.from(node.querySelectorAll("tspan"));
    let px = titlePx();
    function widest() {
      return Math.max(longest * CHAR_EM * px, Math.max.apply(null, tspans.map(function (t) {
        return t.getComputedTextLength();
      })));
    }
    while (px > 10 && widest() > maxWidth) {
      px -= 0.5;
      node.style.fontSize = px + "px";
    }
  };

  // True when the chart container is phone-sized
  window.isNarrowChart = function (W) {
    return W < 520;
  };
})();
