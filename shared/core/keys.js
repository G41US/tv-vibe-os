/*
 * Remote-control key normalisation.
 *
 * Every platform sends DOM keydown events, but Back and colour keys use different codes:
 *   - Samsung Tizen: Return = 10009, Exit = 10182, Tools = 10135 (Back must not be registered; it is a
 *     mandatory key). Colour keys 403-406 need tizen.tvinputdevice.registerKey().
 *   - LG webOS: Back = 461 (with "disableBackHistoryAPI": true in appinfo.json), colour keys 403-406.
 *   - Browsers / VIDAA: Backspace (8) or Escape (27) for Back.
 * Arrow keys and Enter are 37-40 and 13 everywhere.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; root.TVV.keys = mod; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BY_CODE = {
    37: "left", 38: "up", 39: "right", 40: "down",
    13: "ok",
    8: "back", 27: "back", 461: "back", 10009: "back",
    10182: "exit",
    403: "red", 404: "green", 405: "yellow", 406: "blue",
    93: "menu", 10135: "menu",
    457: "info"
  };

  var BY_NAME = {
    ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down",
    Left: "left", Up: "up", Right: "right", Down: "down",
    Enter: "ok", Accept: "ok",
    Backspace: "back", Escape: "back", Esc: "back", GoBack: "back", BrowserBack: "back",
    ContextMenu: "menu", Info: "info",
    ColorF0Red: "red", ColorF1Green: "green", ColorF2Yellow: "yellow", ColorF3Blue: "blue"
  };

  /** Returns a logical key name for a keydown event, or null when the key is not one we handle. */
  function normalize(event) {
    if (!event) return null;
    var code = typeof event.keyCode === "number" && event.keyCode ? event.keyCode : event.which;
    if (code && BY_CODE[code]) return BY_CODE[code];
    if (event.key && BY_NAME[event.key]) return BY_NAME[event.key];
    return null;
  }

  /** Optional keys a platform adapter may ask to register (Tizen needs explicit registration). */
  var OPTIONAL_TIZEN_KEYS = ["ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "Tools", "Info", "Exit"];

  /** Milliseconds OK must be held to count as a long press (opens the tile menu, as on TV Home). */
  var LONG_PRESS_MS = 600;

  return { normalize: normalize, OPTIONAL_TIZEN_KEYS: OPTIONAL_TIZEN_KEYS, LONG_PRESS_MS: LONG_PRESS_MS, BY_CODE: BY_CODE };
});
