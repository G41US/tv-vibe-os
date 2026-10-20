# Hardware test checklists

Run these on a real TV before marking anything as working in `docs/COMPATIBILITY.md`. Record results there with the exact model and firmware. Simulated runs do not count.

**Before you start:** open TV Vibe, press **Info** (or Settings → Device & diagnostics) and photograph the screen. It shows the platform, model, OS and firmware, and the status of every capability on that TV. Do not record serial numbers, DUIDs, account names or Wi‑Fi passwords.

## 1. Installation and first launch
- [ ] Package installs with the documented command for this platform (no errors)
- [ ] TV Vibe appears in the TV's app list with its icon and name
- [ ] First launch shows clock, greeting, date and the three pills within 3 seconds
- [ ] Apps appear in the dock (or, on VIDAA, the explanation panel)
- [ ] Focus starts on the first dock tile and is clearly visible from the sofa

## 2. Remote navigation and focus recovery
- [ ] Left/Right move along the dock; no wrapping at either end
- [ ] Up from the dock reaches the pills; Down returns to the same dock tile
- [ ] Down from the dock moves through grid rows; rows above fade out; Down on the last row stays
- [ ] Hold OK on a tile (about 1 s) opens the tile menu; Red / Tools key does too
- [ ] Magic Remote pointer (LG): hover focuses, click opens
- [ ] After closing any menu, focus returns to where it was

## 3. App launching and Back
- [ ] Each dock app opens; note any that refuse and the message shown
- [ ] Press the TV's Back inside the opened app until it closes: TV Vibe is shown again with focus on the same tile
- [ ] Back in the grid returns to the dock; Back on the dock offers "Leave TV Vibe?"; Leave exits
- [ ] Inputs: list matches the connected HDMI devices; choosing one shows/opens it; Back returns (Tizen shows it inside TV Vibe)

## 4. Cold boot, standby wake and Home button (document behaviour; no takeover is expected)
- [ ] Cold boot (unplug 30 s): what appears first? (Expected: the TV's own Home)
- [ ] Standby → on with TV Vibe open: what appears?
- [ ] Press Home while in TV Vibe: what appears? (Expected: the TV's own Home)
- [ ] TV Vibe can be reopened from the app list / recent apps afterwards

## 5. Settings persistence and updates
- [ ] Change wallpaper, columns, clock format, dock order; hide one app
- [ ] Close TV Vibe, reopen: all changes kept
- [ ] Power-cycle the TV, reopen: all changes kept (VIDAA: record whether they survive)
- [ ] Install a newer build over the old one: settings kept, About shows the new version

## 6. Failed update recovery
- [ ] Interrupt an install (disconnect network during `ares-install` / `tizen install`): the previous version still opens
- [ ] Reinstall the previous release package from GitHub Releases: it opens and keeps or cleanly resets settings
- [ ] If settings were reset, diagnostics shows the "unreadable preferences" event

## 7. Stock launcher restoration and complete uninstall
- [ ] The TV's own Home screen works normally at every step above (TV Vibe never replaces it)
- [ ] Uninstall with the documented command or the TV's app manager
- [ ] TV Vibe is gone from the app list; nothing else on the TV changed
- [ ] Developer Mode turned off again if it was only enabled for this test

## Exact hardware needed

| Platform | Minimum to validate | Ideal coverage |
|---|---|---|
| Samsung Tizen | One Samsung TV, 2018 or later (Tizen 4.0+), a computer with Tizen Studio + Samsung TV extensions, a Samsung account | One 2018–2019 model and one 2022+ model |
| LG webOS | One LG TV with webOS TV 4.0+ (2018 or later), the free LG Developer Mode app, a computer with Node.js | One webOS 4–6 model and one webOS 22+ model |
| Hisense VIDAA | One Hisense VIDAA TV with a web browser | Two VIDAA generations (e.g. VIDAA U5 and VIDAA 2023+) |
| All | HDMI source (any console or set-top box), the TV's own remote | A second HDMI source to check input listing |
