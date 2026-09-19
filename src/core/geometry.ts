import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import {
  DEFINITIONS,
  rotate,
  worldPoint,
  type Piece,
  type Vec3,
} from "./model";
export interface Surface {
  vertices: Float32Array;
  indices: Uint32Array;
}
export function frame(p: Piece, t: number) {
  const a = new Vector3(...worldPoint(p, Math.max(0, t - 0.0001))),
    b = new Vector3(...worldPoint(p, Math.min(1, t + 0.0001)));
  const forward = b.sub(a).normalize();
  let side: Vector3, up: Vector3;
  if (p.type === "loop") {
    side = new Vector3(...rotate([0, 0, 1], p.yaw));
    up = side.clone().cross(forward).normalize();
  } else {
    side = new Vector3(-forward.z, 0, forward.x).normalize();
    up = side.clone().cross(forward).normalize();
  }
  return { forward, side, up };
}
export function channelSurface(p: Piece): Surface {
  const def = DEFINITIONS[p.type],
    n = def.steps;
  const v: number[] = [],
    ix: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      pos = new Vector3(...worldPoint(p, t));
    const { side, up } = frame(p, t);
    const width =
      p.type === "finish" ? 0.5 + 0.28 * Math.sin((t * Math.PI) / 2) : 0.5;
    const h = p.type === "loop" ? 0.4 : 0.53;
    const profile = [
      [-width - 0.14, -0.13],
      [width + 0.14, -0.13],
      [width + 0.14, h],
      [width, h],
      [width, 0],
      [-width, 0],
      [-width, h],
      [-width - 0.14, h],
    ];
    for (const [x, y] of profile) {
      const q = pos.clone().addScaledVector(side, x).addScaledVector(up, y);
      v.push(q.x, q.y, q.z);
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j,
        b = i * 8 + ((j + 1) % 8),
        c = (i + 1) * 8 + j,
        d = (i + 1) * 8 + ((j + 1) % 8);
      ix.push(a, d, b, a, c, d);
    }
  // Open ends have capped material edges but an unobstructed channel.

  return { vertices: new Float32Array(v), indices: new Uint32Array(ix) };
}
export function bufferGeometry(s: Surface) {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(s.vertices, 3));
  g.setIndex(new Float32BufferAttribute(s.indices, 1));
  g.setIndex(Array.from(s.indices));
  g.computeVertexNormals();
  return g;
}
export function bounds(pieces: Piece[]) {
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces)
    for (let i = 0; i <= 30; i++) {
      const q = worldPoint(p, i / 30);
      for (let j = 0; j < 3; j++) {
        min[j] = Math.min(min[j], q[j] - 0.7);
        max[j] = Math.max(max[j], q[j] + 0.7);
      }
    }
  if (!pieces.length)
    return { min: [-5, 0, -5] as Vec3, max: [5, 4, 5] as Vec3 };
  return { min, max };
}
/** Decorative shells share their exact geometry with the static collision mesh. */
export function shellSurface(p: Piece): Surface | null {
  const v: number[] = [],
    ix: number[] = [];
  if (p.type === "funnel") {
    for (let ring = 0; ring <= 12; ring++) {
      const r = 0.47 + (ring / 12) * 2.06,
        y = -1.72 + ((r - 0.47) / 2.06) * 2.05;
      for (let j = 0; j <= 96; j++) {
        const a = (j / 96) * Math.PI * 2;
        const q = rotate([r * Math.cos(a), y, 2 + r * Math.sin(a)], p.yaw);
        v.push(
          p.position[0] + q[0],
          p.position[1] + q[1],
          p.position[2] + q[2],
        );
      }
    }
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 96; j++) {
        // Radial opening gives the central outlet a clear route out of the bowl.
        if (i < 6 && j >= 72) continue;
        const k = i * 97 + j;
        ix.push(k, k + 98, k + 1, k, k + 97, k + 98);
      }
  } else if (p.type === "tunnel") {
    for (let i = 0; i <= 24; i++) {
      const pos = worldPoint(p, i / 24),
        { side, up } = frame(p, i / 24);
      for (let j = 0; j <= 24; j++) {
        const a = (j / 24) * Math.PI;
        const q = new Vector3(...pos)
          .addScaledVector(side, 0.67 * Math.cos(a))
          .addScaledVector(up, 0.22 + 0.67 * Math.sin(a));
        v.push(q.x, q.y, q.z);
      }
    }
    for (let i = 0; i < 24; i++)
      for (let j = 0; j < 24; j++) {
        const k = i * 25 + j;
        ix.push(k, k + 1, k + 26, k, k + 26, k + 25);
      }
  } else return null;
  return { vertices: new Float32Array(v), indices: new Uint32Array(ix) };
}
