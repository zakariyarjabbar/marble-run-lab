import { COLORS, DEFINITIONS, preset, type Track } from "./model";
export const STORAGE_KEY = "marble-run-lab.v1";
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
export function validateTrack(value: unknown): Track {
  if (!object(value) || value.version !== 1)
    throw new Error("Use a Marble Run Lab JSON file with version 1.");
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 80
  )
    throw new Error("Track name must contain 1–80 characters.");
  if (!Array.isArray(value.pieces) || value.pieces.length > 100)
    throw new Error("A track must have no more than 100 pieces.");
  const ids = new Set<string>();
  for (const p of value.pieces) {
    if (
      !object(p) ||
      typeof p.id !== "string" ||
      p.id.length > 100 ||
      ids.has(p.id)
    )
      throw new Error("Each piece needs a unique ID.");
    ids.add(p.id);
    if (typeof p.type !== "string" || !Object.hasOwn(DEFINITIONS, p.type))
      throw new Error("The file contains an unknown piece type.");
    if (
      !Array.isArray(p.position) ||
      p.position.length !== 3 ||
      p.position.some(
        (n) => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 70,
      ) ||
      Number(p.position[1]) < 0.18
    )
      throw new Error(
        "Piece coordinates must be finite and within the workbench.",
      );
    if (!p.id.trim()) throw new Error("Each piece needs a non-empty ID.");
    if (
      typeof p.yaw !== "number" ||
      !Number.isFinite(p.yaw) ||
      Math.abs(p.yaw) > 100 * Math.PI
    )
      throw new Error("A piece has an invalid rotation.");
    if (typeof p.color !== "string" || !Object.hasOwn(COLORS, p.color))
      throw new Error("A piece has an unknown color.");
  }
  const s = value.settings;
  if (
    !object(s) ||
    !Number.isInteger(s.count) ||
    Number(s.count) < 1 ||
    Number(s.count) > 12 ||
    !["classic", "candy", "metal", "glass"].includes(String(s.appearance)) ||
    typeof s.grid !== "boolean" ||
    typeof s.sound !== "boolean" ||
    !["low", "high"].includes(String(s.quality))
  )
    throw new Error("The file contains invalid marble or rendering settings.");
  return {
    version: 1,
    name: value.name.trim(),
    pieces: value.pieces.map((p) => ({
      id: p.id,
      type: p.type,
      position: [...p.position],
      yaw: p.yaw,
      color: p.color,
    })),
    settings: {
      count: s.count,
      appearance: s.appearance,
      grid: s.grid,
      quality: s.quality,
      sound: s.sound,
    },
  } as Track;
}
export function parseTrack(text: string): Track {
  if (text.length > 200000)
    throw new Error("This file is too large. Maximum size is 200 KB.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This is not valid JSON. Choose a Marble Run Lab export.");
  }
  return validateTrack(data);
}
export function serialize(track: Track) {
  return JSON.stringify(track, null, 2);
}
export function loadTrack(): { track: Track; error?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { track: raw ? parseTrack(raw) : preset() };
  } catch {
    return {
      track: preset(),
      error:
        "Saved track could not be loaded. Your browser copy has been left untouched.",
    };
  }
}
export function saveTrack(track: Track) {
  localStorage.setItem(STORAGE_KEY, serialize(track));
}
export function download(data: Blob | string, filename: string) {
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  if (typeof data !== "string")
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
