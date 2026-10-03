# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Practice category on the phone and G2, with Around the Clock, Shanghai and
  Count Up.
- Around the Clock tracks targets 1–20, accepting any multiplier and ending on
  the first successful 20. Draft edits recalculate target guidance on both
  surfaces without recording the turn until confirmation.
- Shanghai plays seven rounds on targets 1–7, with normal target scoring and an
  immediate win for a single, double and triple of the target in one visit.
- Count Up plays eight three-dart rounds, with outer bull worth 25 and inner
  bull worth 50. Shanghai and Count Up award the highest final total and declare
  tied multiplayer totals a draw.
- Target-first G2 entry for Clock and Shanghai, with every board number still
  available for recording wrong darts.
- Engine and phone/G2 integration coverage for all three modes, preserving 100%
  statements, branches, functions and lines for every application TypeScript file.

## [0.1.0] - 2026-06-29

### Added

- Initial release: a darts scoreboard for Even Realities G2.
- Glanceable glasses lens scoreboard — remaining score, last turn, 3-dart leg
  average and a live checkout suggestion, driven entirely by temple gestures.
- **X01** modes — 301, 501, 701 and 901 with double-in / double-out,
  configurable legs and sets, automatic bust handling and checkout routes up to
  170.
- **Cricket** modes — Standard, No-Score, Tactics (10-20 + bull) and Random
  (seven random targets), with mark tracking and point scoring.
- Per-dart entry (build a turn of up to three darts, review, then confirm) with
  dart-by-dart undo.
- Phone ↔ glasses mirroring — the lens follows whatever the phone shows, with
  temple-gesture navigation driving the lens locally.
- Fully offline: no proxy, no API key, no network permissions, no account.
- Even OS 2.0 styling (design tokens and icon set).
