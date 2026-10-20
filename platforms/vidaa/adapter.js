/*
 * Hisense VIDAA adapter.
 *
 * VIDAA has no public developer documentation for third-party web apps: packaging, installation and
 * any system APIs are available to Hisense/VIDAA partners only. So this adapter promises very little:
 *   - The launcher runs as a hosted web app (or a partner-packaged app) with the shared UI.
 *   - App discovery and launching: unsupported (no public API). The home shows clock, wallpaper and settings.
 *   - Device info: the user agent, plus Hisense_GetModelName / Hisense_GetFirmWareVersion when the
 *     firmware exposes them. Those names come from community examples, so they are "experimental" and
 *     only ever read, never relied on.
 * No install helper is included: installing apps from inside the launcher is not part of the brief and
 * the only known hooks are undocumented.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; (root.TVV.adapters = root.TVV.adapters || []).push(mod.create(root)); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MODEL_FNS = ["Hisense_GetModelName"];
  var FIRMWARE_FNS = ["Hisense_GetFirmWareVersion", "Hisense_GetFirmwareVersion"];

  function create(env) {
    function firstFn(names) {
      for (var i = 0; i < names.length; i++) if (typeof env[names[i]] === "function") return env[names[i]];
      return null;
    }
    function read(names) {
      var fn = firstFn(names);
      if (!fn) return "";
      try { var v = fn(); return typeof v === "string" ? v : (v === undefined || v === null ? "" : String(v)); }
      catch (e) { return ""; }
    }
    function ua() { return env.navigator && env.navigator.userAgent || ""; }
    function c(status, note) { return { status: status, note: note }; }
    var noApi = "VIDAA publishes no public API for this; partner-only SDK access would be needed.";

    var adapter = {
      id: "vidaa",
      name: "Hisense VIDAA",

      detect: function () {
        return /VIDAA|Hisense/i.test(ua()) || !!firstFn(MODEL_FNS);
      },

      init: function () { return Promise.resolve(); },

      capabilities: function () {
        var hisenseFns = !!(firstFn(MODEL_FNS) || firstFn(FIRMWARE_FNS));
        return {
          appDiscovery: c("unsupported", noApi),
          appLaunch: c("unsupported", noApi),
          inputList: c("unsupported", noApi),
          inputSwitch: c("unsupported", noApi),
          deviceInfo: hisenseFns
            ? c("experimental", "Read from undocumented Hisense_* functions found on this firmware.")
            : c("available", "User agent only."),
          colorKeys: c("experimental", "Depends on which keys the VIDAA browser engine passes to web pages."),
          storage: c("experimental", "localStorage; whether it survives a TV restart differs by firmware."),
          exit: c("experimental", "window.close(); may be ignored by the VIDAA browser."),
          homeReplacement: c("unsupported", noApi),
          homeKeyCapture: c("unsupported", noApi),
          bootAutostart: c("unsupported", noApi)
        };
      },

      getDeviceInfo: function () {
        var m = /VIDAA\/?\s?([\d.]+)/i.exec(ua());
        return Promise.resolve({
          manufacturer: "Hisense",
          model: read(MODEL_FNS),
          os: "VIDAA",
          osVersion: m ? m[1] : "",
          firmware: read(FIRMWARE_FNS),
          userAgent: ua()
        });
      },

      listApps: function () { return Promise.resolve([]); },

      launchApp: function () {
        return Promise.reject(new Error("VIDAA doesn't let web apps open other apps. Use the TV's own Home for apps."));
      },

      listInputs: function () { return Promise.resolve([]); },

      switchInput: function () {
        return Promise.reject(new Error("VIDAA doesn't let web apps switch inputs. Use the TV's Input button."));
      },

      getNetwork: function () {
        var online = !env.navigator || env.navigator.onLine !== false;
        return Promise.resolve({ online: online, type: online ? "Online" : "Offline" });
      },

      exit: function () {
        try { env.close(); } catch (e) { /* ignored by some firmware */ }
      },

      onResume: function (cb) {
        if (env.document && env.document.addEventListener) {
          env.document.addEventListener("visibilitychange", function () {
            if (!env.document.hidden) cb();
          });
        }
      }
    };
    return adapter;
  }

  return { create: create };
});
