/*
 * App tiles: building the dock + grid from what a platform adapter discovered, and the dock edits
 * TV Home offers on the TV (Add to dock, Replace, Move left/right, Remove, Hide).
 *
 * An app, as adapters report it:
 *   { key: "stable id used in preferences", name: "Netflix", platformId: "<id the platform launches>",
 *     iconUrl?: "path or URL", color?: "#RRGGBB", source: "discovered" | "catalogue" | "preview" }
 *
 * CATALOGUE only styles tiles (brand colour) and, on webOS, lists candidate app IDs to probe with the
 * documented getAppLoadStatus method. The webOS IDs are community-sourced, not from LG documentation;
 * each one is only shown once the TV itself confirms the app is installed.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; root.TVV.apps = mod; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CATALOGUE = [
    { key: "netflix", name: "Netflix", bg: "#E50914", fg: "#FFFFFF", match: ["netflix"], webos: "netflix" },
    { key: "youtube", name: "YouTube", bg: "#FF0033", fg: "#FFFFFF", match: ["youtube"], webos: "youtube.leanback.v4" },
    { key: "prime", name: "Prime Video", bg: "#1A98FF", fg: "#FFFFFF", match: ["prime video", "amazon"], webos: "amazon" },
    { key: "disney", name: "Disney+", bg: "#0E3D8C", fg: "#FFFFFF", match: ["disney"], webos: "com.disney.disneyplus-prod" },
    { key: "spotify", name: "Spotify", bg: "#1ED760", fg: "#000000", match: ["spotify"], webos: "spotify-beehive" },
    { key: "appletv", name: "Apple TV", bg: "#1C1C1E", fg: "#FFFFFF", match: ["apple tv"], webos: "com.apple.appletv" },
    { key: "showmax", name: "Showmax", bg: "#E5005B", fg: "#FFFFFF", match: ["showmax"], webos: null },
    { key: "dstv", name: "DStv", bg: "#0B6CB5", fg: "#FFFFFF", match: ["dstv"], webos: null },
    { key: "twitch", name: "Twitch", bg: "#9146FF", fg: "#FFFFFF", match: ["twitch"], webos: null },
    { key: "plex", name: "Plex", bg: "#282A2D", fg: "#E5A00D", match: ["plex"], webos: null },
    { key: "browser", name: "Web Browser", bg: "#2B3A55", fg: "#FFFFFF", match: ["browser", "internet"], webos: "com.webos.app.browser" }
  ];

  /** Apps put in the dock the first time, in this order, when present (TV Home's default dock order). */
  var DEFAULT_DOCK_ORDER = ["youtube", "netflix", "prime", "spotify", "disney", "showmax", "dstv", "appletv"];

  var FALLBACK_COLORS = ["#7C5CFF", "#00A8E8", "#FF6B35", "#2EC4B6", "#E63946", "#F4A261", "#8AC926", "#C77DFF"];

  function lower(s) { return String(s || "").toLowerCase(); }

  /** The catalogue entry an app looks like (by name or id), or null. */
  function styleFor(app) {
    var hay = lower(app.name) + " " + lower(app.platformId) + " " + lower(app.key);
    for (var i = 0; i < CATALOGUE.length; i++) {
      var c = CATALOGUE[i];
      for (var j = 0; j < c.match.length; j++) if (hay.indexOf(c.match[j]) >= 0) return c;
    }
    return null;
  }

  function hashColor(key) {
    var h = 0, s = String(key || "");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
  }

  /** Colour used for the tile background and the ambient glow behind the dock. */
  function colorOf(app) {
    if (app.color && /^#[0-9a-fA-F]{6}$/.test(app.color)) return app.color;
    var c = styleFor(app);
    return c ? c.bg : hashColor(app.key);
  }

  function textColorOf(app) {
    var c = styleFor(app);
    return c ? c.fg : "#FFFFFF";
  }

  function byName(a, b) {
    var x = lower(a.name), y = lower(b.name);
    return x < y ? -1 : (x > y ? 1 : 0);
  }

  function find(apps, key) {
    for (var i = 0; i < apps.length; i++) if (apps[i].key === key) return apps[i];
    return null;
  }

  /** Keys for the first-run dock: known streaming apps first, then alphabetical, up to `columns`. */
  function initialDock(apps, columns) {
    var picked = [];
    for (var i = 0; i < DEFAULT_DOCK_ORDER.length && picked.length < columns; i++) {
      for (var j = 0; j < apps.length; j++) {
        var c = styleFor(apps[j]);
        if (c && c.key === DEFAULT_DOCK_ORDER[i] && picked.indexOf(apps[j].key) < 0) { picked.push(apps[j].key); break; }
      }
    }
    var rest = apps.slice().sort(byName);
    for (var k = 0; k < rest.length && picked.length < columns; k++) {
      if (picked.indexOf(rest[k].key) < 0) picked.push(rest[k].key);
    }
    return picked;
  }

  /**
   * @returns {tiles: app[] (dock first), dockCount, pinned: {key: true}}
   * The dock shows pinned apps in order, then fills its remaining slots with the next apps so the row
   * is complete, as TV Home's dock always has `columns` slots.
   */
  function build(apps, prefs) {
    var cols = prefs.columns;
    var visible = [];
    for (var i = 0; i < apps.length; i++) if (prefs.hidden_apps.indexOf(apps[i].key) < 0) visible.push(apps[i]);
    var dock = [], pinned = {};
    for (var d = 0; d < prefs.dock_apps.length && dock.length < cols; d++) {
      var a = find(visible, prefs.dock_apps[d]);
      if (a && dock.indexOf(a) < 0) { dock.push(a); pinned[a.key] = true; }
    }
    var rest = [];
    for (var r = 0; r < visible.length; r++) if (dock.indexOf(visible[r]) < 0) rest.push(visible[r]);
    rest.sort(byName);
    while (dock.length < cols && rest.length) dock.push(rest.shift());
    return { tiles: dock.concat(rest), dockCount: dock.length, pinned: pinned };
  }

  function copyPrefs(prefs) {
    var out = {};
    for (var k in prefs) if (Object.prototype.hasOwnProperty.call(prefs, k)) out[k] = prefs[k];
    out.dock_apps = prefs.dock_apps.slice();
    out.hidden_apps = prefs.hidden_apps.slice();
    out.dock_initialized = true;
    return out;
  }

  /** Pins an app to the dock. Returns {prefs, needsReplace} — needsReplace when the dock is full. */
  function addToDock(prefs, key) {
    if (prefs.dock_apps.indexOf(key) >= 0) return { prefs: prefs, needsReplace: false };
    if (prefs.dock_apps.length >= prefs.columns) return { prefs: prefs, needsReplace: true };
    var p = copyPrefs(prefs);
    p.dock_apps.push(key);
    return { prefs: p, needsReplace: false };
  }

  function replaceInDock(prefs, oldKey, newKey) {
    var p = copyPrefs(prefs);
    var at = p.dock_apps.indexOf(oldKey);
    var existing = p.dock_apps.indexOf(newKey);
    if (at < 0) return p;
    if (existing >= 0) p.dock_apps.splice(existing, 1);
    at = p.dock_apps.indexOf(oldKey);
    p.dock_apps[at] = newKey;
    return p;
  }

  function removeFromDock(prefs, key) {
    var p = copyPrefs(prefs);
    var at = p.dock_apps.indexOf(key);
    if (at >= 0) p.dock_apps.splice(at, 1);
    return p;
  }

  /** Moves a pinned app one place left (-1) or right (+1) within the pinned apps. */
  function moveInDock(prefs, key, delta) {
    var p = copyPrefs(prefs);
    var at = p.dock_apps.indexOf(key);
    var to = at + delta;
    if (at < 0 || to < 0 || to >= p.dock_apps.length) return p;
    p.dock_apps.splice(at, 1);
    p.dock_apps.splice(to, 0, key);
    return p;
  }

  function hide(prefs, key) {
    var p = removeFromDock(prefs, key);
    if (p.hidden_apps.indexOf(key) < 0) p.hidden_apps.push(key);
    return p;
  }

  function unhideAll(prefs) {
    var p = copyPrefs(prefs);
    p.hidden_apps = [];
    return p;
  }

  return {
    CATALOGUE: CATALOGUE, DEFAULT_DOCK_ORDER: DEFAULT_DOCK_ORDER,
    styleFor: styleFor, colorOf: colorOf, textColorOf: textColorOf, initialDock: initialDock, build: build,
    addToDock: addToDock, replaceInDock: replaceInDock, removeFromDock: removeFromDock,
    moveInDock: moveInDock, hide: hide, unhideAll: unhideAll
  };
});
