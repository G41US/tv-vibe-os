# Samsung Tizen — build and install

Targets Tizen 4.0 and later (2018+ Samsung TVs). Installs as an ordinary web app (WGT) through Developer Mode. Status: builds in CI, **not yet tested on a Samsung TV**.

## Why the package is unsigned in CI

Samsung TVs only install WGT files signed with a **Samsung** certificate, and the development distributor certificate is tied to the DUID of the specific TVs it is made for. So the signed `.wgt` must be produced by the TV owner, with their own certificate profile. CI produces the unsigned payload (`tvvibe-tizen-<version>-unsigned.zip`); you sign it locally. No certificate is ever stored in this repository.

## One-time setup

1. Install **Tizen Studio** and, from its Package Manager, the **Samsung TV Extension** and **Samsung Certificate Extension**.
2. On the TV: open **Apps**, press **1 2 3 4 5** on the remote, turn **Developer mode On**, enter your computer's IP address, restart the TV.
3. Connect: `sdb connect <TV_IP>` (or Device Manager in Tizen Studio). Note the device name shown by `sdb devices`.
4. In Tizen Studio's **Certificate Manager**, create a **Samsung** certificate profile for **TV**, signing in with a Samsung account. Add the connected TV's DUID when asked. Give the profile a name, e.g. `tvvibe`.

## Build, sign and install

```sh
npm test
TIZEN_PROFILE=tvvibe npm run build:tizen     # needs the `tizen` CLI on PATH (Tizen Studio's tools/ide/bin)
tizen install -n "dist/packages/TV Vibe.wgt" -t <device-name>
tizen run -p TVVibeOS01.TVVibe -t <device-name>
```

Without `TIZEN_PROFILE` the build stops at `dist/tizen/` and the unsigned zip. You can also sign an unzipped release: `tizen package -t wgt -s tvvibe -- <folder>`. The `.wgt` file name comes from the app name; check `dist/packages/`.

## Update and roll back

Install a newer signed `.wgt` with the same certificate profile (settings are kept). To roll back, uninstall first, then install the older package.

## Uninstall

`tizen uninstall -p TVVibeOS01.TVVibe -t <device-name>`, or delete it from the TV's Apps screen. Turn Developer mode off again (Apps → 1 2 3 4 5 → Off → restart).

## What works, what doesn't

| Feature | Status |
|---|---|
| Home screen UI, dock, grid, settings, wallpapers, remote | Implemented |
| List installed apps | `tizen.application.getAppsInfo()`; the firmware decides what it reports |
| Open apps | `tizen.application.launch()`; some apps may refuse being started by another app |
| Colour / Tools / Info keys | Registered with `tvinputdevice`, only if the TV lists them; OK long-press works regardless |
| HDMI / TV sources | **Experimental.** `VIDEOSOURCE` lists them; TVWindow shows the source *inside TV Vibe*. It does not change the TV's own input. |
| Model / firmware report | `systeminfo` `BUILD` |
| Replace Samsung's Home, Home-key takeover | **No public API.** The diagnostics screen checks whether this TV lists a registrable "Home" key and reports it; the build never registers it. |
| Power-on start | **No public API.** Samsung's prelaunch metadata only pre-loads an app in the background; it is not used and is not treated as autostart. |

Privileges in `config.xml`: `application.info`, `application.launch`, `tv.inputdevice`, `tv.window` — all public-level.
