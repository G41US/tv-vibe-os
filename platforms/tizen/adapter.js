/*
 * Samsung Tizen TV adapter.
 *
 * Documented APIs used (Tizen Web Device API, TV profile; privileges declared in config.xml):
 *   tizen.application.getAppsInfo / launch / getCurrentApplication().exit   (application.info, application.launch)
 *   tizen.systeminfo.getPropertyValue("BUILD" | "NETWORK" | "VIDEOSOURCE")    (system info)
 *   tizen.tvinputdevice.getSupportedKeys / registerKeyBatch                  (tv.inputdevice)
 *   tizen.tvwindow.setSource / show / hide                                   (tv.window)
 *
 * What this does NOT do, because no public Tizen API offers it to third-party apps on retail TVs:
 * become the system Home screen, register the Home key, or show itself at power-on. Samsung's
 * "prelaunch" metadata only pre-loads an app in the background; it is not a power-on launch.
 *
 * Input "switching" uses the TVWindow API, which shows a video source inside this app's window. It is
 * not the TV's own source change, so it is reported as experimental.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; (root.TVV.adapters = root.TVV.adapters || []).push(mod.create(root)); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SOURCE_NAMES = { HDMI: "HDMI", TV: "Live TV", AV: "AV", COMP: "Component", SVIDEO: "S-Video", SCART: "SCART", PC: "PC", DVI: "DVI", MEDIA: "Media" };

  function create(env) {
    var supportedKeyNames = [];
    var registeredKeys = [];
    var shownSource = null;

    function tz() { return env.tizen; }
    function has(path) {
      var o = env;
      for (var i = 0; i < path.length; i++) { if (!o || o[path[i]] === undefined || o[path[i]] === null) return false; o = o[path[i]]; }
      return true;
    }

    function property(name) {
      return new Promise(function (resolve, reject) {
        try { tz().systeminfo.getPropertyValue(name, resolve, function (e) { reject(new Error(e && e.message || String(e))); }); }
        catch (e) { reject(e); }
      });
    }

    function ownAppId() {
      try { return tz().application.getCurrentApplication().appInfo.id; } catch (e) { return null; }
    }

    function sourceName(src) {
      var base = SOURCE_NAMES[src.type] || src.type;
      return src.number && src.type !== "TV" ? base + " " + src.number : base;
    }

    function c(status, note) { return { status: status, note: note }; }

    var adapter = {
      id: "tizen",
      name: "Samsung Tizen",

      detect: function () {
        return has(["tizen", "application"]) && has(["tizen", "systeminfo"]);
      },

      init: function () {
        if (!has(["tizen", "tvinputdevice"])) return Promise.resolve();
        try {
          var keys = tz().tvinputdevice.getSupportedKeys() || [];
          supportedKeyNames = keys.map(function (k) { return k.name; });
          var wanted = ["ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "Tools", "Info", "Exit"]
            .filter(function (n) { return supportedKeyNames.indexOf(n) >= 0; });
          if (!wanted.length) return Promise.resolve();
          return new Promise(function (resolve) {
            var batch = tz().tvinputdevice.registerKeyBatch;
            if (typeof batch === "function") {
              tz().tvinputdevice.registerKeyBatch(wanted, function () { registeredKeys = wanted; resolve(); },
                function () { resolve(); });
            } else {
              wanted.forEach(function (n) { try { tz().tvinputdevice.registerKey(n); registeredKeys.push(n); } catch (e) { /* skip */ } });
              resolve();
            }
          });
        } catch (e) {
          return Promise.resolve();
        }
      },

      capabilities: function () {
        var homeListed = supportedKeyNames.indexOf("Home") >= 0;
        return {
          appDiscovery: has(["tizen", "application", "getAppsInfo"])
            ? c("available", "Tizen Application API getAppsInfo(). The firmware decides which apps it reports.")
            : c("unavailable", "getAppsInfo() is not exposed on this firmware."),
          appLaunch: has(["tizen", "application", "launch"])
            ? c("available", "Tizen Application API launch(). Some apps may refuse to be started by another app.")
            : c("unavailable", "launch() is not exposed on this firmware."),
          inputList: has(["tizen", "systeminfo"])
            ? c("experimental", "systeminfo VIDEOSOURCE lists connected sources; needs hardware confirmation.")
            : c("unavailable", "systeminfo is not exposed."),
          inputSwitch: has(["tizen", "tvwindow"])
            ? c("experimental", "TVWindow shows the source inside this app; it does not change the TV's own input.")
            : c("unavailable", "TVWindow API is not exposed on this firmware."),
          deviceInfo: c("available", "systeminfo BUILD property (model, manufacturer, build)."),
          colorKeys: registeredKeys.length
            ? c("available", "Registered via tvinputdevice: " + registeredKeys.join(", ") + ".")
            : c("unavailable", "No optional keys could be registered. Hold OK for the tile menu."),
          storage: c("available", "localStorage inside the app package."),
          exit: c("available", "tizen.application.getCurrentApplication().exit()."),
          homeReplacement: c("unsupported", "No public Tizen API makes a third-party app the TV's Home screen."),
          homeKeyCapture: homeListed
            ? c("experimental", "This firmware lists a key named Home as registrable. Untested; the standard build does not register it.")
            : c("unsupported", "Home is not offered by tvinputdevice.getSupportedKeys() on this TV; the TV handles it."),
          bootAutostart: c("unsupported", "No public API opens a third-party app at power-on. Prelaunch metadata only pre-loads in the background.")
        };
      },

      getDeviceInfo: function () {
        return property("BUILD").then(function (b) {
          var version = "";
          try { version = tz().systeminfo.getCapability("http://tizen.org/feature/platform.version"); } catch (e) { version = ""; }
          return { manufacturer: b.manufacturer || "Samsung", model: b.model || "", os: "Tizen", osVersion: version, firmware: b.buildVersion || "" };
        }, function () {
          return { manufacturer: "Samsung", model: "", os: "Tizen", osVersion: "", firmware: "" };
        });
      },

      listApps: function () {
        var self = ownAppId();
        return new Promise(function (resolve, reject) {
          try {
            tz().application.getAppsInfo(function (infos) {
              var apps = [];
              for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                if (!info || info.show === false || info.id === self || !info.name) continue;
                apps.push({ key: info.id, platformId: info.id, name: info.name, iconUrl: info.iconPath || "", source: "discovered" });
              }
              resolve(apps);
            }, function (e) { reject(new Error("getAppsInfo failed: " + (e && e.message || e))); });
          } catch (e) { reject(e); }
        });
      },

      launchApp: function (app) {
        return new Promise(function (resolve, reject) {
          try {
            tz().application.launch(app.platformId, function () { resolve({}); },
              function (e) { reject(new Error(app.name + " could not be opened (" + (e && (e.name || e.message) || "error") + ").")); });
          } catch (e) { reject(e); }
        });
      },

      listInputs: function () {
        return property("VIDEOSOURCE").then(function (vs) {
          var list = (vs && vs.connected) || [];
          return list.map(function (src) {
            return { key: src.type + (src.number || ""), name: sourceName(src), kind: String(src.type).toLowerCase(), raw: src };
          });
        });
      },

      switchInput: function (input) {
        if (!has(["tizen", "tvwindow"])) return Promise.reject(new Error("This TV does not expose the TVWindow API."));
        return new Promise(function (resolve, reject) {
          try {
            tz().tvwindow.setSource(input.raw, function () {
              tz().tvwindow.show(function () { shownSource = input; resolve({ embedded: true }); },
                function (e) { reject(new Error("Could not show " + input.name + ": " + (e && e.message || e))); },
                ["0", "0", "100%", "100%"], "MAIN");
            }, function (e) { reject(new Error("Could not select " + input.name + ": " + (e && e.message || e))); }, "MAIN");
          } catch (e) { reject(e); }
        });
      },

      /** Hides the in-app TV window opened by switchInput (Back while watching). */
      closeInput: function () {
        if (!shownSource || !has(["tizen", "tvwindow"])) return Promise.resolve();
        return new Promise(function (resolve) {
          try { tz().tvwindow.hide(function () { shownSource = null; resolve(); }, function () { resolve(); }, "MAIN"); }
          catch (e) { resolve(); }
        });
      },

      getNetwork: function () {
        return property("NETWORK").then(function (n) {
          var type = n && n.networkType || "UNKNOWN";
          var names = { WIFI: "Wi-Fi", ETHERNET: "Ethernet", NONE: "Offline" };
          return { online: type !== "NONE", type: names[type] || type };
        }, function () {
          var online = !env.navigator || env.navigator.onLine !== false;
          return { online: online, type: online ? "Online" : "Offline" };
        });
      },

      exit: function () {
        try { tz().application.getCurrentApplication().exit(); } catch (e) { /* nothing else to try */ }
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
