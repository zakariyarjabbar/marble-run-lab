import { describe, it, expect, vi } from "vitest";
import {
  DEFINITIONS,
  attach,
  connected,
  exit,
  worldPoint,
  makePiece,
  preset,
  moveChain,
  insertPiece,
  openEnds,
  type PieceType,
} from "../src/core/model";
import { history, commit, undo, redo } from "../src/core/history";
import {
  parseTrack,
  serialize,
  validateTrack,
  saveTrack,
  loadTrack,
  STORAGE_KEY,
} from "../src/core/persistence";
import { channelSurface } from "../src/core/geometry";
describe("connector mathematics", () => {
  it.each(Object.keys(DEFINITIONS) as PieceType[])(
    "%s aligns across every quarter turn",
    (type) => {
      for (const yaw of [
        0,
        Math.PI / 2,
        Math.PI,
        Math.PI * 1.5,
        -Math.PI / 2,
      ]) {
        const a = makePiece(type, [2, 7, -3], yaw),
          b = attach(a, "straight");
        expect(connected(a, b)).toBe(true);
        expect(b.position).toEqual(worldPoint(a, 1));
        expect(b.yaw).toBeCloseTo(exit(a).yaw);
      }
    },
  );
  it("moves and rotates a connected chain without tearing joints", () => {
    const t = preset(),
      p = t.pieces[2],
      moved = moveChain(t.pieces, p.id, [3, 1, -2], Math.PI / 2);
    expect(moved[0]).toBe(t.pieces[0]);
    for (let i = 2; i < moved.length - 1; i++)
      expect(connected(moved[i], moved[i + 1])).toBe(true);
    expect(connected(moved[1], moved[2])).toBe(false);
  });
  it("inserts a piece before the finish and moves the tray accurately", () => {
    const t = preset(),
      anchor = t.pieces[6],
      newPiece = attach(anchor, "straight");
    const pieces = insertPiece(t.pieces, anchor, newPiece);
    expect(connected(anchor, newPiece)).toBe(true);
    expect(connected(newPiece, pieces.find((p) => p.type === "finish")!)).toBe(
      true,
    );
    expect(openEnds(pieces)).toHaveLength(0);
  });
  it("the channel running surface has upward-facing normals", () => {
    const s = channelSurface(makePiece("straight", [0, 3, 0]));
    const offset = 4 * 6;
    const ids = Array.from(s.indices.slice(offset, offset + 3)),
      v = ids.map((i) => Array.from(s.vertices.slice(i * 3, i * 3 + 3)));
    const a = v[1].map((n, i) => n - v[0][i]),
      b = v[2].map((n, i) => n - v[0][i]);
    expect(a[2] * b[0] - a[0] * b[2]).toBeGreaterThan(0);
  });
});
describe("construction history", () => {
  it("undo and redo restore exact canonical geometry", () => {
    const initial = preset(),
      a = {
        ...initial,
        pieces: moveChain(
          initial.pieces,
          initial.pieces[1].id,
          [1, 0, 0],
          Math.PI / 2,
        ),
      };
    const h = commit(history(initial), a);
    expect(undo(h).present).toEqual(initial);
    expect(redo(undo(h)).present).toEqual(a);
  });
  it("a new edit drops redo without mutating saved snapshots", () => {
    const h = history(1),
      edited = commit(commit(h, 2), 3);
    expect(commit(undo(edited), 4).future).toEqual([]);
    expect(h.present).toBe(1);
  });
  it("caps retained history at 60 operations", () => {
    let h = history(0);
    for (let i = 1; i < 150; i++) h = commit(h, i);
    expect(h.past).toHaveLength(60);
  });
});
describe("file validation and persistence", () => {
  it.each(["First Drop", "The Spiral", "Loop Theory"])(
    "%s round-trips all definition and appearance choices",
    (name) => {
      const t = preset(name);
      t.settings.appearance = "candy";
      t.settings.count = 12;
      expect(parseTrack(serialize(t))).toEqual(t);
    },
  );
  it("restores from browser saving", () => {
    const memory = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
    });
    const track = preset();
    saveTrack(track);
    expect(memory.has(STORAGE_KEY)).toBe(true);
    expect(loadTrack().track).toEqual(track);
    vi.unstubAllGlobals();
  });
  it.each([
    ["type", "unknown"],
    ["yaw", NaN],
    ["yaw", Infinity],
    ["color", "unknown"],
    ["position", [0, -3, 0]],
    ["position", [0, 3, Infinity]],
    ["id", ""],
  ])("rejects invalid %s", (key, value) => {
    const t = preset();
    (t.pieces[0] as any)[key] = value;
    expect(() => validateTrack(t)).toThrow();
  });
  it("rejects duplicate IDs and oversized files without changing the caller", () => {
    const original = preset(),
      bad = structuredClone(original);
    bad.pieces[1].id = bad.pieces[0].id;
    expect(() => validateTrack(bad)).toThrow(/unique/);
    expect(() => parseTrack(" ".repeat(200001))).toThrow(/large/);
    expect(original.pieces[0].id).not.toBe(original.pieces[1].id);
  });
  it("rejects unexpected format versions, settings and malformed JSON", () => {
    expect(() => parseTrack("{bad")).toThrow(/JSON/);
    expect(() => validateTrack({ ...preset(), version: 2 })).toThrow(/version/);
    const t = preset();
    t.settings.count = 13;
    expect(() => validateTrack(t)).toThrow(/settings/);
  });
  it("permits an empty workbench so deleting the final piece can be restored", () => {
    const t = preset();
    t.pieces = [];
    expect(parseTrack(serialize(t))).toEqual(t);
  });
  it("handles storage denial without throwing or deleting the browser copy", () => {
    const setItem = vi.fn(() => {
      throw new Error("denied");
    });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem,
    });
    expect(loadTrack().error).toBeTruthy();
    expect(setItem).not.toHaveBeenCalled();
    expect(() => saveTrack(preset())).toThrow();
    vi.unstubAllGlobals();
  });
});
