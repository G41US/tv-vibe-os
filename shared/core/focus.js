/*
 * Focus model for the home screen, as a pure function so it can be unit-tested.
 *
 * Mirrors TV Home (tv-vibehack MainActivity.onTileVerticalKey):
 *   - Left on the first tile of a row and Right on the last one are swallowed (no wrapping).
 *   - Up from the dock row goes to the top bar (Inputs / Network / Settings pills).
 *   - Down on the last grid row stays put; Down to a short last row lands on its last tile.
 *   - The dock is the first `columns` tiles.
 * Added for web TVs: Back from the grid returns to the dock; Back from the top bar returns to the dock;
 * Back on the dock reports `atRoot` so the UI can offer to leave the app.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; root.TVV.focus = mod; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function initial(layout) {
    return { zone: layout && layout.tileCount > 0 ? "tiles" : "top", tile: 0, top: 0, lastDock: 0 };
  }

  /** Clamps a state to a (possibly changed) layout, e.g. after apps were added/removed or columns changed. */
  function fit(state, layout) {
    var s = { zone: state.zone, tile: state.tile, top: state.top, lastDock: state.lastDock };
    var cols = Math.max(1, layout.columns);
    if (layout.tileCount <= 0) { s.zone = "top"; s.tile = 0; }
    else s.tile = clamp(s.tile, 0, layout.tileCount - 1);
    s.top = clamp(s.top, 0, Math.max(0, layout.topCount - 1));
    s.lastDock = clamp(s.lastDock, 0, Math.max(0, Math.min(cols, layout.tileCount) - 1));
    if (s.zone === "top" && layout.topCount <= 0 && layout.tileCount > 0) s.zone = "tiles";
    return s;
  }

  /**
   * @param state  {zone:"top"|"tiles", tile, top, lastDock}
   * @param key    "up"|"down"|"left"|"right"|"back"
   * @param layout {columns, tileCount, topCount}
   * @returns {state, handled, atRoot} — handled=false means the key should fall through.
   */
  function move(state, key, layout) {
    var s = fit(state, layout);
    var cols = Math.max(1, layout.columns);
    var count = layout.tileCount;
    var out = { state: s, handled: true, atRoot: false };

    if (s.zone === "top") {
      if (key === "left") s.top = Math.max(0, s.top - 1);
      else if (key === "right") s.top = Math.min(layout.topCount - 1, s.top + 1);
      else if (key === "down" || key === "back") {
        if (count > 0) { s.zone = "tiles"; s.tile = s.lastDock; }
      } else if (key !== "up") out.handled = false;
      return out;
    }

    var pos = s.tile;
    var col = pos % cols;
    if (pos < cols) s.lastDock = pos; // remember the dock tile we leave, for Back and for Down from the top bar
    if (key === "left") {
      if (col > 0) s.tile = pos - 1;
    } else if (key === "right") {
      if (col < cols - 1 && pos < count - 1) s.tile = pos + 1;
    } else if (key === "up") {
      if (pos < cols) {
        if (layout.topCount > 0) { s.zone = "top"; s.lastDock = pos; }
      } else s.tile = pos - cols;
    } else if (key === "down") {
      var lastRowStart = Math.floor((count - 1) / cols) * cols;
      if (pos < lastRowStart) s.tile = Math.min(pos + cols, count - 1);
    } else if (key === "back") {
      if (pos >= cols) s.tile = Math.min(s.lastDock, count - 1);
      else out.atRoot = true;
    } else {
      out.handled = false;
    }
    if (s.zone === "tiles" && s.tile < cols) s.lastDock = s.tile;
    return out;
  }

  /** Row index of a tile (0 = dock). */
  function rowOf(tile, columns) { return Math.floor(tile / Math.max(1, columns)); }

  return { initial: initial, fit: fit, move: move, rowOf: rowOf };
});
