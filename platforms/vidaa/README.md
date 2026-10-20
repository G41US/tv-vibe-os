# Hisense VIDAA adapter

This is an **experimental feature-detection adapter**, not a universal native VIDAA installer. Hisense TVs vary by model, model year, region, VIDAA generation and firmware. APIs described in unofficial examples may be absent or behave differently.

## Current behavior

- Detects a small set of possible API names only when present.
- Reports model/firmware/install capabilities conservatively.
- Never assumes that detecting an API means a package can be installed.
- Requires HTTPS for the optional install request helper.

## Universal compatibility strategy

The core experience should remain a lightweight browser-hosted UI. Device-specific native features must be optional, guarded and tested. For devices without the relevant APIs, use the web preview and do not show unsupported native actions.

## Before claiming a model is supported

Record exact model number, VIDAA version, firmware, region, browser capabilities, remote navigation behavior and installation method. Test launch, focus movement, back button, networking, app lifecycle and recovery. Do not bypass platform security or assume Android Downloader works on VIDAA.

## Important limitation

This repository does not currently contain a signed VIDAA package or a verified method to replace the TV's system launcher. Native packaging and distribution depend on the applicable official developer program and the target model/firmware.