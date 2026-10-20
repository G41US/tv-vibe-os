# Compatibility matrix

**Status today: no physical TV tested.** Rows are added only from real test runs using `docs/HARDWARE-TESTS.md`. Leave a cell blank rather than guessing.

Legend: ✅ pass · ⚠️ partial (see notes) · ❌ fail · — not applicable · blank = not tested

## Tested devices

| Manufacturer | Model | OS / version | Firmware | TV Vibe build | Install | Launch | Navigation | Open apps | Back | Inputs | Cold boot | Standby | Home key | Settings kept | Update | Uninstall | Tester · date |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | | | | | | |

## Simulated coverage (not hardware)

| Target | What ran | Result |
|---|---|---|
| Browser preview | Headless Chromium 141, keyboard navigation, menus, settings | ✅ |
| Tizen build | Headless Chromium with a simulated `tizen` object (apps, launch, sources, keys, TV window) | ✅ |
| webOS build | Headless Chromium with a simulated `PalmServiceBridge`; also the packaged, minified `.ipk` contents | ✅ |
| VIDAA build | Headless Chromium with a VIDAA user agent | ✅ (empty-state home, as designed) |
| All shipped JS/CSS | Lint against Chromium 53 features | ✅ |

## Expected platform behaviour (from documentation, to be confirmed)

| Capability | Tizen 4.0+ | webOS TV 4.0+ | VIDAA |
|---|---|---|---|
| Runs as an app | Developer Mode + signed WGT | Developer Mode + IPK | TV browser or partner packaging |
| Lists apps | getAppsInfo | known IDs checked one by one | no |
| Opens apps | yes | yes | no |
| Inputs | in-app TV window (experimental) | input apps (experimental) | no |
| Replaces Home / takes Home key / power-on | no | no | no |
