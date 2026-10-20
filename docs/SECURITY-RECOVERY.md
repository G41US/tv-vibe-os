# Security, recovery and uninstall

## What TV Vibe does and does not touch

- It is an ordinary app. It does not root, patch, disable or replace anything on the TV, does not change system settings, and does not write outside its own app storage.
- It makes **no network requests**: the font and wallpapers are bundled, and there is no analytics or update server.
- It only calls the platform APIs listed in `docs/FEATURE-STATUS.md`. On webOS those are declared in `appinfo.json` → `requiredACG`; on Tizen in `config.xml` privileges.
- The VIDAA adapter only *reads* model/firmware functions when present. The prototype's app-install helper (`Hisense_installApp`) was removed.

## Keys and private data

- No signing keys, certificates, passwords or tokens are in this repository; `.gitignore` blocks `*.p12`, `*.pem`, `*.cer`, `*.wgt`, `*.ipk` and Tizen signature files, and a test fails if one is committed.
- Tizen packages are signed on the owner's own computer with a certificate profile from Tizen Studio's Certificate Manager. That profile contains the TV's DUID; keep it out of the repo and out of screenshots.
- webOS Developer Mode passphrases and the key fetched by `ares-novacom --getkey` live in the developer's home folder; never commit them.
- The diagnostics screen shows model and firmware only — no serial numbers, DUIDs or account data.

## Recovering from problems

| Problem | Recovery |
|---|---|
| Settings look broken | Settings → Reset settings. If saved settings can't be read, TV Vibe starts with defaults automatically and keeps the old copy (`tvvibe.prefs.unreadable`) for diagnostics. |
| UI error while drawing | TV Vibe falls back to default settings once, keeps the old ones, and shows a message. |
| An update fails to install | The previously installed version stays in place. Install the previous release package again if needed. |
| A newer version misbehaves (rollback) | Uninstall, then install the older package from GitHub Releases. TVs may refuse a lower version over a higher one, so remove first. Settings are lost on uninstall. |
| TV Vibe won't open at all | Open apps from the TV's own Home as usual — it is never replaced — and uninstall TV Vibe. |
| webOS Developer Mode session expired | Apps installed in Developer Mode stop working when the session ends; reopen the Developer Mode app, extend or restart the session, and reinstall. |

## Uninstall (complete)

| Platform | Command | On the TV |
|---|---|---|
| Tizen | `tizen uninstall -p TVVibeOS01.TVVibe -t <device>` | Apps → TV Vibe → hold OK → Delete (menu names vary by year) |
| webOS | `ares-install --device <tv> --remove com.g41us.tvvibe` | Hold OK on the app in the launcher bar → Remove |
| VIDAA (hosted) | — | Remove the browser bookmark; clear the browser's site data to drop saved settings |

Afterwards, turn off Developer Mode if it was only enabled for TV Vibe:
- **Samsung:** Apps → press 1 2 3 4 5 on the remote → Developer mode **Off** → restart the TV.
- **LG:** Developer Mode app → Dev Mode Status **Off** (the TV restarts).

The TV's own Home screen, inputs and apps are exactly as before, because TV Vibe never changed them.
