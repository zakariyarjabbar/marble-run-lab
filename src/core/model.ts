export type Vec3 = [number, number, number];
export type PieceType =
  | "start"
  | "straight"
  | "curve"
  | "corner"
  | "down"
  | "up"
  | "s-curve"
  | "funnel"
  | "tunnel"
  | "loop"
  | "finish";
export const COLORS = {
  coral: "#e78263",
  cobalt: "#5275cf",
  butter: "#e8bf4c",
  mint: "#80b998",
} as const;
export type ColorName = keyof typeof COLORS;
export type MarbleStyle = "classic" | "candy" | "metal" | "glass";
export interface Piece {
  id: string;
  type: PieceType;
  position: Vec3;
  yaw: number;
  color: ColorName;
}
export interface Track {
  version: 1;
  name: string;
  pieces: Piece[];
  settings: {
    count: number;
    appearance: MarbleStyle;
    grid: boolean;
    quality: "high" | "low";
    sound: boolean;
  };
}
export interface Definition {
  name: string;
  detail: string;
  category: "Essentials" | "Twists & turns" | "Specials";
  color: ColorName;
  path: (t: number) => Vec3;
  endYaw: number;
  steps: number;
  width?: number;
}
const smooth = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
export const DEFINITIONS: Record<PieceType, Definition> = {
  start: {
    name: "Start gate",
    detail: "Every good run begins here.",
    category: "Essentials",
    color: "coral",
    path: (t) => [2.6 * t, -0.2 * t, 0],
    endYaw: 0,
    steps: 16,
  },
  straight: {
    name: "Straight",
    detail: "A little room to roll.",
    category: "Essentials",
    color: "butter",
    path: (t) => [2.8 * t, -0.2 * t, 0],
    endYaw: 0,
    steps: 16,
  },
  curve: {
    name: "Gentle curve",
    detail: "Take the scenic route.",
    category: "Twists & turns",
    color: "coral",
    path: (t) => [
      2.2 * Math.sin((t * Math.PI) / 2),
      -0.38 * t,
      2.2 * (1 - Math.cos((t * Math.PI) / 2)),
    ],
    endYaw: Math.PI / 2,
    steps: 40,
  },
  corner: {
    name: "Tight corner",
    detail: "A neat 90-degree turn.",
    category: "Twists & turns",
    color: "butter",
    path: (t) => [
      1.35 * Math.sin((t * Math.PI) / 2),
      -0.3 * t,
      1.35 * (1 - Math.cos((t * Math.PI) / 2)),
    ],
    endYaw: Math.PI / 2,
    steps: 32,
  },
  down: {
    name: "Downhill ramp",
    detail: "Let gravity do its thing.",
    category: "Essentials",
    color: "cobalt",
    path: (t) => [4 * t, -2.5 * smooth(t) - 0.15 * t, 0],
    endYaw: 0,
    steps: 64,
  },
  up: {
    name: "Uphill ramp",
    detail: "Momentum makes the climb.",
    category: "Essentials",
    color: "mint",
    path: (t) => [3.5 * t, 1.35 * smooth(t) - 0.15 * t, 0],
    endYaw: 0,
    steps: 48,
  },
  "s-curve": {
    name: "S-curve",
    detail: "A playful change of direction.",
    category: "Twists & turns",
    color: "mint",
    path: (t) => [4.8 * t, -0.6 * t, 1.2 * Math.sin(Math.PI * t) ** 2],
    endYaw: 0,
    steps: 64,
  },
  funnel: {
    name: "Funnel",
    detail: "Round and round, then down.",
    category: "Specials",
    color: "coral",
    path: (t) => {
      const a = t * Math.PI * 2,
        r = 2 * (1 - t) + 0.55 * t;
      return [2 + r * Math.sin(a), -1.5 * t, 2 - r * Math.cos(a)];
    },
    endYaw: 0,
    steps: 120,
  },
  tunnel: {
    name: "Tunnel",
    detail: "A little disappearing act.",
    category: "Specials",
    color: "mint",
    path: (t) => [3 * t, -0.28 * t, 0],
    endYaw: 0,
    steps: 24,
  },
  loop: {
    name: "Vertical loop",
    detail: "A full circle of possibility.",
    category: "Specials",
    color: "cobalt",
    path: (t) => {
      if (t < 0.15) return [(t / 0.15) * 2, (-0.04 * t) / 0.15, 0];
      if (t > 0.85)
        return [
          2 + ((t - 0.85) / 0.15) * 2,
          -0.12 - (0.04 * (t - 0.85)) / 0.15,
          1.4,
        ];
      const u = (t - 0.15) / 0.7;
      return [
        2 + 1.35 * Math.sin(2 * Math.PI * u),
        1.35 * (1 - Math.cos(2 * Math.PI * u)) - 0.04 - 0.08 * u,
        1.4 * smooth(u),
      ];
    },
    endYaw: 0,
    steps: 180,
  },
  finish: {
    name: "Finish tray",
    detail: "A soft landing. Well done.",
    category: "Specials",
    color: "butter",
    path: (t) => [2.7 * t, -0.18 * t, 0],
    endYaw: 0,
    steps: 24,
    width: 1.5,
  },
};
// Funnel begins at origin and finishes at a central, tangent-aligned outlet.
const spiral = (t: number): Vec3 => {
  const a = t * Math.PI * 2,
    r = 2 - 1.45 * t;
  return [r * Math.sin(a), -1.5 * t, 2 - r * Math.cos(a)];
};
DEFINITIONS.funnel.path = (t) => {
  if (t <= 0.88) return spiral(t / 0.88);
  const u = (t - 0.88) / 0.12;
  return [0.95 * u, -1.5 - 0.18 * u, 1.45];
};
// Derive path tangent numerically so every renderer/collider uses identical frames.
export function pathPoint(type: PieceType, t: number): Vec3 {
  return DEFINITIONS[type].path(Math.max(0, Math.min(1, t)));
}
export function rotate(v: Vec3, yaw: number): Vec3 {
  return [
    v[0] * Math.cos(yaw) - v[2] * Math.sin(yaw),
    v[1],
    v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw),
  ];
}
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function worldPoint(p: Piece, t: number): Vec3 {
  return add(p.position, rotate(pathPoint(p.type, t), p.yaw));
}
export function exit(p: Piece) {
  return {
    position: worldPoint(p, 1),
    yaw: p.yaw + DEFINITIONS[p.type].endYaw,
  };
}
export function entrance(p: Piece) {
  return { position: p.position, yaw: p.yaw };
}
export function makePiece(
  type: PieceType,
  position: Vec3 = [0, 3, 0],
  yaw = 0,
): Piece {
  return {
    id: crypto.randomUUID(),
    type,
    position,
    yaw,
    color: DEFINITIONS[type].color,
  };
}
export function attach(previous: Piece, type: PieceType): Piece {
  const end = exit(previous);
  return makePiece(type, end.position, end.yaw);
}
export function distance(a: Vec3, b: Vec3) {
  return Math.hypot(...a.map((v, i) => v - b[i]));
}
export function connected(a: Piece, b: Piece) {
  return (
    distance(exit(a).position, b.position) < 0.035 &&
    Math.abs(Math.sin((exit(a).yaw - b.yaw) / 2)) < 0.02
  );
}
export function openEnds(pieces: Piece[]) {
  return pieces.filter(
    (p) =>
      p.type !== "finish" &&
      !pieces.some((q) => q.id !== p.id && connected(p, q)),
  );
}
export function downstream(pieces: Piece[], id: string): Piece[] {
  const found: Piece[] = [];
  let p = pieces.find((x) => x.id === id);
  while (p && !found.some((x) => x.id === p!.id)) {
    found.push(p);
    const last = p;
    p = pieces.find((q) => q.id !== last.id && connected(last, q));
  }
  return found;
}
export function moveChain(
  pieces: Piece[],
  id: string,
  delta: Vec3,
  turn = 0,
): Piece[] {
  const chain = downstream(pieces, id),
    ids = new Set(chain.map((p) => p.id)),
    origin = chain[0]?.position;
  if (!origin) return pieces;
  return pieces.map((p) =>
    ids.has(p.id)
      ? {
          ...p,
          position: add(
            add(origin, delta),
            rotate(p.position.map((v, i) => v - origin[i]) as Vec3, turn),
          ),
          yaw: p.yaw + turn,
        }
      : p,
  );
}
export function insertPiece(pieces: Piece[], anchor: Piece, piece: Piece) {
  const next = pieces.find((p) => p.id !== anchor.id && connected(anchor, p));
  let updated = pieces;
  if (next) {
    const end = exit(piece);
    updated = moveChain(
      pieces,
      next.id,
      end.position.map((v, i) => v - next.position[i]) as Vec3,
      end.yaw - next.yaw,
    );
  }
  return [...updated, piece];
}
export function placementError(
  candidate: Piece,
  pieces: Piece[],
): string | null {
  if (pieces.length >= 100) return "This workbench holds up to 100 pieces.";
  for (let i = 0; i <= 10; i++) {
    const p = worldPoint(candidate, i / 10);
    if (p[1] < 0.18) return "Too low: raise the connecting piece first.";
    if (Math.max(Math.abs(p[0]), Math.abs(p[2]), p[1]) > 70)
      return "This piece is outside the workbench.";
  }
  const mid = worldPoint(candidate, 0.5);
  if (pieces.some((p) => distance(worldPoint(p, 0.5), mid) < 0.65))
    return "This space is occupied. Choose another open connector.";
  return null;
}
export function lengthOf(p: Piece) {
  let n = 0;
  for (let i = 1; i <= 80; i++)
    n += distance(worldPoint(p, (i - 1) / 80), worldPoint(p, i / 80));
  return n;
}
export const DEFAULT_SETTINGS: Track["settings"] = {
  count: 3,
  appearance: "classic",
  grid: true,
  quality: "high",
  sound: false,
};
export function preset(name = "First Drop"): Track {
  let pieces: Piece[] = [];
  function chain(types: PieceType[], position: Vec3) {
    for (const type of types)
      pieces.push(
        pieces.length
          ? attach(pieces.at(-1)!, type)
          : makePiece(type, position),
      );
  }
  if (name === "Loop Theory") {
    chain(
      ["start", "down", "down", "down", "loop", "straight", "finish"],
      [-10, 10.35, 0],
    );
  } else if (name === "The Spiral") {
    chain(
      ["start", "curve", "funnel", "straight", "curve", "finish"],
      [-5, 5.3, -4],
    );
  } else {
    chain(
      [
        "start",
        "curve",
        "down",
        "curve",
        "straight",
        "s-curve",
        "curve",
        "finish",
      ],
      [-3.8, 5.4, -3.5],
    );
  }
  return { version: 1, name, pieces, settings: { ...DEFAULT_SETTINGS } };
}
