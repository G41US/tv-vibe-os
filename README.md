# TV Vibe OS

A cross-platform smart-TV launcher experiment, starting with a browser-based interface and a cautious VIDAA compatibility layer for Hisense TVs.

## Current status

- Browser UI prototype: available in `web/`.
- VIDAA adapter: feature-detects optional APIs rather than assuming they exist.
- Tizen, webOS and Android: platform notes only; no native packages yet.
- Hardware compatibility: not verified on physical TVs. Hisense models differ by year, region, VIDAA version and firmware. This project aims for broad compatibility through graceful fallbacks, not a claim that one installer works on every model.

## Preview

Open `web/index.html` in a modern browser or host the `web/` directory as a static site. The preview is not itself a signed native VIDAA app and does not replace the TV's system launcher.

## Hisense / VIDAA

Read `platforms/vidaa/README.md` and `platforms/vidaa/adapter.js`. The adapter uses capability detection and reports unavailable features rather than crashing. API names and installation mechanisms must be validated against the target TV and official VIDAA developer documentation before native deployment.

## Compatibility approach

1. Detect model, firmware and available APIs when exposed.
2. Keep the core UI browser-based and remote-control friendly.
3. Use optional platform adapters, with fallbacks when APIs are missing.
4. Test on representative VIDAA generations and regional firmware before calling a model supported.

## Safety and scope

TV Vibe OS does not bypass TV security, sideloading restrictions or app-store signing. Availability of developer mode, browser capabilities, USB install, app URLs and Downloader varies by operating system and model.

## Roadmap

See `docs/ROADMAP.md` and `docs/DEVICE-CHECKLIST.md`.