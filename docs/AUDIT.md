# Stage 1 — Repository audit

Audited on 2026-10-20 from the actual source of two repositories:

- **G41US/tv-vibehack** `main` @ `dc79e1b` — the working Android / Airtel Smart Box edition ("TV Home").
- **G41US/tv-vibe-os** `main` @ `454aabc` — the cross-platform repository this branch replaces.

Also found: branch `port/smart-tv-platforms` on tv-vibehack (14 commits, 317 lines, last commit 2026-10-20). It is a second scaffold of the same idea. It is left untouched; see "Recommendation" at the end.

---

## 1. Android / Airtel edition (tv-vibehack) — what exists

### Architecture and UI framework
- Native Android app, Java 17, `minSdk 26`, `targetSdk 34`, package `com.gathin.tvhome`.
- Views + `RecyclerView` (no Compose, no Leanback library). Dependencies: `recyclerview`, `dynamicanimation` (spring motion of the focus glass), `zxing` (guest Wi‑Fi QR).
- `MainActivity` (1,128 lines) owns the home screen: greeting, large clock, spaced date, three pills (Inputs, Network, Settings), a "hero" title of the focused dock app with an ambient colour glow behind it, a glass dock row and an app grid below.
- `AppAdapter` builds tiles from installed leanback apps; the **dock is always exactly `columns` slots** (default 4). Tiles are 180×101 dp, 16 dp corner radius, `FOCUS_SCALE = 1.10`.
- Navigation rules (`onTileVerticalKey`): Left at a row start and Right at a row end are swallowed (no wrapping); Up from the dock goes to the top bar; Down on the last row stays put; Back on the home screen does nothing.
- Dock editing on the TV: Move left, Move right, Remove from dock, Add to dock, Add (replace an app).
- Wallpapers: black, five built-ins (aurora, midnight, ember, ocean, dusk), a photo sent from a phone, or the theme wallpaper.
- Other features: weather (`Weather`), clock screensaver (`ClockDream`), data usage, VPN badge, phone-link web server (`PhoneServer`) for Wi‑Fi setup and photo upload, settings backup (`BackupStore`), app pack (`AppPack`).

### Configuration and themes
- `res/values/config.xml` defaults, overlaid at start by an optional `config.json` in the app's external files directory (`Config.java`). Keys: `dock_apps`, `hidden_apps`, `columns` (1–8), `rows_below_dock` (0–3), `background_color`, `wallpaper`, `live_tv_package`, `live_tv_action`, `source_panel_service/_action`, `shamsi_date`, `vpn_app`, `show_home_settings_shortcut`.
- `themes/{default,aurora,six-columns}/config.json` use the same keys; `tools/theme.sh` pushes them over adb.

### Build, signing and release
- `.github/workflows/build-launcher.yml`: runs on pushes touching `launcher/**`, builds `assembleRelease` on `ubuntu-24.04` with build-tools 34.
- Signing key: secret `TVHOME_SIGNING` (base64 PKCS12, alias `tvhome`). The workflow **verifies the APK certificate SHA‑256** against a pinned fingerprint before publishing; without the secret it builds but refuses to publish.
- Every build on `main` is published as release `v<1000+run>` with `tvhome.apk`, `tvhome-update.apk`, `version.txt`, `notes.txt`, marked `--latest`.

### Downloader and update mechanism
- Install: Downloader code `2960939` resolves to the latest release APK.
- `Updater.java` reads `version.txt` from **`https://github.com/G41US/tv-vibehack/releases/latest/download/`** every 6 hours (and on demand), then installs through Android's `PackageInstaller` confirmation. Update validation is Android's own: an update only installs if it is signed with the same key.

> **Critical constraint for any port:** because the updater follows `releases/latest`, *any* release in tv-vibehack marked "latest" that is not the Android APK would break updates on every installed box. Cross-platform artifacts must never be published as the latest release of tv-vibehack. Building them in this separate repository removes that risk entirely.

### Startup, Home-button handling and restoration
- `HomeKeyService` (AccessibilityService) consumes `KEYCODE_HOME` / `KEYCODE_ALL_APPS` and brings TV Home forward; it also replaces any window from `takeover_packages` (e.g. `com.nes.hometv` on the Airtel box).
- `SelfHeal` re-enables that accessibility service after updates and at boot, *only* if `WRITE_SECURE_SETTINGS` was granted once over adb.
- Restoration: `tools/restore.sh|ps1` re-enables every package from a debloat list and sets the stock launcher back as home; `tools/disable.sh` uses `pm disable-user` (never uninstalls).

### Tests and CI
- No unit or instrumentation tests. CI = the release build plus `stats.yml` (install counter).

