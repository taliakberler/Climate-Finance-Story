// ============================================================
//  Shared chart helpers (loaded before the chart scripts)
// ============================================================
(function () {
  "use strict";

  // Shrink an SVG <text> until it fits maxWidth, never below minPx.
  // Clears any inline size first so a resize starts from the CSS size.
  window.fitSvgText = function (sel, maxWidth, minPx) {
    const node = sel.node();
    if (!node) return;
    node.style.fontSize = "";
    let px = parseFloat(window.getComputedStyle(node).fontSize) || 16;
    const floor = minPx || 9;
    while (px > floor && node.getComputedTextLength() > maxWidth) {
      px -= 0.5;
      node.style.fontSize = px + "px";
    }
  };

  // True when the chart container is phone-sized
  window.isNarrowChart = function (W) {
    return W < 520;
  };
})();
