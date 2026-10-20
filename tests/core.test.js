"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const keys = require("../shared/core/keys.js");
const focus = require("../shared/core/focus.js");
const clock = require("../shared/core/clock.js");
const prefs = require("../shared/core/prefs.js");
const apps = require("../shared/core/apps.js");

// ---- keys -------------------------------------------------------------------------------------------

test("keys: Back on every platform", () => {
  for (const code of [8, 27, 461, 10009]) assert.equal(keys.normalize({ keyCode: code }), "back", "code " + code);
});

test("keys: arrows, OK, colour and menu keys", () => {
  assert.equal(keys.normalize({ keyCode: 37 }), "left");
  assert.equal(keys.normalize({ keyCode: 40 }), "down");
  assert.equal(keys.normalize({ keyCode: 13 }), "ok");
  assert.equal(keys.normalize({ keyCode: 403 }), "red");
  assert.equal(keys.normalize({ keyCode: 10135 }), "menu");
  assert.equal(keys.normalize({ keyCode: 10182 }), "exit");
  assert.equal(keys.normalize({ key: "ArrowUp" }), "up");
  assert.equal(keys.normalize({ keyCode: 65 }), null);
  assert.equal(keys.normalize(null), null);
});

// ---- focus (mirrors TV Home's onTileVerticalKey) ------------------------------------------------------

const L = (tileCount, columns = 4, topCount = 3) => ({ tileCount, columns, topCount });

test("focus: left at a row start and right at a row end are swallowed", () => {
  let r = focus.move({ zone: "tiles", tile: 4, top: 0, lastDock: 0 }, "left", L(10));
  assert.equal(r.state.tile, 4);
  assert.equal(r.handled, true);
  r = focus.move({ zone: "tiles", tile: 3, top: 0, lastDock: 0 }, "right", L(10));
  assert.equal(r.state.tile, 3);
  r = focus.move({ zone: "tiles", tile: 9, top: 0, lastDock: 0 }, "right", L(10));
  assert.equal(r.state.tile, 9, "last tile of a short row");
});

test("focus: up from the dock goes to the top bar and down comes back to the same dock tile", () => {
  let r = focus.move({ zone: "tiles", tile: 2, top: 0, lastDock: 0 }, "up", L(10));
  assert.equal(r.state.zone, "top");
  r = focus.move(r.state, "down", L(10));
  assert.equal(r.state.zone, "tiles");
  assert.equal(r.state.tile, 2);
});

test("focus: down to a short last row lands on its last tile; down on the last row stays", () => {
  let r = focus.move({ zone: "tiles", tile: 7, top: 0, lastDock: 0 }, "down", L(10));
  assert.equal(r.state.tile, 9);
  r = focus.move(r.state, "down", L(10));
  assert.equal(r.state.tile, 9);
});

test("focus: back from the grid returns to the dock; back on the dock is the root", () => {
  let r = focus.move({ zone: "tiles", tile: 1, top: 0, lastDock: 0 }, "down", L(12));
  assert.equal(r.state.tile, 5);
  r = focus.move(r.state, "back", L(12));
  assert.equal(r.state.tile, 1, "returns to the dock tile it came from");
  assert.equal(r.atRoot, false);
  r = focus.move(r.state, "back", L(12));
  assert.equal(r.atRoot, true);
});

test("focus: top bar moves and clamps; back from top bar goes to the dock", () => {
  let s = { zone: "top", tile: 0, top: 0, lastDock: 3 };
  let r = focus.move(s, "left", L(8));
  assert.equal(r.state.top, 0);
  r = focus.move(r.state, "right", L(8));
  r = focus.move(r.state, "right", L(8));
  r = focus.move(r.state, "right", L(8));
  assert.equal(r.state.top, 2);
  r = focus.move(r.state, "back", L(8));
  assert.deepEqual([r.state.zone, r.state.tile], ["tiles", 3]);
});

test("focus: no tiles keeps focus in the top bar", () => {
  const r = focus.move({ zone: "top", tile: 0, top: 1, lastDock: 0 }, "down", L(0));
  assert.equal(r.state.zone, "top");
  assert.equal(focus.initial(L(0)).zone, "top");
});

test("focus: fit clamps after apps disappear or columns change", () => {
  const s = focus.fit({ zone: "tiles", tile: 20, top: 9, lastDock: 6 }, L(5, 4, 3));
  assert.equal(s.tile, 4);
  assert.equal(s.top, 2);
  assert.equal(s.lastDock, 3);
});

test("focus: unknown keys fall through", () => {
  assert.equal(focus.move({ zone: "tiles", tile: 0, top: 0, lastDock: 0 }, "info", L(4)).handled, false);
});

// ---- clock ------------------------------------------------------------------------------------------

test("clock: greeting thresholds match TV Home", () => {
  assert.equal(clock.greeting(4), "Good night");
  assert.equal(clock.greeting(5), "Good morning");
  assert.equal(clock.greeting(12), "Good afternoon");
  assert.equal(clock.greeting(17), "Good evening");
  assert.equal(clock.greeting(22), "Good night");
});

test("clock: 12- and 24-hour formats", () => {
  const d = new Date(2026, 9, 18, 17, 2);
  assert.deepEqual(clock.time(d, false), { time: "5:02", suffix: "PM" });
  assert.deepEqual(clock.time(d, true), { time: "17:02", suffix: "" });
  assert.deepEqual(clock.time(new Date(2026, 0, 1, 0, 5), false), { time: "12:05", suffix: "AM" });
  assert.equal(clock.dateLine(d, "en-GB"), "Sunday 18 October");
  assert.equal(clock.msToNextMinute(new Date(2026, 0, 1, 0, 0, 59, 500)), 500);
});

