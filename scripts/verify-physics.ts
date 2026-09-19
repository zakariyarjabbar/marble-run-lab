import { initPhysics, Simulation } from "../src/core/physics";
import { preset, type Track } from "../src/core/model";
await initPhysics();
let fail = false;
for (const name of ["First Drop", "The Spiral", "Loop Theory"]) {
  const track = preset(name),
    sim = new Simulation(track),
    loop = track.pieces.find((p) => p.type === "loop");
  sim.release();
  const apex = Array(3).fill(false),
    farSide = Array(3).fill(false);
  for (let i = 0; i < 120 * 45; i++) {
    sim.step();
    if (loop)
      for (const m of sim.marbles) {
        const p = m.body.translation();
        if (
          p.y > loop.position[1] + 2.3 &&
          Math.abs(p.x - (loop.position[0] + 2)) < 1
        )
          apex[m.index] = true;
        if (apex[m.index] && p.x < loop.position[0] + 1.4 && p.z > 0.5)
          farSide[m.index] = true;
      }
    if (sim.stats.finished + sim.stats.fallen === track.settings.count) break;
  }
  const pass =
    sim.stats.finished === 3 &&
    (!loop || (apex.every(Boolean) && farSide.every(Boolean)));
  console.log(
    JSON.stringify({
      preset: name,
      pass,
      time: Number(sim.elapsed.toFixed(3)),
      finished: sim.stats.finished,
      fallen: sim.stats.fallen,
      ...(loop ? { apex, farSide } : {}),
    }),
  );
  if (!pass) fail = true;
  sim.dispose();
}
// A low-energy loop cannot complete: this guards against hidden path following.
const low = preset("Loop Theory");
const loop = low.pieces.find((p) => p.type === "loop")!;
const start = low.pieces[0];
start.position = [
  loop.position[0] - 2.6,
  loop.position[1] + 0.2,
  loop.position[2],
];
low.pieces = [start, ...low.pieces.slice(4)];
const slow = new Simulation(low);
slow.release();
for (let i = 0; i < 120 * 20; i++) slow.step();
console.log(
  JSON.stringify({
    test: "insufficient energy",
    pass: slow.stats.finished === 0,
    finished: slow.stats.finished,
  }),
);
if (slow.stats.finished !== 0) fail = true;
slow.dispose();
// Twelve interacting bodies on a moderately populated (40-piece) workbench.
const populated = preset();
populated.settings.count = 12;
const base = [...populated.pieces];
for (let j = 1; j < 5; j++)
  for (const p of base)
    populated.pieces.push({
      ...p,
      id: crypto.randomUUID(),
      position: [p.position[0] + j * 15, p.position[1], p.position[2]],
    });

const began = performance.now();
const many = new Simulation(populated);
many.release();
for (let i = 0; i < 120 * 25; i++) many.step();
const duration = performance.now() - began;
console.log(
  JSON.stringify({
    test: "40 pieces / 12 marbles",
    simulationSeconds: 25,
    wallMilliseconds: Math.round(duration),
    finished: many.stats.finished,
    fallen: many.stats.fallen,
  }),
);
many.dispose();
process.exitCode = fail ? 1 : 0;
