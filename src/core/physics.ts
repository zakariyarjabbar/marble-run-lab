import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3, Quaternion } from "three";
import { channelSurface, frame, shellSurface } from "./geometry";
import { worldPoint, rotate, distance, type Track, type Vec3 } from "./model";
export const STEP = 1 / 120,
  RADIUS = 0.18;
let ready: Promise<void> | undefined;
export function initPhysics() {
  return (ready ??= RAPIER.init() as Promise<void>);
}
export interface Marble {
  body: RAPIER.RigidBody;
  index: number;
  state: "waiting" | "rolling" | "finished" | "fallen";
}
export class Simulation {
  world: RAPIER.World;
  marbles: Marble[] = [];
  elapsed = 0;
  released = false;
  gate: RAPIER.Collider | null = null;
  lastImpact = 0;
  impactPulse = 0;
  private previousVelocity = new Map<
    number,
    { x: number; y: number; z: number }
  >();
  constructor(public track: Track) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.world.integrationParameters.numSolverIterations = 8;
    this.world.integrationParameters.maxCcdSubsteps = 4;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(100, 0.2, 100)
        .setTranslation(0, -0.35, 0)
        .setFriction(0.45)
        .setRestitution(0.15),
    );
    for (const p of track.pieces) {
      const s = channelSurface(p);
      this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          s.vertices,
          s.indices,
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
        )
          .setFriction(0.035)
          .setRestitution(0.02),
      );
      const shell = shellSurface(p);
      if (shell)
        this.world.createCollider(
          RAPIER.ColliderDesc.trimesh(shell.vertices, shell.indices)
            .setFriction(0.035)
            .setRestitution(0.02),
        );
      if (p.type === "finish") {
        const e = worldPoint(p, 1),
          q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -p.yaw);
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.1, 0.36, 0.94)
            .setTranslation(e[0], e[1] + 0.2, e[2])
            .setRotation(q)
            .setRestitution(0.02),
        );
      }
    }
    const start = track.pieces.find((p) => p.type === "start");
    if (start) {
      const g = worldPoint(start, 0.89);
      const q = new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        -start.yaw,
      );
      this.gate = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.09, 0.38, 0.51)
          .setTranslation(g[0], g[1] + 0.3, g[2])
          .setRotation(q),
      );
      // A queue of up to four rows, three across; no overlapping bodies.
      for (let i = 0; i < track.settings.count; i++) {
        const row = Math.floor(i / 3),
          col = i % 3;
        const t = 0.76 - row * 0.16,
          pos = worldPoint(start, t),
          side = rotate([0, 0, (col - 1) * 0.36], start.yaw);
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
              pos[0] + side[0],
              pos[1] + RADIUS + 0.014,
              pos[2] + side[2],
            )
            .setCcdEnabled(true)
            .setCanSleep(false)
            .setLinearDamping(0.003)
            .setAngularDamping(0.003),
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.ball(RADIUS)
            .setDensity(2.5)
            .setFriction(0.035)
            .setRestitution(0.06),
          body,
        );
        this.marbles.push({ body, index: i, state: "waiting" });
      }
      // Let the queue settle behind the physical gate without advancing run time.
      for (let i = 0; i < 150; i++) this.world.step();
    }
  }
  release() {
    if (this.released) return;
    this.released = true;
    if (this.gate) {
      this.world.removeCollider(this.gate, true);
      this.gate = null;
    }
    this.marbles.forEach((m) => (m.state = "rolling"));
  }
  step() {
    if (!this.released) return;
    this.world.step();
    this.elapsed += STEP;
    for (const m of this.marbles) {
      if (m.state !== "rolling") continue;
      const p = m.body.translation(),
        v = m.body.linvel(),
        old = this.previousVelocity.get(m.index);
      if (
        old &&
        Math.hypot(v.x - old.x, v.y - old.y + 9.81 * STEP, v.z - old.z) > 1.4
      )
        this.impactPulse++;
      this.previousVelocity.set(m.index, { ...v });
      for (const piece of this.track.pieces) {
        if (piece.type !== "finish") continue;
        const a = worldPoint(piece, 0.12),
          b = worldPoint(piece, 0.95);
        const axis = new Vector3(...b).sub(new Vector3(...a));
        const rel = new Vector3(p.x - a[0], p.y - a[1], p.z - a[2]);
        const t = rel.dot(axis) / axis.lengthSq();
        const projected = new Vector3(...a).addScaledVector(
          axis,
          Math.max(0, Math.min(1, t)),
        );
        if (
          t > 0 &&
          t < 1.2 &&
          Math.hypot(p.x - projected.x, p.z - projected.z) < 0.8 &&
          p.y > projected.y &&
          p.y < projected.y + 0.65
        ) {
          m.state = "finished";
          break;
        }
      }
      if (
        m.state === "rolling" &&
        (p.y < 0.12 || Math.abs(p.x) > 80 || Math.abs(p.z) > 80)
      )
        m.state = "fallen";
    }
  }
  get stats() {
    return {
      elapsed: this.elapsed,
      finished: this.marbles.filter((m) => m.state === "finished").length,
      fallen: this.marbles.filter((m) => m.state === "fallen").length,
      total: this.marbles.length,
    };
  }
  dispose() {
    this.world.free();
  }
}
