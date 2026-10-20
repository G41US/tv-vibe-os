# Hisense VIDAA — what is possible

Status: hosted web app built and tested in a browser with a VIDAA user agent, **not yet tested on a Hisense TV**.

## The honest limits

- VIDAA has **no public developer documentation** for third-party web apps. Packaging, signing, installation and system APIs are available through Hisense/VIDAA's partner programme only.
- There is **no public API** for listing or opening other apps, switching inputs, replacing the Home screen, taking over the Home key, or starting at power-on.
- Android APKs, Downloader codes and the Airtel/Android install route do **not** apply to VIDAA.

So on VIDAA, TV Vibe is a clock, greeting, wallpaper and settings home. Its home panel says plainly that apps must be opened from the TV's own Home.

## Ways to run it

**1. Hosted page (no special access).** If the TV has a web browser, open the GitHub Pages URL of this repository (published by `.github/workflows/pages.yml`) and bookmark it. The page detects VIDAA from the browser's user agent. Settings are kept in the browser's storage; whether that survives a TV restart varies by firmware — record it in `docs/COMPATIBILITY.md`.

**2. Partner packaging.** `npm run build:vidaa` makes `dist/packages/tvvibe-vidaa-<version>.zip`, a self-contained web app folder for a VIDAA partner to package with their official tooling. What a partner needs to supply for each VIDAA generation: the package format and manifest, the signing process, the installation route, and the list of permitted system APIs. None of these are assumed here.

## Not used, on purpose

Community methods that redirect the TV's DNS or call undocumented install hooks to sideload apps are not part of this project. They rely on undocumented behaviour, can stop working with any firmware update, and are outside the brief's "no bypassing" rule. The prototype's `Hisense_installApp` helper was removed.

## Recording a VIDAA test

Note the exact model, region, VIDAA version and firmware (Settings → Support → System info; names vary), whether the TV has a browser, which remote keys reach the page (diagnostics shows them working or not), and whether settings survive a restart.
