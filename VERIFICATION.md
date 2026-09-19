# Verification — 17 September 2026

## Automated

`npm test`: 32 passing tests.

`npm run test:physics` (actual Rapier, 120 Hz):

| Course      | Finished | Fallen |          Completion time |
| ----------- | -------: | -----: | -----------------------: |
| First Drop  |      3/3 |      0 |  9.492 simulated seconds |
| The Spiral  |      3/3 |      0 | 10.308 simulated seconds |
| Loop Theory |      3/3 |      0 |  6.717 simulated seconds |

Loop trajectory assertions require every marble to pass the apex and then the far side. The low-energy control completes zero marbles. No animation or artificial track-following force is used.

A populated scene definition with 40 pieces and 12 marbles simulated 25 seconds in 263 ms on the development machine, with all 12 finishing. This is a headless physics measurement, not a browser rendering benchmark.

## Browser checks

Tested in the Codex in-app browser on this Mac:

- Play releases the gate, switches to Run, and disables construction controls.
- Pause leaves run time unchanged (7.0 s observed before and after an independent operation).
- Reset returns time to 0.0 s; Build restores editing.
- Slow motion toggles and Follow identifies the selected marble.
- A straight piece previews and inserts before the finish tray: 8 pieces became 9.
- Rotated, incompatible preview is rejected with a readable reason and disabled Place action.
- Undo returns to 8 pieces; redo restores 9.
- Renaming to “Browser saved track” and refreshing preserves both name and all 9 pieces.
- JSON export writes a real file, then imports back successfully.
- An invalid file with an unknown module type displays a validation error and preserves the current track.
- PNG export produces a 2560 × 1288, 393 KB image. Inspected the actual file: track, marbles, lighting, and shadows appear without UI, grid, or selection overlays.
- Desktop and 390 × 844 mobile layouts reviewed together. Camera framing, mobile parts drawer, mobile inspector, text sizes, and accessible button names corrected.
- Mobile drawer opens, settings remain reachable, and marble count can be changed.

No physical-phone GPU benchmark, cross-browser compatibility claim, or guarantee for arbitrary custom tracks is made.

## Design check

The Impeccable detector was run once. The two side-border findings refer to curved marble stripe textures, not card accent borders; retained intentionally. Its generic Space Grotesk font warning was reviewed against the committed toy-workshop direction and retained. No blocker was found by this mechanical check.
