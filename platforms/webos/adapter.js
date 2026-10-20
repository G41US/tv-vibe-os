/*
 * LG webOS TV adapter.
 *
 * Documented Luna Service APIs used (LG webOS TV developer site, "API References"):
 *   luna://com.webos.applicationManager          launch, getAppLoadStatus (webOS TV 4.0+)
 *   luna://com.webos.service.tv.systemproperty   getSystemInfo (modelName, firmwareVersion, sdkVersion)
 *   luna://com.palm.connectionmanager           getStatus
 * Calls go through PalmServiceBridge, the object webOSTV.js itself uses, so the LG library does not have
 * to be bundled. If webOSTV.js is present (window.webOS.service.request) it is used instead.
 *
 * App discovery: there is no documented "list installed apps" method for ordinary apps, so known app
 * IDs (shared/core/apps.js CATALOGUE, community-sourced) are probed with getAppLoadStatus and only the
 * ones the TV reports as installed become tiles.
 *
 * Not done here: Home-button takeover, replacing LG's Home, power-on autostart. Ordinary (Developer
 * Mode or store) apps have no documented API for these; community projects that do it need a rooted TV,
 * which is outside the standard install path.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else { root.TVV = root.TVV || {}; (root.TVV.adapters = root.TVV.adapters || []).push(mod.create(root, root.TVV.apps)); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** Input app IDs (community-sourced), launched with the documented launch method. */
  var INPUT_APPS = [
    { id: "com.webos.app.hdmi1", name: "HDMI 1", kind: "hdmi" },
    { id: "com.webos.app.hdmi2", name: "HDMI 2", kind: "hdmi" },
    { id: "com.webos.app.hdmi3", name: "HDMI 3", kind: "hdmi" },
    { id: "com.webos.app.hdmi4", name: "HDMI 4", kind: "hdmi" },
    { id: "com.webos.app.livetv", name: "Live TV", kind: "tv" }
  ];

  var LAUNCH_ERRORS = {
    "-101": "is not installed on this TV",
    "-102": "is locked",
    "-103": "failed a security check",
    "-104": "can't be opened from a Developer Mode app",
    "-105": "has an invalid ID",
    "-106": "is an unsupported app type"
  };

  function create(env, appsModule) {
    var probeSupported = null; // null = unknown, false = getAppLoadStatus missing (webOS < 4)

    function luna(uri, method, params) {
      return new Promise(function (resolve, reject) {
        var done = function (res) {
          if (res && res.returnValue === false) {
            var err = new Error(res.errorText || ("Luna error " + res.errorCode));
            err.code = res.errorCode;
            reject(err);
          } else resolve(res || {});
        };
        try {
          if (env.webOS && env.webOS.service && typeof env.webOS.service.request === "function") {
            env.webOS.service.request(uri, { method: method, parameters: params || {}, onSuccess: done, onFailure: done });
            return;
          }
          if (typeof env.PalmServiceBridge !== "function") { reject(new Error("PalmServiceBridge is not available")); return; }
          var bridge = new env.PalmServiceBridge();
          bridge.onservicecallback = function (msg) {
            var res;
            try { res = typeof msg === "string" ? JSON.parse(msg) : msg; } catch (e) { reject(e); return; }
            done(res);
          };
          bridge.call(uri + "/" + method, JSON.stringify(params || {}));
        } catch (e) { reject(e); }
      });
    }

    function exists(appId) {
      return luna("luna://com.webos.applicationManager", "getAppLoadStatus", { appId: appId }).then(function (r) {
        probeSupported = true;
        return r.exist === true;
      }, function (e) {
        if (probeSupported === null) probeSupported = false;
        throw e;
      });
    }

    function probeAll(list) {
      return Promise.all(list.map(function (item) {
        return exists(item.id).then(function (ok) { return ok ? item : null; }, function () { return null; });
      })).then(function (r) { return r.filter(Boolean); });
    }

    function c(status, note) { return { status: status, note: note }; }

    var adapter = {
      id: "webos",
      name: "LG webOS",

      detect: function () {
        // Only an installed webOS app gets the Luna bridge. LG's web browser has a webOS user agent but
        // no bridge, so it must fall through to the browser adapter's TV-browser mode.
        if (typeof env.PalmServiceBridge === "function") return true;
        return !!(env.webOS && env.webOS.service && typeof env.webOS.service.request === "function");
      },

      init: function () { return Promise.resolve(); },

      capabilities: function () {
        var discovery = probeSupported === false
          ? c("unavailable", "getAppLoadStatus needs webOS TV 4.0 or later.")
          : c("available", "Known app IDs checked with applicationManager/getAppLoadStatus. IDs are community-sourced; only apps the TV confirms are shown.");
        return {
          appDiscovery: discovery,
          appLaunch: c("available", "applicationManager/launch (documented)."),
          inputList: c("experimental", "HDMI/Live TV app IDs are community-sourced; each is checked with getAppLoadStatus."),
          inputSwitch: c("experimental", "Opens the TV's input app with applicationManager/launch."),
          deviceInfo: c("available", "tv.systemproperty/getSystemInfo (modelName, firmwareVersion, sdkVersion)."),
          colorKeys: c("available", "Colour keys arrive as keydown 403-406; Magic Remote pointer is supported."),
          storage: c("available", "localStorage inside the app."),
          exit: c("available", "window.close()."),
          homeReplacement: c("unsupported", "No documented API lets an ordinary webOS app replace LG's Home."),
          homeKeyCapture: c("unsupported", "The Home key is handled by the system and not delivered to apps."),
          bootAutostart: c("unsupported", "No documented power-on autostart for ordinary apps.")
        };
      },

      getDeviceInfo: function () {
        return luna("luna://com.webos.service.tv.systemproperty", "getSystemInfo",
          { keys: ["modelName", "firmwareVersion", "sdkVersion"] }).then(function (r) {
          return { manufacturer: "LG", model: r.modelName || "", os: "webOS TV", osVersion: r.sdkVersion || "", firmware: r.firmwareVersion || "" };
        }, function () {
          return { manufacturer: "LG", model: "", os: "webOS TV", osVersion: "", firmware: "" };
        });
      },

      listApps: function () {
        var cat = (appsModule && appsModule.CATALOGUE || []).filter(function (e) { return !!e.webos; });
        var candidates = cat.map(function (e) { return { id: e.webos, name: e.name }; });
        return probeAll(candidates).then(function (found) {
          return found.map(function (f) { return { key: f.id, platformId: f.id, name: f.name, source: "catalogue" }; });
        });
      },

      launchApp: function (app) {
        return luna("luna://com.webos.applicationManager", "launch", { id: app.platformId }).then(function () {
          return {};
        }, function (e) {
          var why = LAUNCH_ERRORS[String(e.code)] || ("could not be opened (" + e.message + ")");
          throw new Error(app.name + " " + why + ".");
        });
      },

      listInputs: function () {
        return probeAll(INPUT_APPS).then(function (found) {
          return found.map(function (f) { return { key: f.id, name: f.name, kind: f.kind, appId: f.id }; });
        });
      },

      switchInput: function (input) {
        return luna("luna://com.webos.applicationManager", "launch", { id: input.appId }).then(function () { return {}; });
      },

      getNetwork: function () {
        return luna("luna://com.palm.connectionmanager", "getStatus", {}).then(function (r) {
          var wired = r.wired && r.wired.state === "connected";
          var wifi = r.wifi && r.wifi.state === "connected";
          var online = r.isInternetConnectionAvailable !== false && (wired || wifi || r.isInternetConnectionAvailable === true);
          return { online: online, type: wired ? "Ethernet" : (wifi ? (r.wifi.ssid || "Wi-Fi") : "Offline") };
        }, function () {
          var online = !env.navigator || env.navigator.onLine !== false;
          return { online: online, type: online ? "Online" : "Offline" };
        });
      },

      exit: function () {
        try { env.close(); } catch (e) { /* nothing else to try */ }
      },

      onResume: function (cb) {
        if (!env.document || !env.document.addEventListener) return;
        env.document.addEventListener("webOSRelaunch", function () { cb(); });
        env.document.addEventListener("visibilitychange", function () {
          if (!env.document.hidden) cb();
        });
      }
    };
    return adapter;
  }

  return { create: create, INPUT_APPS: INPUT_APPS };
});
