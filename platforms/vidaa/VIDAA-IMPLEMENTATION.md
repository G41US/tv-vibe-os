# VIDAA implementation notes

The first deliverable is a responsive browser UI and a guarded adapter. The next deliverable must be driven by verified documentation and tests from a real target device. Possible API names in the adapter are feature-detection candidates, not a promise that they exist on all TVs.

## Compatibility principle

“Works on all Hisense models” is a goal, not a guarantee that can be honestly made today. Hisense has used different operating systems and VIDAA generations, and native app installation can differ by region and firmware. Aim for one core UI with capability-specific fallbacks, then publish a per-model test matrix.