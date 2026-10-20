#!/usr/bin/env node
/*
 * Builds each platform into its own folder and, with --package, its own installable artifact:
 *
 *   node tools/build.js <web|tizen|webos|vidaa|all> [--package]
 *
 *   dist/web/     hosted preview with every adapter (auto-detects the platform it runs on)
 *   dist/tizen/   Tizen web app payload + config.xml   --package: dist/packages/tvvibe-tizen-<v>-unsigned.zip
 *                 (and a signed .wgt when the Tizen CLI and TIZEN_PROFILE are available)
 *   dist/webos/   webOS app + appinfo.json             --package: dist/packages/com.g41us.tvvibe_<v>_all.ipk
 *                 (needs ares-package from @webos-tools/cli on PATH)
 *   dist/vidaa/   hosted web app for VIDAA             --package: dist/packages/tvvibe-vidaa-<v>.zip
 *
 * No dependencies beyond Node 18. Nothing here signs with or stores any key.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PKG_DIR = path.join(DIST, "packages");
const VERSION = require(path.join(ROOT, "package.json")).version;
const PLATFORMS = ["web", "tizen", "webos", "vidaa"];

function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return cp.execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch (e) { return ""; }
}

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

function copy(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dest, name));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function which(cmd) {
  const r = cp.spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: ["ignore", "pipe", "ignore"] });
  return r.status === 0 ? r.stdout.toString().split(/\r?\n/)[0].trim() : null;
}

function adaptersFor(platform) {
  if (platform === "web") return ["browser", "tizen", "webos", "vidaa"];
  return ["browser", platform];
}

function build(platform) {
  const out = path.join(DIST, platform);
  rmrf(out);
  fs.mkdirSync(out, { recursive: true });

  // Shared UI and core.
  for (const f of ["home.css", "home.js", "icon.svg"]) copy(path.join(ROOT, "shared/ui", f), path.join(out, f));
  copy(path.join(ROOT, "shared/ui/fonts"), path.join(out, "fonts"));
  copy(path.join(ROOT, "shared/ui/wallpapers"), path.join(out, "wallpapers"));
  copy(path.join(ROOT, "shared/core"), path.join(out, "core"));

  // Only this platform's adapter (plus the browser fallback).
  const adapters = adaptersFor(platform);
  for (const a of adapters) copy(path.join(ROOT, "platforms", a, "adapter.js"), path.join(out, "platforms", a, "adapter.js"));
  let html = fs.readFileSync(path.join(ROOT, "shared/ui/index.html"), "utf8");
  const begin = html.indexOf("<!-- ADAPTERS:BEGIN");
  const end = html.indexOf("<!-- ADAPTERS:END -->");
  if (begin < 0 || end < 0) throw new Error("index.html is missing the ADAPTERS markers");
  const tags = adapters.map((a) => `<script src="platforms/${a}/adapter.js"></script>`).join("\n");
  html = html.slice(0, begin) + tags + "\n" + html.slice(end + "<!-- ADAPTERS:END -->".length);
  fs.writeFileSync(path.join(out, "index.html"), html);

  const info = { version: VERSION, platform, commit: commit() };
  fs.writeFileSync(path.join(out, "build-info.js"), "window.TVV_BUILD = " + JSON.stringify(info) + ";\n");

  // Platform metadata.
  if (platform === "tizen") {
    const xml = fs.readFileSync(path.join(ROOT, "platforms/tizen/config.xml"), "utf8")
      .replace(/(<widget[^>]*\sversion=")[^"]*(")/, "$1" + VERSION + "$2");
    fs.writeFileSync(path.join(out, "config.xml"), xml);
    copy(path.join(ROOT, "platforms/tizen/icon.png"), path.join(out, "icon.png"));
  }
  if (platform === "webos") {
    const appinfo = JSON.parse(fs.readFileSync(path.join(ROOT, "platforms/webos/appinfo.json"), "utf8"));
    appinfo.version = VERSION;
    fs.writeFileSync(path.join(out, "appinfo.json"), JSON.stringify(appinfo, null, 2) + "\n");
    copy(path.join(ROOT, "platforms/webos/icon.png"), path.join(out, "icon.png"));
    copy(path.join(ROOT, "platforms/webos/largeIcon.png"), path.join(out, "largeIcon.png"));
  }
  if (platform === "vidaa") {
    fs.writeFileSync(path.join(out, "README.txt"),
      "TV Vibe for Hisense VIDAA " + VERSION + "\n\n" +
      "Host this folder over HTTPS and open index.html in the TV's browser, or hand it to a VIDAA partner\n" +
      "packaging flow. There is no public VIDAA install route; see platforms/vidaa/README.md.\n");
  }
  console.log(`built ${path.relative(ROOT, out)} (v${VERSION}, adapters: ${adapters.join(", ")})`);
  return out;
}

function zip(folder, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  rmrf(file);
  if (which("zip")) {
    const r = cp.spawnSync("zip", ["-qr", "-X", file, "."], { cwd: folder, stdio: "inherit" });
    if (r.status !== 0) throw new Error("zip failed");
  } else {
    const py = which("python3") || which("python");
    if (!py) throw new Error("Need zip or python to create " + file);
    const r = cp.spawnSync(py, ["-I", "-m", "zipfile", "-c", file, "."], { cwd: folder, stdio: "inherit" });
    if (r.status !== 0) throw new Error("python zipfile failed");
  }
  console.log("packaged " + path.relative(ROOT, file));
}

function packageTizen(folder) {
  zip(folder, path.join(PKG_DIR, `tvvibe-tizen-${VERSION}-unsigned.zip`));
  const tizen = which("tizen");
  const profile = process.env.TIZEN_PROFILE;
  if (tizen && profile) {
    // Signs with a certificate profile the owner created in Tizen Studio's Certificate Manager.
    const r = cp.spawnSync(tizen, ["package", "-t", "wgt", "-s", profile, "-o", PKG_DIR, "--", folder], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("tizen package failed");
  } else {
    console.log("tizen: no signed .wgt made (needs the Tizen CLI and TIZEN_PROFILE). See platforms/tizen/README.md.");
  }
}

function packageWebos(folder) {
  const ares = which("ares-package");
  if (!ares) {
    console.log("webos: ares-package not found; install with `npm install -g @webos-tools/cli`. Skipped the .ipk.");
    return false;
  }
  fs.mkdirSync(PKG_DIR, { recursive: true });
  const check = cp.spawnSync(ares, ["--check", folder], { stdio: "inherit" });
  if (check.status !== 0) throw new Error("ares-package --check failed");
  const r = cp.spawnSync(ares, ["-o", PKG_DIR, folder], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ares-package failed");
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("--")) || "all";
  const doPackage = args.indexOf("--package") >= 0;
  const targets = target === "all" ? PLATFORMS : [target];
  for (const t of targets) {
    if (PLATFORMS.indexOf(t) < 0) { console.error("Unknown platform " + t + ". Use: " + PLATFORMS.join(", ") + ", all"); process.exit(2); }
  }
  for (const t of targets) {
    const out = build(t);
    if (!doPackage) continue;
    if (t === "tizen") packageTizen(out);
    else if (t === "webos") packageWebos(out);
    else if (t === "vidaa") zip(out, path.join(PKG_DIR, `tvvibe-vidaa-${VERSION}.zip`));
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { build, adaptersFor, PLATFORMS, VERSION };
