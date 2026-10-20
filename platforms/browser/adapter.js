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

  /** Samsung and LG TV browsers: real TVs, but a web page there can't open apps or switch inputs. */
  var TV_BROWSER_UA = /Tizen|SMART-TV|SmartTV|Web0S|webOS|NetCast/i;
  var TV_BROWSER_NOTE = "In the TV's web browser, a page can't open apps or switch inputs. Install the TV Vibe app on this TV to get them.";

  function create(env) {
    var ua = env.navigator && env.navigator.userAgent || "";
    var tvBrowser = TV_BROWSER_UA.test(ua);

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
      name: tvBrowser ? "TV web browser" : "Browser preview",
      emptyMessage: tvBrowser ? TV_BROWSER_NOTE + " Until then, open apps from the TV's own Home." : null,
      detect: function () { return true; },
      init: function () { return Promise.resolve(); },
      capabilities: function () {
        var why = "Browser preview: tiles and inputs are stand-ins; nothing on a TV is opened.";
        if (tvBrowser) {
          return {
            appDiscovery: c("unsupported", TV_BROWSER_NOTE),
            appLaunch: c("unsupported", TV_BROWSER_NOTE),
            inputList: c("unsupported", TV_BROWSER_NOTE),
            inputSwitch: c("unsupported", TV_BROWSER_NOTE),
            deviceInfo: c("available", "From the browser's user agent."),
            colorKeys: c("experimental", "Depends on which remote keys the TV's browser passes to pages. Hold OK for menus."),
            storage: storageWorks() ? c("available", "Browser storage; may be cleared with the browser's data.") : c("unavailable", "Browser storage is blocked; settings last until the page closes."),
            exit: c("unavailable", "A web page cannot close the browser."),
            homeReplacement: c("unsupported", "A web page can't replace the TV's Home."),
            homeKeyCapture: c("unsupported", "A web page can't receive the Home button."),
            bootAutostart: c("unsupported", "A web page can't open at power-on.")
          };
        }
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
        var maker = /Tizen|SMART-TV/i.test(ua) ? "Samsung" : (/Web0S|webOS|NetCast/i.test(ua) ? "LG" : "");
        return Promise.resolve({ manufacturer: maker, model: tvBrowser ? "TV browser" : "Browser", os: "Web", osVersion: "", firmware: "", userAgent: ua });
      },
      listApps: function () {
        if (tvBrowser) return Promise.resolve([]);
        return Promise.resolve(PREVIEW_APPS.map(function (a) {
          return { key: a[0], platformId: a[0], name: a[1], source: "preview" };
        }));
      },
      launchApp: function (app) {
        if (tvBrowser) return Promise.reject(new Error(TV_BROWSER_NOTE));
        return Promise.resolve({ simulated: true, message: "Preview: on a TV this opens " + app.name + "." });
      },
      listInputs: function () {
        if (tvBrowser) return Promise.resolve([]);
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