---

## 2. tv-vibe-os (before this branch) — measured against the brief

175 lines in total. `web/styles.css` and `web/icon.svg` contain content but no trailing newline.

| Brief requirement | Status before this branch |
|---|---|
| Stage 1 audit of the real repository | **Missing.** No reference to the Android code. |
| Reuse existing visual design | **No.** A marketing-style landing page ("Explore apps", hero headline). It does not resemble TV Home: no greeting/clock layout, no pills, no glass dock, no ambient glow, no wallpapers, no Outfit font. |
| Shared design system + platform contracts | **Partial.** A 3-sentence `platform-contract.md` and a status JSON; no code contract. |
| App discovery and launching | **Missing.** Four hard-coded demo tiles; clicking shows "demo tile". |
| HDMI / input discovery and switching | **Missing.** |
| Remote keys and focus management | **Minimal.** Linear next/previous only; no grid, no Back key, no focus recovery. |
| Clock, date, themes, wallpapers, preferences | Clock only. |
| Lifecycle and error recovery | **Missing.** |
| Capability detection and diagnostics | Partial for VIDAA only (3 unofficial function names). |
| Installation, updates, rollback | **Missing.** |
| Tizen app + WGT packaging | **Missing** (one-paragraph README). |
| webOS app + IPK packaging | **Missing** (one-paragraph README). |
| VIDAA app | Browser page + adapter. The adapter exposes `requestInstall()` calling `Hisense_installApp` — an undocumented install hook. Keeping an app-install helper in the launcher is unnecessary and is removed. |
| Automated tests | **None.** |
| Hardware checklists / compatibility matrix | One short checklist (VIDAA-oriented). |
| Independent build artifacts and release channels | **None.** No CI at all. |
| Verified / experimental / unsupported split | Partly, in prose. |

**Verdict:** tv-vibe-os is an honest but early prototype. It avoids false claims, but it does not deliver any of the brief's implementation stages, and its UI is not the TV Home design.

---

## 3. Reuse vs rewrite

| Component | Decision |
|---|---|
| Visual design (layout, sizes, radii, focus scale, glass dock, ambient glow, greeting/clock/date, pills) | **Reuse** — re-implemented in HTML/CSS with the same measurements. |
| Outfit font (OFL) and the five wallpapers | **Reuse** the files as-is (MIT / OFL, notices kept). |
| Theme/config keys (`dock_apps`, `hidden_apps`, `columns`, `rows_below_dock`, `background_color`, `wallpaper`) | **Reuse** the same names so a TV Home theme file reads the same way. |
| Navigation rules and dock editing actions | **Reuse** the behaviour; rewritten as pure, unit-tested JavaScript. |
| App discovery, launching, inputs | **Rewrite** per platform (Android `PackageManager`/`TvInputManager` have no equivalent). |
| Home-key takeover, boot takeover, `SelfHeal` | **Not portable.** They depend on Android AccessibilityService and secure settings. No public equivalent is documented on Tizen, webOS or VIDAA (see `docs/FEATURE-STATUS.md`). |
| Updater (in-app self-update) | **Not ported.** Packaged TV apps are updated by reinstalling a newer package with the vendor tool or store. |
| Weather, phone link server, Wi‑Fi QR, data usage, screensaver, backup | **Deferred.** Android-specific or need extra services; listed in the roadmap. |
| Debloat/restore scripts | **Not applicable** — nothing on the TV is disabled or modified by the ports. |

---

## 4. Migration plan (what this branch does)

1. Replace the prototype UI with a TV Home look-alike built on a small shared core (`shared/core`), no framework, ES2015-level JavaScript so it runs on older TV browsers.
2. Define the adapter contract in code (`shared/core/contract.js`) and test every adapter against it.
3. Implement adapters: `browser` (preview), `tizen`, `webos`, `vidaa`, each using only documented APIs or explicitly-marked experimental detection.
4. `tools/build.js` produces `dist/<platform>/` and packages: webOS `.ipk` (via `ares-package`), Tizen unsigned WGT payload (signing needs the owner's Samsung certificate), VIDAA hosted-app zip.
5. Unit tests (`node --test`) for the core and for each adapter with simulated platform objects.
6. CI on every push; releases per platform from tags `tizen-v*`, `webos-v*`, `vidaa-v*`, never marked "latest".
7. Documentation: build/install per platform, hardware checklists, compatibility matrix, recovery, feature status.

The Android edition is not touched: no file in tv-vibehack is changed by this work.

## Recommendation

Keep cross-platform work here in tv-vibe-os and delete the `port/smart-tv-platforms` branch on tv-vibehack once this is merged, so there is one place for the ports and no risk to Android releases.