// ---- prefs ------------------------------------------------------------------------------------------

function fakeStorage(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

test("prefs: validation clamps like Config.java and drops junk", () => {
  const p = prefs.validate({ columns: 99, rows_below_dock: -2, background_color: "red", wallpaper: "nope",
    dock_apps: ["a", "a", 3, "", "b"], extra: true });
  assert.equal(p.columns, 7);
  assert.equal(p.rows_below_dock, 0);
  assert.equal(p.background_color, prefs.defaults().background_color);
  assert.equal(p.wallpaper, prefs.defaults().wallpaper);
  assert.deepEqual(p.dock_apps, ["a", "b"]);
  assert.equal("extra" in p, false);
});

test("prefs: a TV Home theme file applies with the same keys", () => {
  const theme = { dock_apps: ["com.netflix.ninja"], hidden_apps: ["x"], columns: 4, rows_below_dock: 0, background_color: "#000000", wallpaper: false };
  const p = prefs.applyTheme(prefs.defaults(), theme);
  assert.deepEqual(p.dock_apps, ["com.netflix.ninja"]);
  assert.equal(p.wallpaper, "black");
  assert.equal(p.dock_initialized, true);
  assert.equal(prefs.applyTheme(prefs.defaults(), prefs.preset("six-columns").values).columns, 6);
});

test("prefs: save and load round-trip", () => {
  const s = fakeStorage();
  const p = prefs.validate({ columns: 5, wallpaper: "ember", dock_apps: ["n"] });
  assert.equal(prefs.save(s, p), true);
  const back = prefs.load(s);
  assert.equal(back.recovered, false);
  assert.deepEqual(back.prefs, p);
});

test("prefs: unreadable data falls back to defaults and is kept for diagnostics", () => {
  const s = fakeStorage({ [prefs.KEY]: "{not json" });
  const r = prefs.load(s);
  assert.equal(r.recovered, true);
  assert.deepEqual(r.prefs, prefs.defaults());
  assert.equal(s.data[prefs.BACKUP_KEY], "{not json");
});

test("prefs: storage that throws never stops the launcher", () => {
  const broken = { getItem() { throw new Error("quota"); }, setItem() { throw new Error("quota"); } };
  const r = prefs.load(broken);
  assert.equal(r.persistent, false);
  assert.deepEqual(r.prefs, prefs.defaults());
  assert.equal(prefs.save(broken, r.prefs), false);
});

test("prefs: v1 shape migrates", () => {
  const r = prefs.migrate({ wallpaper: true, columns: 6 });
  assert.equal(r.schemaVersion, prefs.SCHEMA_VERSION);
  assert.equal(r.wallpaper, "aurora");
  assert.equal(r.columns, 6);
});

// ---- apps / dock --------------------------------------------------------------------------------------

const A = (key, name) => ({ key, name, platformId: key });
const LIST = [A("z", "Zed"), A("n", "Netflix"), A("y", "YouTube"), A("p", "Prime Video"), A("m", "Music"), A("a", "Alpha")];

test("apps: first-run dock prefers known streaming apps in TV Home's order", () => {
  assert.deepEqual(apps.initialDock(LIST, 4), ["y", "n", "p", "a"]);
});

test("apps: dock always has `columns` slots, pinned first, grid sorted, hidden apps removed", () => {
  const p = prefs.validate({ dock_apps: ["n", "missing"], hidden_apps: ["z"], columns: 4 });
  const b = apps.build(LIST, p);
  assert.equal(b.dockCount, 4);
  assert.deepEqual(b.tiles.map((t) => t.key), ["n", "a", "m", "p", "y"]);
  assert.deepEqual(Object.keys(b.pinned), ["n"]);
});

test("apps: dock edits", () => {
  let p = prefs.validate({ dock_apps: ["y", "n"], columns: 3 });
  let r = apps.addToDock(p, "p");
  assert.deepEqual(r.prefs.dock_apps, ["y", "n", "p"]);
  r = apps.addToDock(r.prefs, "m");
  assert.equal(r.needsReplace, true);
  p = apps.replaceInDock(r.prefs, "n", "m");
  assert.deepEqual(p.dock_apps, ["y", "m", "p"]);
  p = apps.moveInDock(p, "p", -1);
  assert.deepEqual(p.dock_apps, ["y", "p", "m"]);
  p = apps.moveInDock(p, "y", -1);
  assert.deepEqual(p.dock_apps, ["y", "p", "m"], "can't move past the start");
  p = apps.removeFromDock(p, "p");
  assert.deepEqual(p.dock_apps, ["y", "m"]);
  p = apps.hide(p, "y");
  assert.deepEqual([p.dock_apps, p.hidden_apps], [["m"], ["y"]]);
  assert.deepEqual(apps.unhideAll(p).hidden_apps, []);
});

test("apps: edits never mutate the previous preferences", () => {
  const p = prefs.validate({ dock_apps: ["y"] });
  apps.addToDock(p, "n");
  apps.hide(p, "y");
  assert.deepEqual(p.dock_apps, ["y"]);
  assert.deepEqual(p.hidden_apps, []);
});

test("apps: colours come from the catalogue, else a stable fallback", () => {
  assert.equal(apps.colorOf(A("3201907018807", "Netflix")), "#E50914");
  assert.equal(apps.colorOf(A("x", "Zed")), apps.colorOf(A("x", "Zed")));
  assert.match(apps.colorOf(A("x", "Zed")), /^#[0-9A-F]{6}$/i);
});
