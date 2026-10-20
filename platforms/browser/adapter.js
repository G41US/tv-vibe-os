/*
 * Browser preview adapter. Used on a computer or phone browser, and as the fallback when no TV
 * platform is detected. Nothing here touches a TV: app tiles and inputs are stand-ins so the layout,
 * navigation and settings can be tried with a keyboard (arrows, Enter, Escape = Back, hold Enter = menu).
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; root.TVV.browserAdapter = mod.create(root); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PREVIEW_APPS = [
    ["preview.youtube", "YouTube"], ["preview.netflix", "Netflix"], ["preview.prime", "Prime Video"],
    ["preview.spotify", "Spotify"], ["preview.disney", "Disney+"], ["preview.showmax", "Showmax"],
    ["preview.dstv", "DStv"], ["preview.appletv", "Apple TV"], ["preview.twitch", "Twitch"],
    ["preview.plex", "Plex"], ["preview.music", "Music"], ["preview.photos", "Photos"]
  ];

  function create(env) {
    function storageWorks() {
      try {
        var s = env.localStorage;
        if (!s) return false;
        s.setItem("tvvibe.probe", "1");
        s.removeItem("tvvibe.probe");
        return true;
      } catch (e) { return false; }
    }

    function c(status, note) { return { status: status, note: note }; }

    var adapter = {
      id: "browser",
      name: "Browser preview",
      detect: function () { return true; },
      init: function () { return Promise.resolve(); },
      capabilities: function () {
        var why = "Browser preview: tiles and inputs are stand-ins; nothing on a TV is opened.";
        return {
          appDiscovery: c("simulated", why),
          appLaunch: c("simulated", why),
          inputList: c("simulated", why),
          inputSwitch: c("simulated", why),
          deviceInfo: c("available", "From the browser's user agent."),
          colorKeys: c("simulated", "Hold Enter (or press the context-menu key) for the tile menu."),
          storage: storageWorks() ? c("available", "localStorage") : c("unavailable", "localStorage is blocked; settings last until the page closes."),
          exit: c("unavailable", "A web page cannot close itself."),
          homeReplacement: c("unsupported", "Not applicable to a browser."),
          homeKeyCapture: c("unsupported", "Not applicable to a browser."),
          bootAutostart: c("unsupported", "Not applicable to a browser.")
        };
      },
      getDeviceInfo: function () {
        var ua = env.navigator && env.navigator.userAgent || "";
        return Promise.resolve({ manufacturer: "", model: "Browser", os: "Web", osVersion: "", firmware: "", userAgent: ua });
      },
      listApps: function () {
        return Promise.resolve(PREVIEW_APPS.map(function (a) {
          return { key: a[0], platformId: a[0], name: a[1], source: "preview" };
        }));
      },
      launchApp: function (app) {
        return Promise.resolve({ simulated: true, message: "Preview: on a TV this opens " + app.name + "." });
      },
      listInputs: function () {
        return Promise.resolve([
          { key: "hdmi1", name: "HDMI 1", kind: "hdmi" },
          { key: "hdmi2", name: "HDMI 2", kind: "hdmi" },
          { key: "tv", name: "Live TV", kind: "tv" }
        ]);
      },
      switchInput: function (input) {
        return Promise.resolve({ simulated: true, message: "Preview: on a TV this switches to " + input.name + "." });
      },
      getNetwork: function () {
        var online = !env.navigator || env.navigator.onLine !== false;
        return Promise.resolve({ online: online, type: online ? "Online" : "Offline" });
      },
      exit: function () { /* a page cannot close itself */ },
      onResume: function (cb) {
        if (env.document && env.document.addEventListener) {
          env.document.addEventListener("visibilitychange", function () {
            if (env.document.visibilityState === "visible") cb();
          });
        }
      }
    };
    return adapter;
  }

  return { create: create, PREVIEW_APPS: PREVIEW_APPS };
});
