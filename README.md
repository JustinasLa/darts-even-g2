# Darts

> A heads-up darts scoreboard for Even Realities G2.

Darts puts the scoreboard on the G2 lens so you never look away from the board.
Pick a mode, enter each dart with temple gestures, and read your remaining score,
last turn, leg average, and a suggested checkout at a glance. The companion phone
app mirrors the same game with a full keypad. Everything runs on-device, with no
network and no account.

## Install

Scan with the **Even Realities app** on your phone, or open the listing on Even Hub:

[<img src="images/store-qr.png" alt="Install Darts from Even Hub" width="180">](https://evenhub.evenrealities.com/landing?package_id=com.darts.g2)

**[evenhub.evenrealities.com → Darts](https://evenhub.evenrealities.com/landing?package_id=com.darts.g2)**

## Features

- **Heads-up scoreboard** — remaining score, last turn, 3-dart leg average, and a
  live checkout suggestion, all on the lens.
- **X01** — 301, 501, 701, and 901 for one player, with **double-out**, a single
  leg, automatic bust handling, and checkout routes up to 170.
- **Cricket** — Standard, No-Score, Tactics (10–20 + bull), and Random (seven
  random targets), with mark tracking and point scoring.
- **Practice** — Around the Clock, seven-round Shanghai, and eight-round Count Up,
  with target or round guidance on the phone and glasses.
- **Per-dart entry** — build a turn of up to three darts, review it, then confirm;
  **undo** rolls back dart by dart.
- **Phone and glasses mirroring** — the lens follows whatever the phone shows,
  while temple gestures drive the lens locally.
- **Fully offline** — no proxy, no API key, and no permissions.

## From the oche to the lens

Choose X01, Cricket, or Practice on the home screen, then tap a mode to start. Each
of the three dart rows opens a multiplier (Single, Double, Triple, 25, Bull, or
Miss) and then a number; the last row confirms the turn. A side panel shows the
suggested checkout in X01, the numbers still to close in Cricket, or the current
target and round in Practice. Double-tap steps back, out of dart entry, to a
**Quit game?** prompt, and finally out of the app.

| On the glasses | | |
|---|---|---|
| ![Category select on the lens](images/glasses-1-home.png) | ![X01 mode list on the lens](images/glasses-2-modes.png) | ![Score and checkout on the lens](images/glasses-3-checkout.png) |

| On the phone | | |
|---|---|---|
| <img src="images/phone-1-home.jpg" alt="Phone home" width="220"> | <img src="images/phone-2-modes.jpg" alt="Phone mode list" width="220"> | <img src="images/phone-3-checkout.jpg" alt="Phone scoreboard with checkout" width="220"> |

## Documentation

[Project documentation](docs/README.md) covers the practice rules, architecture,
temple gestures, local development, and the tech stack.

See also the [privacy policy](PRIVACY.md), [release notes](RELEASE_NOTES.md), and
[changelog](CHANGELOG.md).

## Tests

With Node.js 20.17.0+, 22.13.0+, or 24+ installed, run:

```sh
npm ci
npm run test:coverage
```

The Vitest suite covers scoring, checkouts, practice rules, localization, and the
phone UI and G2 bridge. UI tests use jsdom and a mocked Even Hub transport with the
SDK's real event constants and container models, exercising phone controls, temple
gestures, staged dart entry, complete practice games, startup, and shutdown.
Coverage requires 100% statements, branches, functions, and lines for every
application TypeScript file, with only tests and TypeScript declarations excluded.
The HTML report is written to `coverage/index.html` and uploaded by CI. The tests
do not require glasses and do not validate physical hardware or BLE transport.

## License

Copyright (c) 2026 JustinasLaunikonis.

Licensed under the [MIT License](LICENSE). Even Realities SDKs and other
third-party dependencies retain their own terms.
