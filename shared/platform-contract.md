# Platform adapter contract

Each platform adapter should expose capability detection, model/firmware information when available, launch/install actions only when officially supported, and explicit error states. All native APIs are optional.

Core UI requirements: keyboard/remote focus visibility, predictable directional navigation, no mandatory touch input, graceful operation without native APIs, and no unsupported system-launcher replacement assumptions.

A feature is supported only after it passes tests on a named model and software version.