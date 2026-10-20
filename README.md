# TV Vibe OS

The **TV Home** look from [tv-vibehack](https://github.com/G41US/tv-vibehack) — greeting and big clock, Inputs / Network / Settings pills, a glass dock with an ambient glow, an app grid, wallpapers and remote-first navigation — as an ordinary app for **Samsung Tizen**, **LG webOS** and **Hisense VIDAA** TVs.

The Android / Airtel Smart Box edition stays in tv-vibehack and is not touched by anything here.

> **Status:** built, packaged and tested in automated tests and headless Chromium. **Not yet tested on any physical TV.** See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## Try it on your TV

**Any Samsung, LG or Hisense TV — no install:** open the TV's web browser and go to

> **g41us.github.io/tv-vibe-os**  (or **aftv.news/3839680**)

On a box or TV with the **Downloader** app (Android TV, Fire TV), enter code **3839680** to open the same page.

You get the clock, greeting, wallpapers, settings and remote navigation. A web page can't open your other apps, so for app tiles install the app version below.

**Install the app (opens your apps):**

| TV | Download | How to install |
|---|---|---|
| LG (webOS 2018+) | `.ipk` from [Releases](https://github.com/G41US/tv-vibe-os/releases) (tag `webos-v…`) | LG's free Developer Mode — [steps](platforms/webos/README.md) |
| Samsung (Tizen 2018+) | unsigned `.zip` from [Releases](https://github.com/G41US/tv-vibe-os/releases) (tag `tizen-v…`) | sign with your own Samsung certificate, then Developer Mode — [steps](platforms/tizen/README.md) |
| Hisense VIDAA | browser link above | no public app install route — [details](platforms/vidaa/README.md) |
| Android TV / Airtel box / Fire TV | use **TV Home** instead: Downloader code **2960939** | [tv-vibehack](https://github.com/G41US/tv-vibehack) |

Downloader codes only work on Android TV and Fire TV, which is why the other TVs use the web address and release downloads.

## What to expect on each TV

| | Samsung Tizen | LG webOS | Hisense VIDAA |
|---|---|---|---|
| Home screen, dock, grid, settings, wallpapers | ✓ | ✓ | ✓ |
| Lists and opens your apps | ✓ (documented API) | ✓ (documented API) | ✗ no public API |
| HDMI inputs | experimental (shown inside the app) | experimental | ✗ |
| Replaces the TV's own Home / Home button / opens at power-on | ✗ | ✗ | ✗ |
| Install route | Developer Mode + your Samsung certificate | Developer Mode | TV browser, or VIDAA partner packaging |

None of these platforms offers a public way for an ordinary app to replace the system Home screen or capture the Home button, so TV Vibe opens like any other app and the TV's own Home always stays intact. Details and sources: [docs/FEATURE-STATUS.md](docs/FEATURE-STATUS.md).

## Try it

```sh
npm test            # 49 unit, contract and compatibility tests (Node 18+)
npm run preview     # builds dist/web and serves it at http://localhost:8080
```

Keyboard: arrows move, Enter opens, **hold Enter** for the tile menu (Add to dock, Move, Hide), Escape is Back.

## Build for a TV

| Platform | Command | Output | Install guide |
|---|---|---|---|
| LG webOS | `npm run build:webos` (needs `npm i -g @webos-tools/cli`) | `.ipk` | [platforms/webos](platforms/webos/README.md) |
| Samsung Tizen | `TIZEN_PROFILE=<your profile> npm run build:tizen` | signed `.wgt` (or unsigned zip without a profile) | [platforms/tizen](platforms/tizen/README.md) |
| Hisense VIDAA | `npm run build:vidaa` | hosted web app zip | [platforms/vidaa](platforms/vidaa/README.md) |

Releases: push `webos-v<version>`, `tizen-v<version>` or `vidaa-v<version>` to publish that platform only (see `.github/workflows/release.yml`).

## Documentation

- [docs/AUDIT.md](docs/AUDIT.md) — audit of tv-vibehack and the previous prototype
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — structure, platform contract, milestones
- [docs/FEATURE-STATUS.md](docs/FEATURE-STATUS.md) — verified vs experimental vs unsupported
- [docs/HARDWARE-TESTS.md](docs/HARDWARE-TESTS.md) — checklists and the hardware needed
- [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) — results per model and firmware
- [docs/SECURITY-RECOVERY.md](docs/SECURITY-RECOVERY.md) — keys, recovery, full uninstall

Independent project; not affiliated with Samsung, LG, Hisense, VIDAA or any app shown. App names on tiles are text, not logos.
