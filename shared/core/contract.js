/*
 * Platform adapter contract, capability model, adapter selection and diagnostics.
 *
 * Every platform (browser preview, Tizen, webOS, VIDAA) provides one adapter object:
 *
 *   id, name                      strings
 *   detect()                      -> boolean   true when running on this platform (synchronous, never throws)
 *   init()                        -> Promise   register keys, load platform libraries
 *   capabilities()                -> { <CAPABILITY>: { status, note } } for every key in CAPABILITIES
 *   getDeviceInfo()               -> Promise<{ manufacturer, model, os, osVersion, firmware }>
 *   listApps()                    -> Promise<app[]>          (see shared/core/apps.js for the app shape)
 *   launchApp(app)                -> Promise                 rejects with an Error the UI can show
 *   listInputs()                  -> Promise<input[]>        { key, name, kind }
 *   switchInput(input)            -> Promise
 *   getNetwork()                  -> Promise<{ online, type }>
 *   exit()                        -> undefined               leave the app (Back at the root)
 *   onResume(callback)            -> undefined               called when the app comes back to the front
 *
 * Statuses, in the order of how much they promise:
 *   available    a documented platform API is present on this device; behaviour still needs hardware tests
 *   experimental present, but undocumented or only community-documented; off the standard path
 *   simulated    browser preview stand-in, nothing real happens
 *   unavailable  the platform has an API for it, but not on this device / firmware / privilege level
 *   unsupported  no public, documented API on this platform (e.g. replacing the system Home screen)
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; root.TVV.contract = mod; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var METHODS = ["detect", "init", "capabilities", "getDeviceInfo", "listApps", "launchApp",
    "listInputs", "switchInput", "getNetwork", "exit", "onResume"];

  var CAPABILITIES = [
    { key: "appDiscovery", label: "List installed apps" },
    { key: "appLaunch", label: "Open apps" },
    { key: "inputList", label: "List HDMI / TV inputs" },
    { key: "inputSwitch", label: "Switch input" },
    { key: "deviceInfo", label: "Model and firmware" },
    { key: "colorKeys", label: "Colour / menu keys" },
    { key: "storage", label: "Remember settings" },
    { key: "exit", label: "Leave app with Back" },
    { key: "homeReplacement", label: "Replace the TV's Home screen" },
    { key: "homeKeyCapture", label: "Take over the Home button" },
    { key: "bootAutostart", label: "Open at power-on" }
  ];

  var STATUSES = ["available", "experimental", "simulated", "unavailable", "unsupported"];

  /** Returns a list of problems; empty means the adapter satisfies the contract. */
  function validate(adapter) {
    var problems = [];
    if (!adapter || typeof adapter !== "object") return ["adapter is not an object"];
    if (typeof adapter.id !== "string" || !adapter.id) problems.push("missing id");
    if (typeof adapter.name !== "string" || !adapter.name) problems.push("missing name");
    for (var i = 0; i < METHODS.length; i++) {
      if (typeof adapter[METHODS[i]] !== "function") problems.push("missing method " + METHODS[i] + "()");
    }
    if (typeof adapter.capabilities === "function") {
      var caps;
      try { caps = adapter.capabilities(); } catch (e) { problems.push("capabilities() threw: " + e); }
      if (caps) {
        for (var c = 0; c < CAPABILITIES.length; c++) {
          var entry = caps[CAPABILITIES[c].key];
          if (!entry) problems.push("capability " + CAPABILITIES[c].key + " not reported");
          else if (STATUSES.indexOf(entry.status) < 0) problems.push("capability " + CAPABILITIES[c].key + " has bad status " + entry.status);
          else if (typeof entry.note !== "string" || !entry.note) problems.push("capability " + CAPABILITIES[c].key + " has no note");
        }
      }
    }
    return problems;
  }

  /** Picks the first adapter whose detect() is true, else the fallback (the browser preview). */
  function select(adapters, fallback) {
    for (var i = 0; i < adapters.length; i++) {
      var ok = false;
      try { ok = adapters[i].detect() === true; } catch (e) { ok = false; }
      if (ok) return adapters[i];
    }
    return fallback;
  }

  /** Rejects with a clear error when a platform call never answers (some TV services stay silent). */
  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error((label || "Request") + " timed out after " + ms + " ms"));
      }, ms);
      Promise.resolve(promise).then(function (v) {
        if (done) return; done = true; clearTimeout(t); resolve(v);
      }, function (e) {
        if (done) return; done = true; clearTimeout(t); reject(e);
      });
    });
  }

  /** A capability entry, for adapters. */
  function cap(status, note) { return { status: status, note: note }; }

  /** Ring buffer of recent errors and events for the diagnostics screen. */
  function createLog(limit) {
    var max = limit || 40, items = [];
    return {
      add: function (level, message) {
        items.push({ t: new Date().toISOString(), level: level, message: String(message).slice(0, 400) });
        if (items.length > max) items.shift();
      },
      entries: function () { return items.slice(); }
    };
  }

  /** Plain-object report shown on the TV's diagnostics screen and recorded in hardware test logs. */
  function report(adapter, info, extra) {
    var caps = {};
    try { caps = adapter.capabilities(); } catch (e) { caps = {}; }
    var rows = [];
    for (var i = 0; i < CAPABILITIES.length; i++) {
      var k = CAPABILITIES[i].key;
      var e2 = caps[k] || { status: "unavailable", note: "not reported" };
      rows.push({ key: k, label: CAPABILITIES[i].label, status: e2.status, note: e2.note });
    }
    var out = {
      platform: adapter.id,
      platformName: adapter.name,
      device: info || {},
      capabilities: rows,
      generated: new Date().toISOString()
    };
    if (extra) for (var x in extra) if (Object.prototype.hasOwnProperty.call(extra, x)) out[x] = extra[x];
    return out;
  }

  return {
    METHODS: METHODS, CAPABILITIES: CAPABILITIES, STATUSES: STATUSES,
    validate: validate, select: select, withTimeout: withTimeout, cap: cap, createLog: createLog, report: report
  };
});
