# LG webOS — build and install

Targets webOS TV 4.0 and later (2018+). Installs as an ordinary app through LG's free Developer Mode. Status: built and packaged in CI, **not yet tested on an LG TV**.

## Build

```sh
npm install -g @webos-tools/cli      # LG's official CLI (ares-*)
npm test
npm run build:webos                  # → dist/packages/com.g41us.tvvibe_<version>_all.ipk
```

Or download the `.ipk` from a `webos-v*` GitHub release, or the `tvvibe-webos-ipk` CI artifact.

## Install on the TV (Developer Mode)

1. Create an account at webostv.developer.lge.com and sign in to it on the TV.
2. On the TV, install **Developer Mode** from the LG Content Store, open it, sign in, turn **Dev Mode Status** on (the TV restarts), then turn **Key Server** on. Note the IP address and passphrase shown.
3. On the computer:
   ```sh
   ares-setup-device            # add a device: name "tv", the TV's IP, port 9922, user prisoner
   ares-novacom --device tv --getkey   # enter the passphrase from the TV
   ares-install --device tv dist/packages/com.g41us.tvvibe_0.1.0_all.ipk
   ares-launch --device tv com.g41us.tvvibe
   ```
4. Debug if needed: `ares-inspect --device tv --app com.g41us.tvvibe` opens Chrome DevTools for the app.

The Developer Mode session has a time limit shown in the app; extend it there. Apps installed this way stop working when the session ends.

## Update and roll back

`ares-install` a newer `.ipk` over the old one (settings are kept). To roll back, `ares-install --device tv --remove com.g41us.tvvibe`, then install the older `.ipk`.

## Uninstall

`ares-install --device tv --remove com.g41us.tvvibe`, then turn Dev Mode Status off if you no longer need it.

## What works, what doesn't

| Feature | Status |
|---|---|
| Home screen UI, dock, grid, settings, wallpapers, remote + Magic Remote | Implemented |
| Open apps | `applicationManager/launch` (documented) |
| Which apps are shown | Known app IDs, each confirmed with `getAppLoadStatus` (documented, webOS 4.0+). The IDs themselves are community-sourced. |
| HDMI / Live TV | Experimental: launches the TV's input apps |
| Back key | Handled in-app (`disableBackHistoryAPI`); Back on the dock offers to leave |
| Replace LG Home, Home-button takeover, power-on start | **Not possible with documented APIs.** Not attempted. |

`appinfo.json` declares `requiredACG` (`application.launcher`, `application.query`, `systemconfig.query`, `network.query`), which webOS TV 27+ requires and older versions ignore.

### About rooted-TV "custom home" projects

Community tools exist that replace LG's Home or autostart apps, but they require rooting the TV. That is outside this project's standard path and is not implemented. If it is ever explored, it must be a separate, opt-in folder with tested firmware versions and a documented way back.
