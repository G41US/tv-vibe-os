/*
 * TV Vibe home screen controller: renders the shared UI and talks to the platform adapter picked by
 * shared/core/contract.js. All decisions (focus moves, dock edits, preference validation) live in the
 * unit-tested modules under shared/core; this file only wires them to the DOM and the remote.
 */
(function () {
  "use strict";

  var T = window.TVV;
  var keys = T.keys, focusModel = T.focus, clock = T.clock, P = T.prefs, A = T.apps, C = T.contract;
  var BUILD = window.TVV_BUILD || { version: "dev", platform: "source", commit: "" };
  var log = C.createLog(50);

  function $(id) { return document.getElementById(id); }
  function div(cls, text) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    if (text !== undefined) d.textContent = text;
    return d;
  }

  var el = {
    root: document.documentElement, screen: $("screen"), wallpaper: $("wallpaper"), ambient: $("ambient"),
    rail: $("rail"), hero: $("hero"), dockRow: $("dock-row"), grid: $("grid"), empty: $("empty"), scrim: $("scrim"),
    greeting: $("greeting"), time: $("time"), suffix: $("suffix"), date: $("date"), networkLabel: $("network-label"),
    sheet: $("sheet"), sheetTitle: $("sheet-title"), sheetBody: $("sheet-body"), toast: $("toast"),
    watching: $("watching"), watchingLabel: $("watching-label")
  };
  var pillEls = Array.prototype.slice.call(document.querySelectorAll(".pill"));

  var adapter = C.select(T.adapters || [], T.browserAdapter);
  var storage = pickStorage();
  var loaded = P.load(storage);
  var prefs = loaded.prefs;
  if (loaded.error) log.add("warn", loaded.error);

  var state = {
    apps: [], built: { tiles: [], dockCount: 0, pinned: {} }, tileEls: [],
    focus: focusModel.initial({ tileCount: 0 }), device: null, network: null, appsError: null, appsLoaded: false,
    sheets: [], watching: null, okTimer: null, safeMode: false, geometry: null, toastTimer: null, lastKey: null
  };

  // ---- storage --------------------------------------------------------------------------------------

  function pickStorage() {
    try {
      var s = window.localStorage;
      s.setItem("tvvibe.probe", "1");
      s.removeItem("tvvibe.probe");
      return s;
    } catch (e) {
      log.add("warn", "localStorage unavailable, settings last until the app closes");
      return P.memoryStorage();
    }
  }

  function update(next, focusKey) {
    prefs = P.validate(next);
    if (!P.save(storage, prefs)) log.add("warn", "settings could not be saved");
    applyLook();
    rebuild(focusKey === undefined ? currentKey() : focusKey);
  }

  // ---- layout ---------------------------------------------------------------------------------------

  function sizeRoot() {
    var px = Math.min(window.innerWidth / 96, window.innerHeight / 54);
    el.root.style.fontSize = px + "px";
  }

  /** Tile geometry for the column count, as TV Home: 180x101 dp at 4 columns, shrinking from 5 up. */
  function geometry() {
    var cols = prefs.columns;
    var content = 84.8 - 2 * 1.35;
    var w = Math.min(18, content / (cols + 0.175 * (cols - 1)));
    var gap = cols > 1 ? (content - cols * w) / (cols - 1) : 0;
    var h = w * 101 / 180;
    var rowPitch = h + 4.2;
    var dockTop = 47.6 - (h + 2.6) - prefs.rows_below_dock * rowPitch;
    if (dockTop < 18) dockTop = 18;
    return { cols: cols, w: w, h: h, gap: gap, radius: 1.6 * Math.min(1, w / 18), rowPitch: rowPitch, dockTop: dockTop,
      gridTop: dockTop + h + 7.0 };
  }

  function applyGeometry() {
    var g = geometry();
    state.geometry = g;
    var s = el.root.style;
    s.setProperty("--tile-w", g.w + "rem");
    s.setProperty("--tile-h", g.h + "rem");
    s.setProperty("--gap", g.gap + "rem");
    s.setProperty("--radius", g.radius + "rem");
    s.setProperty("--row-pitch", g.rowPitch + "rem");
    s.setProperty("--dock-top", g.dockTop + "rem");
  }

  function applyLook() {
    var wp = P.wallpaper(prefs.wallpaper);
    el.root.style.setProperty("--bg", prefs.background_color);
    el.wallpaper.style.backgroundImage = wp.file ? "url(\"" + wp.file + "\")" : "none";
  }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
  }

  // ---- tiles ----------------------------------------------------------------------------------------

  function wordmark(app) {
    var w = div("wordmark", app.name);
    w.style.color = A.textColorOf(app);
    var g = state.geometry;
    var size = g.w * 0.17;
    var fit = g.w * 1.45 / Math.max(4, app.name.length);
    w.style.fontSize = Math.min(size, fit) + "rem";
    return w;
  }

  function makeTile(app, index) {
    var t = div("tile");
    var card = div("card");
    card.style.background = A.colorOf(app);
    if (app.iconUrl) {
      var img = document.createElement("img");
      img.alt = "";
      img.onerror = function () {
        if (img.parentNode) img.parentNode.removeChild(img);
        card.appendChild(wordmark(app));
      };
      img.src = app.iconUrl;
      card.appendChild(img);
    } else {
      card.appendChild(wordmark(app));
    }
    t.appendChild(card);
    t.appendChild(div("pin"));
    t.appendChild(div("name", app.name));
    t.addEventListener("mouseenter", function () { if (!isBusy()) setFocus({ zone: "tiles", tile: index }); });
    t.addEventListener("click", function () { if (isBusy()) return; setFocus({ zone: "tiles", tile: index }); openApp(index); });
    return t;
  }

  function renderTiles() {
    var g = state.geometry;
    var tiles = state.built.tiles;
    el.dockRow.innerHTML = "";
    el.grid.innerHTML = "";
    state.tileEls = [];
    var i;
    for (i = 0; i < state.built.dockCount; i++) {
      var t = makeTile(tiles[i], i);
      el.dockRow.appendChild(t);
      state.tileEls.push(t);
    }
    var row = null;
    for (i = state.built.dockCount; i < tiles.length; i++) {
      if ((i - state.built.dockCount) % g.cols === 0) { row = div("row"); el.grid.appendChild(row); }
      var t2 = makeTile(tiles[i], i);
      row.appendChild(t2);
      state.tileEls.push(t2);
    }
    renderEmpty();
  }

  function renderEmpty() {
    var msg = "";
    if (!state.built.tiles.length) {
      var caps = adapter.capabilities();
      if (caps.appLaunch.status === "unsupported") {
        msg = adapter.emptyMessage || "This TV doesn't let apps open other apps, so TV Vibe shows your clock and wallpaper here. Open apps from the TV's own Home.";
      } else if (state.appsError) {
        msg = "Couldn't list apps: " + state.appsError + " See Settings → Device & diagnostics.";
      } else if (state.appsLoaded) {
        msg = state.apps.length ? "All apps are hidden. Settings → Show hidden apps brings them back." : "No apps found on this TV.";
      } else {
        msg = "Loading apps…";
      }
    }
    el.empty.textContent = msg;
    el.empty.className = msg ? "empty" : "empty hidden";
    el.dockRow.style.display = msg ? "none" : "";
  }

  function rebuild(focusKey) {
    safely(function () {
      state.built = A.build(state.apps, prefs);
      applyGeometry();
      renderTiles();
      var idx = -1;
      for (var i = 0; i < state.built.tiles.length; i++) if (state.built.tiles[i].key === focusKey) idx = i;
      if (idx >= 0) { state.focus.zone = "tiles"; state.focus.tile = idx; }
      state.focus = focusModel.fit(state.focus, layout());
      applyFocus();
    });
  }

  function layout() {
    return { columns: prefs.columns, tileCount: state.built.tiles.length, topCount: pillEls.length };
  }

  function currentKey() {
    var t = state.built.tiles[state.focus.tile];
    return state.focus.zone === "tiles" && t ? t.key : state.lastKey;
  }

  // ---- focus ----------------------------------------------------------------------------------------

  function setFocus(partial) {
    for (var k in partial) if (Object.prototype.hasOwnProperty.call(partial, k)) state.focus[k] = partial[k];
    state.focus = focusModel.fit(state.focus, layout());
    if (state.focus.zone === "tiles" && state.focus.tile < prefs.columns) state.focus.lastDock = state.focus.tile;
    applyFocus();
  }

  function applyFocus() {
    var i;
    for (i = 0; i < pillEls.length; i++) pillEls[i].className = "pill";
    for (i = 0; i < state.tileEls.length; i++) state.tileEls[i].className = "tile";
    var g = state.geometry;
    var offset = 0;
    if (state.focus.zone === "top") {
      pillEls[state.focus.top].className = "pill focused";
      hideHero();
    } else if (state.tileEls[state.focus.tile]) {
      var idx = state.focus.tile;
      var app = state.built.tiles[idx];
      state.lastKey = app.key;
      state.tileEls[idx].className = "tile focused" + (state.built.pinned[app.key] ? " pinned" : "");
      var row = focusModel.rowOf(idx, prefs.columns);
      if (row === 0) showHero(app);
      else {
        hideHero();
        var rowTop = g.gridTop + (row - 1) * g.rowPitch;
        offset = Math.max(0, rowTop - 15.5);
      }
    }
    // Rows scrolled up past the focused one would sit under the clock; fade them out instead.
    var focusRow = state.focus.zone === "tiles" ? focusModel.rowOf(state.focus.tile, prefs.columns) : 0;
    $("dock").style.opacity = focusRow >= 1 ? "0" : "1";
    var rows = el.grid.childNodes;
    for (i = 0; i < rows.length; i++) rows[i].style.opacity = i + 1 < focusRow ? "0" : "1";
    var tr = "translateY(" + (-offset) + "rem)";
    el.rail.style.webkitTransform = tr;
    el.rail.style.transform = tr;
    el.scrim.className = offset > 0 ? "scrim on" : "scrim";
  }

  function showHero(app) {
    if (el.hero.textContent !== app.name) el.hero.textContent = app.name;
    el.hero.className = "hero on";
    var rgb = hexToRgb(A.colorOf(app));
    el.ambient.style.backgroundImage = "radial-gradient(ellipse 62% 78% at 30% 40%, rgba(" + rgb + ",.40), rgba(" + rgb + ",.16) 45%, rgba(" + rgb + ",0) 78%)";
    el.ambient.className = "ambient on";
  }

  function hideHero() {
    el.hero.className = "hero";
    el.ambient.className = "ambient";
  }

  // ---- actions --------------------------------------------------------------------------------------

  function openApp(index) {
    var app = state.built.tiles[index];
    if (!app) return;
    C.withTimeout(adapter.launchApp(app), 10000, "Opening " + app.name).then(function (res) {
      if (res && res.message) toast(res.message);
      log.add("info", "opened " + app.key);
    }, function (err) {
      log.add("error", err.message);
      toast(err.message);
    });
  }

  function activatePill(name) {
    if (name === "settings") settingsMenu();
    else if (name === "inputs") inputsMenu();
    else if (name === "network") {
      refreshNetwork().then(function () {
        var n = state.network;
        toast(n ? (n.online ? "Connected: " + n.type : "Not connected to the internet") : "Network status unavailable");
      });
    }
  }

  function shortPress() {
    if (state.focus.zone === "top") activatePill(pillEls[state.focus.top].getAttribute("data-pill"));
    else openApp(state.focus.tile);
  }

  function longPress() {
    if (state.focus.zone === "tiles" && state.built.tiles[state.focus.tile]) tileMenu(state.focus.tile);
    else if (state.focus.zone === "top") activatePill(pillEls[state.focus.top].getAttribute("data-pill"));
  }

  function startWatching(input) {
    state.watching = input;
    el.watchingLabel.textContent = input.name;
    el.watching.className = "watching";
    document.body.className = "watching";
  }

  function stopWatching() {
    var close = adapter.closeInput ? adapter.closeInput() : Promise.resolve();
    Promise.resolve(close).then(function () {
      state.watching = null;
      el.watching.className = "watching hidden";
      document.body.className = "";
    });
  }

  function confirmLeave() {
    var exitCap = adapter.capabilities().exit;
    if (exitCap.status !== "available" && exitCap.status !== "experimental") return;
    openSheet("Leave TV Vibe?", [
      { label: "Stay" },
      { label: "Leave", action: function () { adapter.exit(); } }
    ]);
  }

  // ---- menus ----------------------------------------------------------------------------------------

  function settingsMenu() {
    var hiddenCount = prefs.hidden_apps.length;
    openSheet("Settings", [
      { label: "Wallpaper", sub: P.wallpaper(prefs.wallpaper).name, action: wallpaperMenu },
      { label: "Theme", sub: "TV Home presets", action: presetMenu },
      { label: "Apps per row", sub: String(prefs.columns), action: columnsMenu },
      { label: "Rows under the dock", sub: String(prefs.rows_below_dock), action: rowsMenu },
      { label: "Clock", sub: prefs.clock_24h === null ? "Automatic" : (prefs.clock_24h ? "24-hour" : "12-hour"), action: clockMenu },
      { label: "Show hidden apps", sub: hiddenCount ? String(hiddenCount) + " hidden" : "None hidden", disabled: !hiddenCount,
        action: function () { update(A.unhideAll(prefs)); toast("Hidden apps are back."); } },
      { label: "Device & diagnostics", action: diagnostics },
      { label: "Reset settings", action: resetMenu },
      { label: "About", sub: "v" + BUILD.version, action: about }
    ]);
  }

  function choiceMenu(title, options, current, apply) {
    openSheet(title, options.map(function (o) {
      return { label: o.label, checked: o.value === current, action: function () { apply(o.value); } };
    }));
  }

  function wallpaperMenu() {
    choiceMenu("Wallpaper", P.WALLPAPERS.map(function (w) { return { label: w.name, value: w.key }; }), prefs.wallpaper, function (v) {
      var next = copy(prefs); next.wallpaper = v; update(next);
    });
  }

  function presetMenu() {
    openSheet("Theme", P.PRESETS.map(function (p) {
      return { label: p.name, action: function () { update(P.applyTheme(prefs, p.values)); toast("Theme: " + p.name); } };
    }));
  }

  function columnsMenu() {
    choiceMenu("Apps per row", [3, 4, 5, 6, 7].map(function (n) { return { label: String(n), value: n }; }), prefs.columns, function (v) {
      var next = copy(prefs); next.columns = v; update(next);
    });
  }

  function rowsMenu() {
    choiceMenu("Rows under the dock", [0, 1, 2].map(function (n) { return { label: String(n), value: n }; }), prefs.rows_below_dock, function (v) {
      var next = copy(prefs); next.rows_below_dock = v; update(next);
    });
  }

  function clockMenu() {
    choiceMenu("Clock", [{ label: "Automatic", value: null }, { label: "12-hour", value: false }, { label: "24-hour", value: true }],
      prefs.clock_24h, function (v) { var next = copy(prefs); next.clock_24h = v; update(next); tick(); });
  }

  function resetMenu() {
    openSheet("Reset settings?", [
      { label: "Cancel" },
      { label: "Reset dock, wallpaper and layout", action: function () {
        var d = P.defaults();
        prefs = d;
        P.save(storage, prefs);
        applyLook();
        state.focus = focusModel.initial(layout());
        if (state.apps.length) {
          prefs.dock_apps = A.initialDock(state.apps, prefs.columns);
          prefs.dock_initialized = true;
          P.save(storage, prefs);
        }
        rebuild(null);
        toast("Settings reset.");
      } }
    ]);
  }

  function about() {
    openSheet("About TV Vibe", [
      { label: "Version", sub: BUILD.version + (BUILD.commit ? " (" + BUILD.commit + ")" : ""), info: true },
      { label: "Build", sub: BUILD.platform, info: true },
      { label: "Running on", sub: adapter.name, info: true },
      { label: "TV Vibe is an app, not a system launcher. Your TV's own Home screen is never changed, so uninstalling TV Vibe leaves the TV as it was.", info: true },
      { label: "Based on TV Home / tv-vibehack (MIT). Outfit font under the SIL Open Font License.", info: true }
    ]);
  }

  function diagnostics() {
    var rep = C.report(adapter, state.device, { version: BUILD.version, build: BUILD.platform });
    var d = state.device || {};
    var items = [
      { label: "Platform", sub: rep.platformName, info: true },
      { label: "Device", sub: [d.manufacturer, d.model].filter(Boolean).join(" ") || "Unknown", info: true },
      { label: "OS / firmware", sub: [d.os, d.osVersion, d.firmware].filter(Boolean).join(" · ") || "Unknown", info: true },
      { label: "Settings storage", sub: loaded.persistent ? "Saved on this TV" : "Not persistent", info: true },
      { label: "Apps found", sub: String(state.apps.length), info: true }
    ];
    rep.capabilities.forEach(function (cap) {
      items.push({ label: cap.label, badge: cap.status, note: cap.note, info: true });
    });
    var entries = log.entries();
    items.push({ label: entries.length ? "Recent events" : "No errors recorded", info: true });
    entries.slice(-8).reverse().forEach(function (e) {
      items.push({ label: e.level + ": " + e.message, sub: e.t.slice(11, 19), info: true });
    });
    openSheet("Device & diagnostics", items, { wide: true });
  }

  function inputsMenu() {
    var caps = adapter.capabilities();
    if (caps.inputList.status === "unsupported" || caps.inputList.status === "unavailable") {
      openSheet("Inputs", [{ label: caps.inputList.note, info: true }]);
      return;
    }
    openSheet("Inputs", [{ label: "Looking for inputs…", info: true }]);
    var token = state.sheets[state.sheets.length - 1];
    C.withTimeout(adapter.listInputs(), 8000, "Input list").then(function (inputs) {
      if (state.sheets[state.sheets.length - 1] !== token) return;
      var items = inputs.map(function (input) {
        return { label: input.name, action: function () { switchTo(input); } };
      });
      if (!items.length) items.push({ label: "No connected inputs were reported by the TV.", info: true });
      items.push({ label: caps.inputSwitch.note, info: true });
      replaceSheet(items);
    }, function (err) {
      log.add("error", err.message);
      if (state.sheets[state.sheets.length - 1] === token) replaceSheet([{ label: "Couldn't list inputs: " + err.message, info: true }]);
    });
  }

  function switchTo(input) {
    C.withTimeout(adapter.switchInput(input), 10000, "Switching to " + input.name).then(function (res) {
      if (res && res.message) toast(res.message);
      else if (res && res.embedded) startWatching(input);
    }, function (err) {
      log.add("error", err.message);
      toast(err.message);
    });
  }

  function tileMenu(index) {
    var app = state.built.tiles[index];
    var pinnedKeys = prefs.dock_apps.filter(function (k) { return !!state.built.pinned[k]; });
    var at = pinnedKeys.indexOf(app.key);
    var items = [{ label: "Open", action: function () { openApp(index); } }];
    if (at >= 0) {
      items.push({ label: "Move left", disabled: at === 0, action: function () { update(A.moveInDock(prefs, app.key, -1), app.key); } });
      items.push({ label: "Move right", disabled: at === pinnedKeys.length - 1, action: function () { update(A.moveInDock(prefs, app.key, 1), app.key); } });
      items.push({ label: "Remove from dock", action: function () { update(A.removeFromDock(prefs, app.key), app.key); } });
    } else {
      var full = prefs.dock_apps.length >= prefs.columns;
      items.push({ label: full ? "Add to dock (replace an app)" : "Add to dock", action: function () {
        var r = A.addToDock(prefs, app.key);
        if (!r.needsReplace) { update(r.prefs, app.key); return; }
        openSheet("Replace which dock app?", pinnedKeys.map(function (k) {
          var other = findApp(k);
          return { label: other ? other.name : k, action: function () { update(A.replaceInDock(prefs, k, app.key), app.key); } };
        }));
      } });
    }
    items.push({ label: "Hide app", action: function () { update(A.hide(prefs, app.key), null); toast(app.name + " hidden. Settings → Show hidden apps brings it back."); } });
    openSheet(app.name, items);
  }

  function findApp(key) {
    for (var i = 0; i < state.apps.length; i++) if (state.apps[i].key === key) return state.apps[i];
    return null;
  }

  function copy(o) {
    var out = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k];
    return out;
  }

  // ---- sheet (modal list) ---------------------------------------------------------------------------

  function isBusy() { return state.sheets.length > 0 || !!state.watching; }

  function firstSelectable(items) {
    for (var i = 0; i < items.length; i++) if (!items[i].disabled) return i;
    return 0;
  }

  function openSheet(title, items, opts) {
    state.sheets.push({ title: title, items: items, sel: firstSelectable(items), opts: opts || {} });
    renderSheet();
  }

  function replaceSheet(items) {
    var s = state.sheets[state.sheets.length - 1];
    if (!s) return;
    s.items = items;
    s.sel = firstSelectable(items);
    renderSheet();
  }

  function closeSheets() {
    state.sheets = [];
    el.sheet.className = "sheet hidden";
    applyFocus();
  }

  function renderSheet() {
    var s = state.sheets[state.sheets.length - 1];
    if (!s) { closeSheets(); return; }
    el.sheet.className = "sheet" + (s.opts.wide ? " wide" : "");
    el.sheetTitle.textContent = s.title;
    el.sheetBody.innerHTML = "";
    var scroll = div("sheet-scroll");
    s.items.forEach(function (item, i) {
      var cls = "item" + (item.checked ? " checked" : "") + (item.disabled ? " disabled" : "") + (item.info ? " info" : "") + (i === s.sel ? " focused" : "");
      var row = div(cls);
      row.appendChild(div("label", item.label));
      if (item.badge) {
        var right = div("sub");
        var badge = document.createElement("span");
        badge.className = "status st-" + item.badge;
        badge.textContent = item.badge;
        right.appendChild(badge);
        if (item.note) right.appendChild(div("", item.note));
        row.appendChild(right);
      } else if (item.sub) {
        row.appendChild(div("sub", item.sub));
      }
      row.addEventListener("mouseenter", function () { if (!item.disabled) { s.sel = i; markSheet(); } });
      row.addEventListener("click", function () { s.sel = i; activateSheetItem(); });
      scroll.appendChild(row);
    });
    el.sheetBody.appendChild(scroll);
    markSheet();
  }

  function markSheet() {
    var s = state.sheets[state.sheets.length - 1];
    var scroll = el.sheetBody.firstChild;
    if (!s || !scroll) return;
    var rows = scroll.childNodes;
    for (var i = 0; i < rows.length; i++) {
      rows[i].className = rows[i].className.replace(/\s?focused/g, "") + (i === s.sel ? " focused" : "");
    }
    var target = rows[s.sel];
    if (!target) return;
    var viewH = el.sheetBody.clientHeight || 1;
    var top = target.offsetTop, bottom = top + target.offsetHeight;
    var cur = s.scroll || 0;
    if (bottom - cur > viewH) cur = bottom - viewH;
    if (top < cur) cur = top;
    s.scroll = Math.max(0, cur);
    scroll.style.webkitTransform = "translateY(" + (-s.scroll) + "px)";
    scroll.style.transform = "translateY(" + (-s.scroll) + "px)";
  }

  function activateSheetItem() {
    var s = state.sheets[state.sheets.length - 1];
    var item = s && s.items[s.sel];
    if (!item || item.disabled || item.info) return;
    var depth = state.sheets.length;
    if (!item.action) { closeSheets(); return; }
    safely(function () { item.action(); });
    // An action that opened another sheet keeps the stack; anything else closes the menus.
    if (state.sheets.length <= depth && state.sheets[depth - 1] === s) closeSheets();
  }

  function sheetKey(k, repeat) {
    var s = state.sheets[state.sheets.length - 1];
    if (k === "up" || k === "down") {
      var step = k === "up" ? -1 : 1;
      var i = s.sel;
      for (var n = 0; n < s.items.length; n++) {
        i += step;
        if (i < 0 || i >= s.items.length) return;
        if (!s.items[i].disabled) { s.sel = i; markSheet(); return; }
      }
    } else if (k === "ok") {
      if (!repeat) activateSheetItem();
    } else if (k === "back" || k === "exit" || k === "red" || k === "menu") {
      state.sheets.pop();
      if (state.sheets.length) renderSheet(); else closeSheets();
    }
  }

  // ---- input ----------------------------------------------------------------------------------------

  document.addEventListener("keydown", function (e) {
    var k = keys.normalize(e);
    if (!k) return;
    e.preventDefault();
    if (state.watching) { if (k === "back" || k === "exit") stopWatching(); return; }
    if (state.sheets.length) { sheetKey(k, e.repeat); return; }
    if (k === "ok") {
      if (e.repeat || state.okTimer) return;
      state.okTimer = setTimeout(function () { state.okTimer = null; state.okLong = true; longPress(); }, keys.LONG_PRESS_MS);
      return;
    }
    if (k === "red" || k === "menu") { longPress(); return; }
    if (k === "info") { diagnostics(); return; }
    if (k === "exit") { adapter.exit(); return; }
    if (k === "green" || k === "yellow" || k === "blue") return;
    var r = focusModel.move(state.focus, k, layout());
    state.focus = r.state;
    applyFocus();
    if (r.atRoot) confirmLeave();
  }, true);

  document.addEventListener("keyup", function (e) {
    if (keys.normalize(e) !== "ok") return;
    e.preventDefault();
    if (state.okTimer) {
      clearTimeout(state.okTimer);
      state.okTimer = null;
      if (!isBusy()) shortPress();
    }
  }, true);

  pillEls.forEach(function (p, i) {
    p.addEventListener("mouseenter", function () { if (!isBusy()) setFocus({ zone: "top", top: i }); });
    p.addEventListener("click", function () { if (isBusy()) return; setFocus({ zone: "top", top: i }); activatePill(p.getAttribute("data-pill")); });
  });

  document.addEventListener("wheel", function (e) {
    if (isBusy()) return;
    var r = focusModel.move(state.focus, e.deltaY > 0 ? "down" : "up", layout());
    state.focus = r.state;
    applyFocus();
  });

  // ---- clock, network, lifecycle --------------------------------------------------------------------

  function tick() {
    var now = new Date();
    var use24 = prefs.clock_24h === null ? clock.prefers24(navigator.language) : prefs.clock_24h;
    var t = clock.time(now, use24);
    el.greeting.textContent = clock.greeting(now.getHours());
    el.time.textContent = t.time;
    el.suffix.textContent = t.suffix;
    el.date.textContent = clock.dateLine(now, navigator.language);
    clearTimeout(state.clockTimer);
    state.clockTimer = setTimeout(tick, clock.msToNextMinute(new Date()) + 50);
  }

  function refreshNetwork() {
    return C.withTimeout(adapter.getNetwork(), 5000, "Network status").then(function (n) {
      state.network = n;
      el.networkLabel.textContent = n.online ? n.type : "Offline";
    }, function (err) {
      log.add("warn", err.message);
    });
  }

  function refreshApps() {
    var keep = currentKey();
    var first = !state.appsLoaded;
    return C.withTimeout(adapter.listApps(), 12000, "App list").then(function (apps) {
      state.apps = apps;
      // First load: start on the dock, as TV Home does, unless the user already moved to the top bar.
      if (first && state.focus.zone === "top" && state.focus.top === 0 && apps.length) state.focus.zone = "tiles";
      state.appsError = null;
      state.appsLoaded = true;
      if (!prefs.dock_initialized && apps.length) {
        var next = copy(prefs);
        next.dock_apps = A.initialDock(apps, prefs.columns);
        next.dock_initialized = true;
        prefs = P.validate(next);
        P.save(storage, prefs);
      }
      rebuild(keep);
    }, function (err) {
      state.appsError = err.message;
      state.appsLoaded = true;
      log.add("error", err.message);
      rebuild(keep);
    });
  }

  function onResume() {
    tick();
    refreshNetwork();
    refreshApps();
  }

  // ---- error recovery -------------------------------------------------------------------------------

  function toast(message) {
    el.toast.textContent = message;
    el.toast.className = "toast on";
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { el.toast.className = "toast"; }, 4200);
  }

  /** Runs a UI step; if it throws, falls back once to default settings (keeping a copy) and redraws. */
  function safely(fn) {
    try {
      fn();
    } catch (e) {
      log.add("error", "UI error: " + (e && e.message || e));
      if (state.safeMode) return;
      state.safeMode = true;
      try { storage.setItem(P.BACKUP_KEY, JSON.stringify(prefs)); } catch (ignored) { /* best effort */ }
      prefs = P.defaults();
      P.save(storage, prefs);
      applyLook();
      try {
        state.built = A.build(state.apps, prefs);
        applyGeometry();
        renderTiles();
        state.focus = focusModel.fit(focusModel.initial(layout()), layout());
        applyFocus();
      } catch (e2) {
        log.add("error", "recovery failed: " + (e2 && e2.message || e2));
      }
      toast("Something went wrong, so settings were reset. The old ones are kept for diagnostics.");
    }
  }

  window.addEventListener("error", function (ev) {
    log.add("error", (ev.message || "error") + (ev.filename ? " @ " + ev.filename.split("/").pop() + ":" + ev.lineno : ""));
  });
  window.addEventListener("unhandledrejection", function (ev) {
    log.add("error", "unhandled: " + (ev.reason && ev.reason.message || ev.reason));
  });

  // ---- start ----------------------------------------------------------------------------------------

  function start() {
    sizeRoot();
    window.addEventListener("resize", function () { sizeRoot(); applyFocus(); });
    applyLook();
    tick();
    rebuild(null);
    if (loaded.recovered) toast("Saved settings couldn't be read, so defaults are in use.");
    var problems = C.validate(adapter);
    if (problems.length) log.add("error", "adapter " + adapter.id + ": " + problems.join("; "));
    C.withTimeout(adapter.init(), 4000, "Platform setup").then(null, function (err) {
      log.add("warn", err.message);
    }).then(function () {
      adapter.onResume(onResume);
      C.withTimeout(adapter.getDeviceInfo(), 5000, "Device info").then(function (d) { state.device = d; }, function (err) { log.add("warn", err.message); });
      refreshNetwork();
      return refreshApps();
    });
  }

  // Exposed for tests and the diagnostics checklist; not used by the UI itself.
  window.TVVibe = {
    adapter: adapter,
    state: function () { return { focus: state.focus, tiles: state.built.tiles.map(function (t) { return t.key; }), dockCount: state.built.dockCount, prefs: prefs, sheets: state.sheets.length }; },
    report: function () { return C.report(adapter, state.device, { version: BUILD.version, log: log.entries() }); }
  };

  start();
}());
