/*
 * Launcher preferences: defaults, validation, migration and storage with recovery.
 *
 * Keys follow TV Home's config.json (tv-vibehack Config.java) so a TV Home theme file means the same
 * thing here: dock_apps, hidden_apps, columns, rows_below_dock, background_color, wallpaper.
 * Values are clamped exactly like Config.java where the meaning carries over.
 *
 * Storage is anything with getItem/setItem (window.localStorage on all three TV platforms). If storage
 * throws or holds unreadable data, the launcher still starts with defaults and keeps the unreadable
 * copy under BACKUP_KEY so it can be inspected — the "failed update recovery" path for settings.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; root.TVV.prefs = mod; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KEY = "tvvibe.prefs";
  var BACKUP_KEY = "tvvibe.prefs.unreadable";
  var SCHEMA_VERSION = 2;

  /** Built-in wallpapers, the same five images TV Home ships, plus plain black. */
  var WALLPAPERS = [
    { key: "black", name: "Black" },
    { key: "aurora", name: "Aurora", file: "wallpapers/aurora.jpg" },
    { key: "midnight", name: "Midnight", file: "wallpapers/midnight.jpg" },
    { key: "ember", name: "Ember", file: "wallpapers/ember.jpg" },
    { key: "ocean", name: "Ocean", file: "wallpapers/ocean.jpg" },
    { key: "dusk", name: "Dusk", file: "wallpapers/dusk.jpg" }
  ];

  /** Theme presets ported from tv-vibehack/themes/*. Applying one overlays only the keys it sets. */
  var PRESETS = [
    { key: "default", name: "Default", values: { columns: 4, rows_below_dock: 0, background_color: "#000000", wallpaper: "black" } },
    { key: "aurora", name: "Aurora", values: { background_color: "#070A14", wallpaper: "aurora" } },
    { key: "six-columns", name: "Six columns", values: { columns: 6, rows_below_dock: 1, background_color: "#000000", wallpaper: "black" } }
  ];

  function defaults() {
    return {
      schemaVersion: SCHEMA_VERSION,
      dock_apps: [],          // app keys pinned to the dock, in order (empty = first apps found)
      hidden_apps: [],        // app keys never shown as tiles
      columns: 4,             // tiles per row; the dock always has this many slots
      rows_below_dock: 0,     // grid rows left visible under the dock
      background_color: "#070A14",
      wallpaper: "aurora",
      clock_24h: null,        // null = follow the TV's locale
      dock_initialized: false // becomes true once the dock was filled the first time
    };
  }

  function isObj(v) { return v !== null && typeof v === "object" && !(v instanceof Array); }

  function stringList(v, fallback) {
    if (!(v instanceof Array)) return fallback;
    var out = [];
    for (var i = 0; i < v.length; i++) {
      if (typeof v[i] === "string" && v[i].length > 0 && v[i].length < 256 && out.indexOf(v[i]) < 0) out.push(v[i]);
    }
    return out;
  }

  function integer(v, fallback, lo, hi) {
    if (typeof v !== "number" || !isFinite(v) || Math.floor(v) !== v) return fallback;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function color(v, fallback) {
    return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback;
  }

  function wallpaperKey(v, fallback) {
    if (v === false) return "black"; // TV Home theme files use "wallpaper": false for none
    if (typeof v !== "string") return fallback;
    for (var i = 0; i < WALLPAPERS.length; i++) if (WALLPAPERS[i].key === v) return v;
    return fallback;
  }

  /**
   * Returns a complete, valid preferences object built from `input` over `base` (defaults when omitted).
   * Unknown keys are dropped, bad values fall back to the base value.
   */
  function validate(input, base) {
    var d = base ? validate(base) : defaults();
    if (!isObj(input)) return d;
    return {
      schemaVersion: SCHEMA_VERSION,
      dock_apps: stringList(input.dock_apps, d.dock_apps),
      hidden_apps: stringList(input.hidden_apps, d.hidden_apps),
      // Config.java allows 1-8; on a 1080p web TV 3-7 keeps tiles readable and focusable.
      columns: integer(input.columns, d.columns, 3, 7),
      rows_below_dock: integer(input.rows_below_dock, d.rows_below_dock, 0, 3),
      background_color: color(input.background_color, d.background_color),
      wallpaper: wallpaperKey(input.wallpaper, d.wallpaper),
      clock_24h: input.clock_24h === true || input.clock_24h === false ? input.clock_24h :
        (input.clock_24h === null ? null : d.clock_24h),
      dock_initialized: typeof input.dock_initialized === "boolean" ? input.dock_initialized : d.dock_initialized
    };
  }

  /** Upgrades older saved shapes. v1 (the tv-vibe-os prototype) stored nothing useful, so it maps to defaults. */
  function migrate(raw) {
    if (!isObj(raw)) return defaults();
    var v = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1;
    var copy = {};
    for (var k in raw) if (Object.prototype.hasOwnProperty.call(raw, k)) copy[k] = raw[k];
    if (v < 2) {
      // v1 had a boolean "wallpaper" like TV Home theme files; keep its meaning.
      if (copy.wallpaper === true) copy.wallpaper = "aurora";
    }
    return validate(copy);
  }

  /** In-memory storage used when the platform's storage is missing or throws. */
  function memoryStorage() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    };
  }

  /**
   * Loads preferences. Never throws.
   * @returns {prefs, recovered: boolean, persistent: boolean, error?: string}
   */
  function load(storage) {
    var raw;
    try {
      raw = storage ? storage.getItem(KEY) : null;
    } catch (e) {
      return { prefs: defaults(), recovered: false, persistent: false, error: "storage unavailable: " + e };
    }
    if (raw === null || raw === undefined || raw === "") {
      return { prefs: defaults(), recovered: false, persistent: !!storage };
    }
    try {
      return { prefs: migrate(JSON.parse(raw)), recovered: false, persistent: true };
    } catch (e) {
      try { storage.setItem(BACKUP_KEY, raw); } catch (ignored) { /* keep going */ }
      return { prefs: defaults(), recovered: true, persistent: true, error: "unreadable preferences reset: " + e };
    }
  }

  /** Saves validated preferences. Returns true on success, false when storage refused. */
  function save(storage, prefs) {
    if (!storage) return false;
    try {
      storage.setItem(KEY, JSON.stringify(validate(prefs)));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Overlays a TV Home theme config.json (or a preset's values) onto the current preferences. */
  function applyTheme(prefs, themeJson) {
    var merged = {};
    var k;
    for (k in prefs) if (Object.prototype.hasOwnProperty.call(prefs, k)) merged[k] = prefs[k];
    if (isObj(themeJson)) {
      for (k in themeJson) if (Object.prototype.hasOwnProperty.call(themeJson, k)) merged[k] = themeJson[k];
      // A theme that lists dock apps defines the dock outright.
      if (themeJson.dock_apps instanceof Array) merged.dock_initialized = true;
    }
    return validate(merged, prefs);
  }

  function preset(key) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].key === key) return PRESETS[i];
    return null;
  }

  function wallpaper(key) {
    for (var i = 0; i < WALLPAPERS.length; i++) if (WALLPAPERS[i].key === key) return WALLPAPERS[i];
    return WALLPAPERS[0];
  }

  return {
    KEY: KEY, BACKUP_KEY: BACKUP_KEY, SCHEMA_VERSION: SCHEMA_VERSION,
    WALLPAPERS: WALLPAPERS, PRESETS: PRESETS,
    defaults: defaults, validate: validate, migrate: migrate, load: load, save: save,
    applyTheme: applyTheme, preset: preset, wallpaper: wallpaper, memoryStorage: memoryStorage
  };
});
