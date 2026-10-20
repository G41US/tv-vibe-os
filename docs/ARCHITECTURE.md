# Architecture

TV Vibe runs as an ordinary app on each TV. One shared web UI, one small adapter per platform.

```
shared/
  core/            pure logic, no DOM — unit-tested in Node
    keys.js        remote key codes → up/down/left/right/ok/back/menu/red/info/exit
    focus.js       focus model (TV Home's navigation rules + Back handling)
    clock.js       greeting, 12/24-hour time, date line
    prefs.js       preferences: defaults, validation, migration, storage recovery, wallpapers, theme presets
    apps.js        dock + grid building, dock edits, tile colours, app catalogue
    contract.js    adapter contract, capability model, adapter selection, timeouts, diagnostics report, event log
  ui/              index.html, home.css, home.js (DOM + remote wiring), Outfit font, wallpapers
platforms/
  browser/adapter.js   preview / fallback (simulated apps and inputs)
  tizen/               adapter.js, config.xml, icon.png
  webos/               adapter.js, appinfo.json, icons
  vidaa/               adapter.js
tools/build.js     dist/<platform>/ + packages; tools/serve.js preview server
tests/             node --test: core, adapters (simulated platforms), build + compatibility lint
```

## Platform contract

Defined and checked in `shared/core/contract.js`. Every adapter provides:

| Area (brief, Stage 2) | Contract |
|---|---|
| App discovery and launching | `listApps()`, `launchApp(app)` |
| HDMI / input discovery and switching | `listInputs()`, `switchInput(input)`, optional `closeInput()` |
| Remote keys and focus | `init()` registers optional keys; `keys.js` normalises codes; `focus.js` owns movement |
| Clock, themes, wallpapers, preferences | shared (`clock.js`, `prefs.js`); storage is `localStorage` with in-memory fallback |
| Lifecycle and error recovery | `onResume(cb)` (visibility / `webOSRelaunch`), `exit()`; every platform call wrapped in `withTimeout`; UI falls back to defaults once on a render error |
| Capability detection and diagnostics | `capabilities()` returns a status + note for 11 capabilities; `report()` builds the diagnostics screen (Settings → Device & diagnostics, or the Info key) |
| Installation, updates, rollback | per-platform packaging in `tools/build.js`; procedures in each `platforms/*/README.md` and `docs/SECURITY-RECOVERY.md` |

Capability statuses: `available` (documented API present), `experimental`, `simulated`, `unavailable` (API missing on this device), `unsupported` (no public API on the platform). The UI hides nothing silently: unsupported features show their note.

## Why plain JavaScript and no framework

The oldest targets are webOS TV 4.x (Chromium 53) and Tizen 4.0 (Chromium 56). Plain ES2015 functions, flexbox and CSS variables run on both without a transpiler. `tests/build.test.js` rejects syntax and CSS those engines lack. The whole app is about 0.3 MB including the font and wallpapers, and makes no network requests.

## Isolation from the Android edition

- Separate repository: nothing in G41US/tv-vibehack is read at runtime or modified.
- Separate release channels: tags `tizen-v*`, `webos-v*`, `vidaa-v*`, each publishing only its own package, never marked "latest". (The Android updater follows tv-vibehack's latest release; that stays untouched.)
- Separate identifiers: Tizen `TVVibeOS01.TVVibe`, webOS `com.g41us.tvvibe`; the Android package stays `com.gathin.tvhome`.

## Milestones

| # | Milestone | State |
|---|---|---|
| 1 | Audit (docs/AUDIT.md) | done |
| 2 | Shared core + contract + browser preview | done, tested |
| 3 | webOS port and `.ipk` (most feasible: documented launch API, free Developer Mode, packager runs in CI) | done; needs an LG TV |
| 4 | Tizen port and WGT payload | done; needs a Samsung TV and the owner's certificate profile |
| 5 | VIDAA hosted web app | done (clock/wallpaper home only); needs a Hisense TV, partner access for packaging |
| 6 | Hardware validation | **not started** — see docs/HARDWARE-TESTS.md |

### Later milestones

1. Weather (needs a key-less public API and the user's city in settings).
2. Clock screensaver after idle (TV Home's `ClockDream`).
3. Custom wallpaper from a phone (TV Home's phone-link page) — on TVs this needs a hosted relay, so it is deferred.
4. Store submission (LG Seller Lounge, Samsung Seller Office) once hardware tests pass.
