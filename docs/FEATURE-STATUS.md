# Feature status

Three levels, kept strictly apart. **No feature is verified on TV hardware yet** — no Samsung, LG or Hisense TV has run this build. Everything below "verified" is verified by automated tests and headless Chromium only.

## Verified (automated tests + rendered in headless Chromium)

| Feature | How it was verified |
|---|---|
| TV Home layout: greeting, clock, date, Inputs/Network/Settings pills, hero title, ambient glow, glass dock, grid | Rendered at 1280×720 for the web, Tizen, webOS and VIDAA builds and compared against TV Home screenshots |
| Tile sizes per column count (180×101 dp at 4, ~144 dp at 5, ~119 dp at 6) | Same formula as `AppAdapter`; visual check |
| Remote navigation rules from TV Home (no row wrapping, Up from dock → top bar, Down on last row stays) | `tests/core.test.js` |
| Back: grid → dock → "Leave TV Vibe?" | `tests/core.test.js`, headless run |
| Long-press OK (600 ms), Red, Menu/Tools key → tile menu | Headless run |
| Dock editing: add, replace, move left/right, remove, hide, show hidden | `tests/core.test.js`, headless run |
| Wallpapers (TV Home's five + black), theme presets, columns 3–7, rows under dock, 12/24-hour clock | `tests/core.test.js`, headless run |
| Settings persistence, validation, migration, recovery from unreadable or failing storage | `tests/core.test.js` |
| UI error recovery (falls back to defaults once, keeps the old settings) | Code path; not fault-injected on a TV |
| Each adapter meets the contract and calls the documented API it names | `tests/adapters.test.js` with simulated `tizen`, `PalmServiceBridge` and VIDAA objects |
| No syntax or CSS newer than Chromium 53 (webOS TV 4.x) in shipped files | `tests/build.test.js` |
| webOS `.ipk` is valid, contains the right files, declares the ACG groups it uses; minified output still runs | `ares-package --check`, `ares-package -i`, headless run of the extracted package |
| No signing keys or credentials in the repository | `tests/build.test.js` |

## Implemented on documented APIs, awaiting hardware tests

| Platform | Feature | API |
|---|---|---|
| Tizen | List installed apps | `tizen.application.getAppsInfo()` |
| Tizen | Open apps | `tizen.application.launch()` |
| Tizen | Model / firmware | `tizen.systeminfo.getPropertyValue("BUILD")` |
| Tizen | Network type | `tizen.systeminfo.getPropertyValue("NETWORK")` |
| Tizen | Colour / Tools / Info keys | `tizen.tvinputdevice.registerKeyBatch()` (only keys the TV lists) |
| Tizen | Leave app | `tizen.application.getCurrentApplication().exit()` |
| webOS | Open apps | `luna://com.webos.applicationManager/launch` |
| webOS | Check which known apps are installed | `luna://com.webos.applicationManager/getAppLoadStatus` (webOS TV 4.0+) |
| webOS | Model / firmware | `luna://com.webos.service.tv.systemproperty/getSystemInfo` |
| webOS | Network | `luna://com.palm.connectionmanager/getStatus` |
| webOS | Back key, leave app | keyCode 461 with `disableBackHistoryAPI`, `window.close()` |

## Experimental (off the standard path, or relies on non-documented details)

| Platform | Feature | Why experimental |
|---|---|---|
| Tizen | List HDMI/TV sources | `systeminfo` `VIDEOSOURCE` is documented, but what retail firmware reports needs checking |
| Tizen | "Switch" input | TVWindow shows the source **inside this app**; it does not change the TV's own input |
| webOS | App IDs in the catalogue (`netflix`, `youtube.leanback.v4`, …) | Community-sourced; each is only shown after the TV confirms it is installed |
| webOS | HDMI / Live TV (`com.webos.app.hdmi1`…) | Community-sourced app IDs launched with the documented launch method |
| VIDAA | Model / firmware via `Hisense_GetModelName` etc. | Undocumented; read-only, used for diagnostics only |
| VIDAA | Colour keys, storage persistence, `window.close()` | Depend on the VIDAA browser engine |

## Unsupported (no public API; not attempted)

| Feature | Tizen | webOS | VIDAA |
|---|---|---|---|
| Replace the TV's own Home screen | No public API | No public API for ordinary apps | No public API |
| Take over the physical Home button | Home is not a registrable key | Home is handled by the system | No public API |
| Open at power-on | No public API (prelaunch only pre-loads in the background) | No public API for ordinary apps | No public API |
| List / open other apps | — | — | No public API |
| Switch inputs | — | — | No public API |

Community projects that replace LG's Home or start apps at boot require rooting the TV. That is outside this project's standard installation path by design (see the brief's rules 6 and 7) and is not implemented. If such an integration is ever added, it must live in a separate, clearly labelled folder with its own uninstall and recovery steps, tested on named firmware.

## TV Home features not ported (yet)

Weather, clock screensaver, phone-link page (Wi-Fi setup, photo upload), guest Wi-Fi QR code, data usage, VPN badge, settings backup to the device, in-app updater. See `docs/ARCHITECTURE.md` → "Later milestones".
