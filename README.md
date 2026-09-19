# Marble Run Lab

A miniature 3D marble-track workshop built with React, TypeScript, Three.js, and Rapier. Everything runs in the browser; the core app needs no accounts, API keys, or backend.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To choose the preview port explicitly: `npm run dev -- --port 5174 --strictPort`.

```sh
npm test                 # Connector, history, validation, and persistence tests
npm run test:physics     # Real Rapier preset, loop-energy, and stress checks
npm run build            # TypeScript checks and production bundle
npm run preview          # Serve the production build
```

## Play and build

- **Let’s roll / Space:** release the physical gate, pause, or resume. **Reset marbles** restores the queue without changing the track. **Build** ends the simulation and unlocks editing.
- Choose one of 11 pieces from the parts drawer. A translucent preview attaches to a selected connector, or inserts before the finish tray on a completed course. **Place piece / Enter** commits it. Invalid elevation and occupied placement are reported.
- Click a track piece, or use **Select on track**, to change its color, elevation, position, and rotation; duplicate or delete it. Moving or rotating a piece carries its connected downstream chain. Deleting leaves neighbours in place and opens a gap.
- **R** rotates the selected piece or preview. A rotated preview cannot commit until its entrance direction matches the target connector. **Delete** removes the selected piece. **Cmd/Ctrl+Z** undoes; **Cmd/Ctrl+Shift+Z** redoes. History retains 60 edits, including preset changes and imports.
- Grid on: 1-unit horizontal moves. Grid off: 0.25-unit horizontal moves. Elevation moves in 0.5-unit increments.
- Drag to orbit, right-drag to pan, scroll to zoom. Touch: one finger orbits; two fingers pan/pinch. Visible buttons reset, fit (**F**), or switch to top view. Follow a marble in Run; a manual camera gesture exits follow mode.
- Choose 1–12 marbles and Classic, Swirl, Metal, or Glass appearance. Physical properties remain the same. Quarter-speed playback uses the same fixed simulation timestep.
- Sound is muted initially. Enable it in the footer for synthesized placement, gate, impact, and finish sounds.
- Export versioned JSON for a portable copy. Import validates the entire document before replacing the track. PNG export captures the rendered scene without UI, grid, or selection aids. Photo mode hides the surrounding controls.
- On narrow screens, **Add a piece** opens the bottom drawer and the settings button opens the compact inspector. The transport stays at the bottom.

## Data and architecture

| File                       | Responsibility                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `src/core/model.ts`        | Canonical version-1 track, piece definitions, connector transforms, chain edits, presets   |
| `src/core/geometry.ts`     | Shared channel/shell vertex and index generation, frames, bounds                           |
| `src/core/history.ts`      | Immutable undo/redo snapshots                                                              |
| `src/core/physics.ts`      | Rapier worlds, physical gate and marbles, fixed-step simulation, completion/fall detection |
| `src/core/persistence.ts`  | Local saving, strict import validation, JSON serialization and downloads                   |
| `src/scene/Workbench.ts`   | Three.js scene, materials, supports, raycasting, cameras, photo capture                    |
| `src/scene/previews.ts`    | Piece and preset thumbnails rendered from actual geometry                                  |
| `src/scene/sound.ts`       | Gesture-activated, rate-limited Web Audio feedback                                         |
| `src/components/Scene.tsx` | React/renderer lifecycle bridge                                                            |
| `src/App.tsx`              | Editor controls, workflow state, dialogs, responsive panels                                |

Track channels, funnel shells, and tunnel roofs use the same triangles for rendering and collisions. Balls are dynamic rigid bodies. Gravity is −9.81 units/s², timestep 1/120 s, eight solver iterations, CCD enabled with up to four CCD substeps. A frame accumulator controls playback; there are no position setters or path-following forces after marble creation. The loop uses a laterally offset return lane, smooth connection sections, and enough upstream height. A low-energy loop test must fail to complete.

Browser storage key: `marble-run-lab.v1`. Saves contain construction, name, marble choices, sound, grid, and quality, never transient physics. Import limits: 200 KB, 100 pieces, 12 marbles, bounded finite transforms, known identifiers and enums. Storage errors preserve the in-memory creation and provide JSON export as recovery. Refresh resets the simulation while restoring the construction.

## Deployment

`npm run build` creates a static `dist/` directory. Serve it over HTTP(S) with JavaScript, CSS, font, and image MIME types. No server routes, secrets, or runtime bindings are required. `.openai/hosting.json` contains the existing Sites project registration and the `dist` output selection.

The physics WebAssembly is embedded in its JavaScript package, making the compressed physics chunk about 835 KB. Vite reports an expected large-chunk warning. The Light quality option reduces pixel density and disables shadows. A browser with WebGL 2 and hardware acceleration is required. Graphics initialization and context-loss failures show recovery guidance.

## Verification and limits

- 32 automated tests cover connector alignment across quarter turns, connected chain transforms, insertion, undo/redo, import validation, browser-saving round trips, and storage denial.
- Headless Rapier checks: all three default marbles finished First Drop in 9.492 simulated seconds, The Spiral in 10.308 s, and Loop Theory in 6.717 s. All loop marbles crossed the apex and far side; the low-energy control finished zero.
- A 40-piece, 12-marble headless workload simulated 25 seconds in 263 ms on the development machine, with 12 finishes. This measures the simulation only, not rendering FPS or mobile performance.
- Browser verification notes are recorded in `VERIFICATION.md`.
- Footprint validation rejects below-table, out-of-bounds, and occupied-centre placements; it is not a full geometric intersection solver. Deliberately edited or incomplete tracks may stall or lose marbles; Reset and Undo make that recoverable.
- The funnel includes a real spiral channel, a collidable bowl, and an open outlet. It is a guided spiral funnel rather than a free-vortex bowl.
- Moving is done through explicit inspector controls, not drag handles. No branching junction or rotating paddle is included.
- No claim is made for physical-device mobile FPS or browser engines that were not tested.

## Attribution

All track geometry, materials, thumbnails, textures, and sound cues are generated in code for this project; no stock imagery or external 3D models are used.

- Three.js — MIT, https://threejs.org/
- Rapier — Apache-2.0, https://rapier.rs/
- React — MIT, https://react.dev/
- Lucide icons — ISC, https://lucide.dev/
- DM Sans and Space Grotesk — SIL Open Font License 1.1, bundled locally through Fontsource.
- Vite, TypeScript, Vitest, and tsx retain their upstream licenses.
