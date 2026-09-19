import * as T from "three";
import {
  DEFINITIONS,
  COLORS,
  makePiece,
  preset,
  type PieceType,
  type Piece,
} from "../core/model";
import {
  bounds,
  bufferGeometry,
  channelSurface,
  shellSurface,
} from "../core/geometry";
let cache: Record<string, string> | null = null;
export function makePreviews() {
  if (cache) return cache;
  const output: Record<string, string> = {};
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(256, 164);
  renderer.setPixelRatio(1);
  renderer.setClearColor("#f5f5ef", 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight("#fff7e4", "#839786", 1.8));
  const light = new T.DirectionalLight("#ffffff", 2.7);
  light.position.set(-4, 10, 8);
  scene.add(light);
  const camera = new T.PerspectiveCamera(33, 256 / 164, 0.01, 100);
  const group = new T.Group();
  scene.add(group);
  function render(key: string, pieces: Piece[]) {
    for (const p of pieces) {
      const mat = new T.MeshStandardMaterial({
        color: COLORS[p.color],
        roughness: 0.3,
        side: T.DoubleSide,
      });
      const mesh = new T.Mesh(bufferGeometry(channelSurface(p)), mat);
      group.add(mesh);
      const shell = shellSurface(p);
      if (shell) group.add(new T.Mesh(bufferGeometry(shell), mat));
      if (p.type === "tunnel") {
        for (let i = 0; i < 5; i++) {
          const arch = new T.Mesh(
            new T.TorusGeometry(0.64, 0.07, 8, 24, Math.PI),
            mat,
          );
          arch.position.set(0.25 + i * 0.6, 0.2, 0);
          arch.rotation.y = Math.PI / 2;
          group.add(arch);
        }
      }
      if (p.type === "start") {
        const gate = new T.Mesh(
          new T.BoxGeometry(0.13, 0.65, 1.4),
          new T.MeshStandardMaterial({ color: "#eee5cd" }),
        );
        gate.position.set(2.2, 0.15, 0);
        group.add(gate);
      }
    }
    const box = bounds(pieces),
      min = new T.Vector3(...box.min),
      max = new T.Vector3(...box.max),
      center = min.clone().add(max).multiplyScalar(0.5);
    const size = max.clone().sub(min).length();
    camera.position
      .copy(center)
      .add(new T.Vector3(1, 1.15, 1.6).normalize().multiplyScalar(size * 1.4));
    camera.lookAt(center);
    renderer.render(scene, camera);
    output[key] = renderer.domElement.toDataURL("image/png");
    for (const o of [...group.children]) {
      group.remove(o);
      const mesh = o as T.Mesh;
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
    }
  }
  for (const key of Object.keys(DEFINITIONS) as PieceType[])
    render(key, [makePiece(key, [0, 0, 0])]);
  for (const name of ["First Drop", "The Spiral", "Loop Theory"])
    render(name, preset(name).pieces);
  renderer.dispose();
  renderer.forceContextLoss();
  cache = output;
  return output;
}
