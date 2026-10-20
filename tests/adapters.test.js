"use strict";
/*
 * Platform adapters against simulated platform objects. These prove each adapter meets the contract
 * and calls the documented API it claims to; they do not prove the TV behaves that way — that is what
 * docs/HARDWARE-TESTS.md is for.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const contract = require("../shared/core/contract.js");
const appsModule = require("../shared/core/apps.js");
const browser = require("../platforms/browser/adapter.js");
const tizen = require("../platforms/tizen/adapter.js");
const webos = require("../platforms/webos/adapter.js");
const vidaa = require("../platforms/vidaa/adapter.js");

const doc = () => ({ addEventListener() {}, hidden: false });

function tizenEnv(overrides = {}) {
  const calls = [];
  const env = {
    document: doc(),
    navigator: { onLine: true },
    tizen: {
      application: {
        getCurrentApplication: () => ({ appInfo: { id: "TVVibeOS01.TVVibe" }, exit: () => calls.push("exit") }),
        getAppsInfo: (ok) => ok([
          { id: "TVVibeOS01.TVVibe", name: "TV Vibe", show: true },
          { id: "yt", name: "YouTube", show: true, iconPath: "/icons/yt.png" },
          { id: "svc", name: "Background", show: false },
          { id: "noname", name: "", show: true }
        ]),
        launch: (id, ok, err) => { calls.push("launch:" + id); id === "bad" ? err({ name: "NotFoundError" }) : ok(); }
      },
      systeminfo: {
        getPropertyValue: (p, ok, err) => {
          if (p === "BUILD") ok({ model: "QE55Q60", manufacturer: "Samsung", buildVersion: "T-1" });
          else if (p === "NETWORK") ok({ networkType: "ETHERNET" });
          else if (p === "VIDEOSOURCE") ok({ connected: [{ type: "HDMI", number: 2 }, { type: "TV", number: 1 }] });
          else err({ message: "unknown" });
        },
        getCapability: () => "6.5"
      },
      tvinputdevice: {
        getSupportedKeys: () => [{ name: "ColorF0Red" }, { name: "Tools" }, { name: "VolumeUp" }],
        registerKeyBatch: (names, ok) => { calls.push("keys:" + names.join(",")); ok(); }
      },
      tvwindow: {
        setSource: (src, ok) => { calls.push("source:" + src.type + src.number); ok(); },
        show: (ok) => { calls.push("show"); ok(); },
        hide: (ok) => { calls.push("hide"); ok(); }
      }
    }
  };
  Object.assign(env.tizen, overrides);
  return { env, calls };
}

function webosEnv(installed, opts = {}) {
  const calls = [];
  function Bridge() {
    this.call = (uri, params) => {
      const p = JSON.parse(params);
      calls.push(uri.replace("luna://", "") + " " + params);
      let r;
      if (uri.endsWith("/getAppLoadStatus")) r = opts.noProbe ? { returnValue: false, errorText: "Unknown method" } : { returnValue: true, exist: installed.indexOf(p.appId) >= 0 };
      else if (uri.endsWith("/launch")) r = p.id === "missing" ? { returnValue: false, errorCode: -101, errorText: "not found" } : { returnValue: true };
      else if (uri.endsWith("/getSystemInfo")) r = { returnValue: true, modelName: "OLED55C2", firmwareVersion: "23.10.30", sdkVersion: "7.3.0" };
      else if (uri.endsWith("/getStatus")) r = { returnValue: true, isInternetConnectionAvailable: true, wired: { state: "connected" }, wifi: { state: "disconnected" } };
      else r = { returnValue: false, errorText: "?" };
      Promise.resolve().then(() => this.onservicecallback(JSON.stringify(r)));
    };
  }
  return { env: { PalmServiceBridge: Bridge, document: doc(), navigator: { userAgent: "Mozilla/5.0 (Web0S; Linux/SmartTV)", onLine: true }, close: () => calls.push("close") }, calls };
}

// ---- contract ---------------------------------------------------------------------------------------

test("every adapter satisfies the contract", () => {
  const all = [browser.create({ navigator: {}, document: doc() }), tizen.create(tizenEnv().env),
    webos.create(webosEnv([]).env, appsModule), vidaa.create({ navigator: { userAgent: "VIDAA" }, document: doc() })];
  for (const a of all) assert.deepEqual(contract.validate(a), [], a.id);
});

test("contract: validate catches missing methods and capabilities", () => {
  const bad = { id: "x", name: "X", capabilities: () => ({ appLaunch: { status: "works", note: "" } }) };
  const problems = contract.validate(bad);
  assert.ok(problems.some((p) => p.includes("listApps")));
  assert.ok(problems.some((p) => p.includes("bad status works")));
  assert.ok(problems.some((p) => p.includes("homeReplacement not reported")));
});

test("contract: no TV adapter claims system-level takeover", () => {
  const all = [tizen.create(tizenEnv().env), webos.create(webosEnv([]).env, appsModule), vidaa.create({ navigator: {}, document: doc() })];
  for (const a of all) {
    const caps = a.capabilities();
    for (const k of ["homeReplacement", "bootAutostart"]) assert.equal(caps[k].status, "unsupported", a.id + " " + k);
    assert.notEqual(caps.homeKeyCapture.status, "available", a.id + " homeKeyCapture");
  }
});

test("contract: select picks the detected platform or falls back", () => {
  const fb = { id: "fb" };
  assert.equal(contract.select([{ detect: () => false }, { id: "t", detect: () => true }], fb).id, "t");
  assert.equal(contract.select([{ detect: () => { throw new Error("x"); } }], fb).id, "fb");
});

test("contract: withTimeout rejects silent calls", async () => {
  await assert.rejects(contract.withTimeout(new Promise(() => {}), 20, "Silent"), /Silent timed out/);
  assert.equal(await contract.withTimeout(Promise.resolve(4), 50), 4);
});

// ---- Tizen ------------------------------------------------------------------------------------------

test("tizen: detects only with the Tizen objects present", () => {
  assert.equal(tizen.create(tizenEnv().env).detect(), true);
  assert.equal(tizen.create({}).detect(), false);
});

test("tizen: lists visible apps except itself, with icons", async () => {
  const a = tizen.create(tizenEnv().env);
  const list = await a.listApps();
  assert.deepEqual(list, [{ key: "yt", platformId: "yt", name: "YouTube", iconUrl: "/icons/yt.png", source: "discovered" }]);
});

test("tizen: launch success and readable failure", async () => {
  const { env, calls } = tizenEnv();
  const a = tizen.create(env);
  await a.launchApp({ platformId: "yt", name: "YouTube" });
  await assert.rejects(a.launchApp({ platformId: "bad", name: "Bad" }), /Bad could not be opened \(NotFoundError\)/);
  assert.deepEqual(calls, ["launch:yt", "launch:bad"]);
});

test("tizen: registers only supported optional keys; Home is never registered", async () => {
  const { env, calls } = tizenEnv();
  const a = tizen.create(env);
  await a.init();
  assert.deepEqual(calls, ["keys:ColorF0Red,Tools"]);
  assert.equal(a.capabilities().homeKeyCapture.status, "unsupported");
});

test("tizen: inputs via VIDEOSOURCE and the in-app TV window", async () => {
  const { env, calls } = tizenEnv();
  const a = tizen.create(env);
  const inputs = await a.listInputs();
  assert.deepEqual(inputs.map((i) => i.name), ["HDMI 2", "Live TV"]);
  assert.deepEqual(await a.switchInput(inputs[0]), { embedded: true });
  await a.closeInput();
  assert.deepEqual(calls, ["source:HDMI2", "show", "hide"]);
  assert.equal(a.capabilities().inputSwitch.status, "experimental");
});

test("tizen: device info, network and exit", async () => {
  const { env, calls } = tizenEnv();
  const a = tizen.create(env);
  assert.deepEqual(await a.getDeviceInfo(), { manufacturer: "Samsung", model: "QE55Q60", os: "Tizen", osVersion: "6.5", firmware: "T-1" });
  assert.deepEqual(await a.getNetwork(), { online: true, type: "Ethernet" });
  a.exit();
  assert.deepEqual(calls, ["exit"]);
});

test("tizen: missing optional APIs are reported, not assumed", () => {
  const { env } = tizenEnv({ tvwindow: undefined, tvinputdevice: undefined });
  const caps = tizen.create(env).capabilities();
  assert.equal(caps.inputSwitch.status, "unavailable");
  assert.equal(caps.colorKeys.status, "unavailable");
});

// ---- webOS ------------------------------------------------------------------------------------------

test("webos: shows only catalogue apps the TV confirms as installed", async () => {
  const { env, calls } = webosEnv(["netflix", "youtube.leanback.v4"]);
  const a = webos.create(env, appsModule);
  const list = await a.listApps();
  assert.deepEqual(list.map((x) => x.key).sort(), ["netflix", "youtube.leanback.v4"]);
  assert.ok(calls.every((c) => c.startsWith("com.webos.applicationManager/getAppLoadStatus")));
});

test("webos: launch maps documented error codes to readable messages", async () => {
  const { env, calls } = webosEnv([]);
  const a = webos.create(env, appsModule);
  await a.launchApp({ platformId: "netflix", name: "Netflix" });
  await assert.rejects(a.launchApp({ platformId: "missing", name: "Gone" }), /Gone is not installed on this TV/);
  assert.equal(calls[0], 'com.webos.applicationManager/launch {"id":"netflix"}');
});

test("webos: inputs are probed and opened with launch", async () => {
  const { env, calls } = webosEnv(["com.webos.app.hdmi2", "com.webos.app.livetv"]);
  const a = webos.create(env, appsModule);
  const inputs = await a.listInputs();
  assert.deepEqual(inputs.map((i) => i.name), ["HDMI 2", "Live TV"]);
  await a.switchInput(inputs[0]);
  assert.equal(calls[calls.length - 1], 'com.webos.applicationManager/launch {"id":"com.webos.app.hdmi2"}');
});

test("webos: device info, network, exit", async () => {
  const { env, calls } = webosEnv([]);
  const a = webos.create(env, appsModule);
  assert.deepEqual(await a.getDeviceInfo(), { manufacturer: "LG", model: "OLED55C2", os: "webOS TV", osVersion: "7.3.0", firmware: "23.10.30" });
  assert.deepEqual(await a.getNetwork(), { online: true, type: "Ethernet" });
  a.exit();
  assert.equal(calls[calls.length - 1], "close");
});

test("webos: old firmware without getAppLoadStatus reports discovery as unavailable", async () => {
  const { env } = webosEnv([], { noProbe: true });
  const a = webos.create(env, appsModule);
  assert.deepEqual(await a.listApps(), []);
  assert.equal(a.capabilities().appDiscovery.status, "unavailable");
});

test("webos: detect by bridge or user agent only", () => {
  assert.equal(webos.create(webosEnv([]).env, appsModule).detect(), true);
  assert.equal(webos.create({ navigator: { userAgent: "Chrome" } }, appsModule).detect(), false);
});

// ---- VIDAA ------------------------------------------------------------------------------------------

test("vidaa: no app launching or inputs are claimed", async () => {
  const a = vidaa.create({ navigator: { userAgent: "Mozilla/5.0 VIDAA/7.0 Hisense" }, document: doc() });
  assert.equal(a.detect(), true);
  assert.deepEqual(await a.listApps(), []);
  await assert.rejects(a.launchApp({ name: "X" }), /doesn't let web apps open other apps/);
  const caps = a.capabilities();
  assert.equal(caps.appLaunch.status, "unsupported");
  assert.equal(caps.deviceInfo.status, "available");
});

test("vidaa: Hisense_* functions are read-only and marked experimental", async () => {
  const env = { navigator: { userAgent: "x" }, document: doc(), Hisense_GetModelName: () => "55A6K", Hisense_GetFirmWareVersion: () => { throw new Error("no"); } };
  const a = vidaa.create(env);
  assert.equal(a.detect(), true);
  const info = await a.getDeviceInfo();
  assert.equal(info.model, "55A6K");
  assert.equal(info.firmware, "");
  assert.equal(a.capabilities().deviceInfo.status, "experimental");
  assert.equal(typeof a.requestInstall, "undefined", "no install helper");
});

// ---- browser preview --------------------------------------------------------------------------------

test("browser: everything is simulated and says so", async () => {
  const a = browser.create({ navigator: { userAgent: "x", onLine: true }, document: doc() });
  const res = await a.launchApp({ name: "Netflix" });
  assert.equal(res.simulated, true);
  assert.equal(a.capabilities().appLaunch.status, "simulated");
});
