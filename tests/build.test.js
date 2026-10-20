"use strict";
/*
 * Build output and TV-browser compatibility checks.
 * The oldest targets are webOS TV 4.x (Chromium 53) and Tizen 4.0 (Chromium 56). The lint below rejects
 * syntax and CSS those engines don't support, so it is caught here rather than on a TV.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const build = require("../tools/build.js");

function files(dir, ext) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...files(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

const SHIPPED_JS = [...files(path.join(ROOT, "shared"), ".js"), ...files(path.join(ROOT, "platforms"), ".js")];
const SHIPPED_CSS = files(path.join(ROOT, "shared"), ".css");

const JS_BANNED = [
  [/\?\./, "optional chaining (Chromium 80)"],
  [/\?\?/, "nullish coalescing (Chromium 80)"],
  [/\basync\s+function|\bawait\s/, "async/await (Chromium 55)"],
  [/catch\s*\{/, "optional catch binding (Chromium 66)"],
  [/\.padStart\(|\.padEnd\(/, "padStart/padEnd (Chromium 57)"],
  [/Object\.(entries|values)\(/, "Object.entries/values (Chromium 54)"],
  [/\{\s*\.\.\.[A-Za-z_]/, "object spread (Chromium 60)"],
  [/\.flat\(|\.flatMap\(/, "Array.flat (Chromium 69)"],
  [/\bclass\s+\w+/, "classes (keep to functions for the oldest engines)"],
  [/^\s*import\s|^\s*export\s/m, "ES modules"]
];
const CSS_BANNED = [
  [/display:\s*grid/, "CSS grid (Chromium 57)"],
  [/[^-]gap:/, "flex gap (Chromium 84)"],
  [/\binset:/, "inset (Chromium 87)"],
  [/aspect-ratio/, "aspect-ratio (Chromium 88)"],
  [/clamp\(|min\(|max\(/, "CSS math functions (Chromium 79)"],
  [/backdrop-filter/, "backdrop-filter (not on older TVs)"]
];

test("shipped JavaScript avoids syntax missing on Chromium 53", () => {
  for (const f of SHIPPED_JS) {
    const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const [re, why] of JS_BANNED) assert.doesNotMatch(src, re, `${path.relative(ROOT, f)} uses ${why}`);
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(f, "utf8"), { filename: f }), `${f} parses`);
  }
});

test("shipped CSS avoids features missing on Chromium 53", () => {
  for (const f of SHIPPED_CSS) {
    const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [re, why] of CSS_BANNED) assert.doesNotMatch(src, re, `${path.relative(ROOT, f)} uses ${why}`);
  }
});

test("each platform build contains only its adapter and correct metadata", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tvvibe-"));
  try {
    for (const p of build.PLATFORMS) {
      const out = build.build(p);
      const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
      const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
      for (const s of scripts) assert.ok(fs.existsSync(path.join(out, s)), `${p}: ${s} exists`);
      const adapters = scripts.filter((s) => s.startsWith("platforms/")).map((s) => s.split("/")[1]);
      assert.deepEqual(adapters, build.adaptersFor(p), `${p} adapters`);
      assert.ok(html.indexOf("ADAPTERS:BEGIN") < 0, "markers removed");
      for (const f of ["home.css", "fonts/outfit.ttf", "wallpapers/aurora.jpg", "build-info.js"]) assert.ok(fs.existsSync(path.join(out, f)), `${p}: ${f}`);
      assert.match(fs.readFileSync(path.join(out, "build-info.js"), "utf8"), new RegExp(`"version":"${build.VERSION}"`));
    }
    const xml = fs.readFileSync(path.join(ROOT, "dist/tizen/config.xml"), "utf8");
    assert.match(xml, new RegExp(`version="${build.VERSION}"`));
    assert.match(xml, /package="[A-Za-z0-9]{10}"/, "Tizen package ID is 10 alphanumerics");
    assert.match(xml, /<content src="index.html"\/>/);
    const appinfo = JSON.parse(fs.readFileSync(path.join(ROOT, "dist/webos/appinfo.json"), "utf8"));
    assert.equal(appinfo.version, build.VERSION);
    assert.equal(appinfo.disableBackHistoryAPI, true, "Back key (461) reaches the app");
    assert.doesNotMatch(appinfo.id, /^com\.(lge|webos|palm)\./, "reserved webOS ID prefix");
    // webOS TV 27+ requires every Luna group the adapter uses (LG ACG guide).
    assert.deepEqual(appinfo.requiredACG.slice().sort(), ["application.launcher", "application.query", "network.query", "systemconfig.query"]);
    const webosSrc = fs.readFileSync(path.join(ROOT, "platforms/webos/adapter.js"), "utf8");
    const services = [...webosSrc.matchAll(/luna\("luna:\/\/([\w.]+)", "(\w+)"/g)].map((m) => m[1] + "/" + m[2]).sort();
    assert.deepEqual(services, ["com.palm.connectionmanager/getStatus", "com.webos.applicationManager/getAppLoadStatus",
      "com.webos.applicationManager/launch", "com.webos.applicationManager/launch", "com.webos.service.tv.systemproperty/getSystemInfo"],
      "adapter calls only Luna methods covered by requiredACG");
    for (const f of [appinfo.icon, appinfo.largeIcon, appinfo.main]) assert.ok(fs.existsSync(path.join(ROOT, "dist/webos", f)), f);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("no signing material or credentials are committed", () => {
  const all = files(ROOT, "").filter((f) => !f.includes(`${path.sep}.git${path.sep}`) && !f.includes(`${path.sep}dist${path.sep}`) && !f.includes("node_modules"));
  for (const f of all) {
    assert.doesNotMatch(path.basename(f), /\.(p12|pem|cer|keystore|jks)$|^author-signature\.xml$|^signature1\.xml$/, f);
  }
  const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  for (const pat of ["dist/", "*.p12", "*.wgt", "*.ipk"]) assert.ok(gitignore.includes(pat), ".gitignore has " + pat);
});
