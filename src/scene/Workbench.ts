import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  COLORS,
  DEFINITIONS,
  worldPoint,
  openEnds,
  rotate,
  type Track,
  type Piece,
  type Vec3,
} from "../core/model";
import {
  bounds,
  bufferGeometry,
  channelSurface,
  frame,
  shellSurface,
} from "../core/geometry";
import { Simulation, RADIUS, STEP } from "../core/physics";
import { ToySound } from "./sound";
export type Stats = {
  elapsed: number;
  finished: number;
  fallen: number;
  total: number;
};
export interface SceneEvents {
  select: (id: string | null) => void;
  attach: (id: string) => void;
  marble: (index: number) => void;
  stats: (stats: Stats) => void;
  ready: () => void;
  error: (message: string) => void;
  labels: (labels: {
    start: [number, number] | null;
    finish: [number, number] | null;
  }) => void;
  followExit: () => void;
}
export class Workbench {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(38, 1, 0.1, 250);
  controls: OrbitControls;
  root = new T.Group();
  aids = new T.Group();
  marbleGroup = new T.Group();
  ghost = new T.Group();
  grid: T.GridHelper;
  selection = new T.Group();
  sim: Simulation | null = null;
  track: Track | null = null;
  mode: "build" | "run" = "build";
  playing = false;
  speed = 1;
  follow: number | null = null;
  photo = false;
  sound = new ToySound();
  frameId = 0;
  disposed = false;
  observer: ResizeObserver;
  last = 0;
  accumulator = 0;
  lastStats = 0;
  lastFinished = 0;
  lastFallen = 0;
  lastImpactPulse = 0;
  raycaster = new T.Raycaster();
  pointer = new T.Vector2();
  clickStart = [0, 0];
  marbleMeshes: T.Mesh[] = [];
  gateMesh: T.Group | null = null;
  targetCamera: T.Vector3 | null = null;
  targetFocus: T.Vector3 | null = null;
  selectedId: string | null = null;
  materials: T.Material[] = [];
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  animating = new Map<T.Object3D, number>();
  constructor(
    public host: HTMLElement,
    public events: SceneEvents,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.setClearColor("#f0efe9");
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D marble track. Drag to orbit, right-drag to pan, and scroll to zoom.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.scene.background = new T.Color("#f0efe9");
    this.scene.fog = new T.Fog("#f0efe9", 65, 135);
    const pmrem = new T.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();
    const ambient = new T.HemisphereLight("#fff8e7", "#b5beb8", 1.8);
    this.scene.add(ambient);
    const sun = new T.DirectionalLight("#fff9ee", 2.5);
    sun.position.set(-8, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
      near: 1,
      far: 65,
    });
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0003;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const fill = new T.DirectionalLight("#d8e6ff", 0.8);
    fill.position.set(10, 10, -15);
    this.scene.add(fill);
    const floor = new T.Mesh(
      new T.PlaneGeometry(220, 220),
      new T.MeshStandardMaterial({ color: "#f0efe9", roughness: 0.87 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.grid = new T.GridHelper(160, 160, "#cbd0c4", "#d5d8cf");
    this.grid.position.y = -0.142;
    (this.grid.material as T.Material).transparent = true;
    (this.grid.material as T.Material).opacity = 0.35;
    this.scene.add(
      this.grid,
      this.root,
      this.aids,
      this.marbleGroup,
      this.selection,
      this.ghost,
    );
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 80;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
    this.controls.minPolarAngle = 0.02;
    this.controls.target.set(0, 2, 0);
    this.controls.addEventListener("start", () => {
      this.targetCamera = null;
      this.targetFocus = null;
      if (this.follow !== null) {
        this.follow = null;
        events.followExit();
      }
    });
    this.renderer.domElement.addEventListener("pointerdown", this.pointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.pointerUp);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.frameId = requestAnimationFrame(this.tick);
  }
  contextLost = (e: Event) => {
    e.preventDefault();
    this.playing = false;
    this.events.error(
      "The graphics context was interrupted. Reload to restore your saved track.",
    );
  };
  resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.track) this.cameraView("fit");
  }
  plastic(color: string) {
    return new T.MeshPhysicalMaterial({
      color,
      roughness: 0.3,
      metalness: 0.015,
      clearcoat: 0.36,
      clearcoatRoughness: 0.24,
      side: T.DoubleSide,
    });
  }
  mesh(
    geometry: T.BufferGeometry,
    material: T.Material,
    parent: T.Object3D,
    pos?: Vec3,
  ) {
    const m = new T.Mesh(geometry, material);
    if (pos) m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  clear(group: T.Group) {
    for (const o of [...group.children]) {
      group.remove(o);
      o.traverse((n) => {
        if (n instanceof T.Mesh) {
          n.geometry.dispose();
          for (const m of Array.isArray(n.material) ? n.material : [n.material])
            m.dispose();
        }
      });
    }
  }
  update(track: Track, animateId?: string) {
    this.track = track;
    this.grid.visible = track.settings.grid && !this.photo;
    this.sound.enabled = track.settings.sound;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, track.settings.quality === "low" ? 1 : 2),
    );
    this.renderer.shadowMap.enabled = track.settings.quality === "high";
    this.clear(this.root);
    this.clear(this.aids);
    this.gateMesh = null;
    for (const p of track.pieces) {
      const group = this.createPiece(p);
      this.root.add(group);
      if (p.id === animateId && !this.reduced)
        this.animating.set(group, performance.now());
    }
    for (const p of openEnds(track.pieces)) {
      const q = worldPoint(p, 1);
      const m = this.mesh(
        new T.TorusGeometry(0.3, 0.04, 10, 40),
        new T.MeshBasicMaterial({ color: "#527261", depthTest: false }),
        this.aids,
        [q[0], q[1] + 0.04, q[2]],
      );
      m.rotation.x = -Math.PI / 2;
      m.userData = { connector: p.id };
      m.renderOrder = 5;
      const plus = this.mesh(
        new T.BoxGeometry(0.27, 0.035, 0.04),
        new T.MeshBasicMaterial({ color: "#527261" }),
        this.aids,
        [q[0], q[1] + 0.06, q[2]],
      );
      plus.userData = { connector: p.id };
      const plus2 = plus.clone();
      plus2.rotation.y = Math.PI / 2;
      this.aids.add(plus2);
    }
    this.reset();
    this.select(this.selectedId);
  }
  createPiece(p: Piece, preview = false) {
    const group = new T.Group();
    group.userData.pieceId = p.id;
    const mat = this.plastic(COLORS[p.color]);
    if (preview) {
      mat.transparent = true;
      mat.opacity = 0.45;
    }
    this.mesh(bufferGeometry(channelSurface(p)), mat, group);
    const def = DEFINITIONS[p.type];
    const metal = new T.MeshStandardMaterial({
      color: "#c2cbc7",
      roughness: 0.36,
      metalness: 0.73,
    });
    const foot = this.plastic("#b7c0b7");
    if (!preview) {
      for (const t of p.type === "loop"
        ? [0.03, 0.5, 0.97]
        : p.type === "funnel"
          ? [0, 0.27, 0.54, 0.88]
          : [0.14, 0.83]) {
        const q = worldPoint(p, t);
        if (q[1] < 0.35) continue;
        const height = q[1] - 0.12;
        this.mesh(
          new T.CylinderGeometry(0.075, 0.09, height, 12),
          metal,
          group,
          [q[0], height / 2 - 0.1, q[2]],
        );
        this.mesh(new T.CylinderGeometry(0.31, 0.36, 0.1, 24), foot, group, [
          q[0],
          -0.09,
          q[2],
        ]);
        this.mesh(
          new T.CylinderGeometry(0.16, 0.16, 0.13, 16),
          this.plastic(COLORS[p.color]),
          group,
          [q[0], q[1] - 0.18, q[2]],
        );
      }
    }
    // End collars make the modular joints visible without interrupting the running surface.
    for (const t of [0.015, 0.985]) {
      const q = worldPoint(p, t),
        { side } = frame(p, t);
      for (const sign of [-1, 1]) {
        const at = new T.Vector3(...q).addScaledVector(side, sign * 0.57);
        const joint = this.mesh(
          new RoundedBoxGeometry(0.14, 0.18, 0.16, 2, 0.045),
          this.plastic(COLORS[p.color]),
          group,
          [at.x, at.y + 0.36, at.z],
        );
        joint.rotation.y = -p.yaw;
      }
    }
    if (p.type === "start") {
      const q = worldPoint(p, 0.9);
      const gate = new T.Group();
      gate.position.set(...q);
      gate.rotation.y = -p.yaw;
      this.mesh(
        new RoundedBoxGeometry(0.14, 0.42, 1.16, 3, 0.05),
        this.plastic("#f5eee0"),
        gate,
        [0, 0.25, 0],
      );
      for (const z of [-0.68, 0.68])
        this.mesh(new T.CylinderGeometry(0.09, 0.09, 0.95, 12), metal, gate, [
          0,
          0.35,
          z,
        ]);
      this.mesh(
        new RoundedBoxGeometry(0.24, 0.15, 1.52, 3, 0.06),
        this.plastic(COLORS[p.color]),
        gate,
        [0, 0.86, 0],
      );
      group.add(gate);
      if (!preview) this.gateMesh = gate;
    }
    if (p.type === "finish") {
      const q = worldPoint(p, 1);
      const end = this.mesh(
        new RoundedBoxGeometry(0.2, 0.66, 1.84, 3, 0.06),
        mat,
        group,
        [q[0], q[1] + 0.18, q[2]],
      );
      end.rotation.y = -p.yaw;
    }
    if (p.type === "tunnel") {
      const g = new T.Group();
      g.position.set(...p.position);
      g.rotation.y = -p.yaw;
      for (let i = 0; i < 7; i++) {
        const arch = this.mesh(
          new T.TorusGeometry(0.64, 0.085, 10, 36, Math.PI),
          mat,
          g,
          [0.22 + i * 0.43, 0.31 - 0.28 * ((0.22 + i * 0.43) / 3), 0],
        );
        arch.rotation.y = Math.PI / 2;
      }
      group.add(g);
    }
    const shell = shellSurface(p);
    if (shell) {
      const material = this.plastic(COLORS[p.color]);
      material.transparent = true;
      material.opacity = p.type === "tunnel" ? 0.24 : 0.82;
      this.mesh(bufferGeometry(shell), material, group);
    }
    group.traverse((o) => {
      o.userData.pieceId = p.id;
    });
    return group;
  }
  reset() {
    this.sim?.dispose();
    if (this.track) this.sim = new Simulation(this.track);
    this.accumulator = 0;
    this.playing = false;
    this.lastFinished = 0;
    this.lastFallen = 0;
    this.follow = null;
    this.clear(this.marbleGroup);
    this.marbleMeshes = [];
    if (this.gateMesh)
      this.gateMesh.position.y = worldPoint(
        this.track!.pieces.find((p) => p.type === "start")!,
        0.9,
      )[1];
    const palette = [
      "#f0b83f",
      "#e88164",
      "#507ad1",
      "#82b7a0",
      "#cb75a3",
      "#eee3c1",
    ];
    if (this.sim)
      for (const m of this.sim.marbles) {
        const style = this.track!.settings.appearance;
        let mat: T.MeshPhysicalMaterial;
        if (style === "metal")
          mat = new T.MeshPhysicalMaterial({
            color: "#d0d7de",
            metalness: 0.98,
            roughness: 0.16,
          });
        else if (style === "glass")
          mat = new T.MeshPhysicalMaterial({
            color: palette[m.index % 6],
            metalness: 0.08,
            roughness: 0.08,
            transmission: 0.55,
            thickness: 0.3,
            clearcoat: 1,
          });
        else {
          mat = new T.MeshPhysicalMaterial({
            color: palette[m.index % 6],
            roughness: 0.15,
            metalness: 0.12,
            clearcoat: 1,
          });
          if (style === "candy") {
            const canvas = document.createElement("canvas");
            canvas.width = 128;
            canvas.height = 64;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = palette[m.index % 6];
            ctx.fillRect(0, 0, 128, 64);
            ctx.strokeStyle = "#fff3d9";
            ctx.lineWidth = 11;
            for (let j = -2; j < 10; j++) {
              ctx.beginPath();
              ctx.moveTo(j * 24, 0);
              ctx.bezierCurveTo(
                j * 24 + 35,
                20,
                j * 24 - 5,
                40,
                j * 24 + 28,
                64,
              );
              ctx.stroke();
            }
            const texture = new T.CanvasTexture(canvas);
            texture.colorSpace = T.SRGBColorSpace;
            mat.color.set("#ffffff");
            mat.map = texture;
          }
        }
        const mesh = this.mesh(
          new T.SphereGeometry(RADIUS, 24, 16),
          mat,
          this.marbleGroup,
        );
        mesh.userData.marble = m.index;
        this.marbleMeshes.push(mesh);
      }
    this.syncMarbles();
    this.events.stats(
      this.sim?.stats ?? { elapsed: 0, finished: 0, fallen: 0, total: 0 },
    );
  }
  setMode(mode: "build" | "run") {
    this.mode = mode;
    if (mode === "build") this.reset();
    this.aids.visible = mode === "build" && !this.photo;
    this.selection.visible = mode === "build" && !this.photo;
    this.clear(this.ghost);
  }
  play() {
    if (!this.sim) return;
    this.mode = "run";
    this.aids.visible = false;
    this.selection.visible = false;
    if (!this.sim.released) {
      this.sim.release();
      this.sound.play("gate");
    }
    this.playing = true;
  }
  select(id: string | null) {
    this.selectedId = id;
    this.clear(this.selection);
    if (!this.track || !id) return;
    const p = this.track.pieces.find((x) => x.id === id);
    if (!p) return;
    const shape = bufferGeometry(channelSurface(p));
    const edges = new T.EdgesGeometry(shape, 32);
    shape.dispose();
    const lines = new T.LineSegments(
      edges,
      new T.LineBasicMaterial({
        color: "#3c6350",
        transparent: true,
        opacity: 0.75,
        depthTest: false,
      }),
    );
    lines.renderOrder = 6;
    this.selection.add(lines);
  }
  preview(p: Piece | null, valid = true) {
    this.clear(this.ghost);
    if (!p) return;
    const g = this.createPiece(p, true);
    g.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.material = new T.MeshBasicMaterial({
          color: valid ? "#527c67" : "#cb654f",
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          side: T.DoubleSide,
        });
      }
    });
    this.ghost.add(g);
  }
  cameraView(kind: "home" | "top" | "fit") {
    if (!this.track) return;
    this.follow = null;
    const b = bounds(this.track.pieces),
      center = new T.Vector3(
        (b.min[0] + b.max[0]) / 2,
        ((b.min[1] + b.max[1]) / 2) * 0.7,
        (b.min[2] + b.max[2]) / 2,
      );
    const radius =
      new T.Vector3(...b.max).sub(new T.Vector3(...b.min)).length() / 2;
    const w = this.host.clientWidth,
      h = this.host.clientHeight,
      mobile = w < 640;
    const left = mobile ? 18 : w < 1000 ? 265 : 290,
      right = mobile ? 18 : w < 1000 ? 68 : 255,
      top = mobile ? 165 : 145,
      bottom = mobile ? 200 : 215;
    const usableW = Math.max(w - left - right, w * 0.48),
      usableH = Math.max(h - top - bottom, h * 0.46);
    const tangent = Math.tan(T.MathUtils.degToRad(this.camera.fov) / 2);
    const offsetX = (left - right) / 2,
      offsetY = (top - bottom) / 2;
    this.camera.setViewOffset(w, h, -offsetX, -offsetY, w, h);
    const offset =
      kind === "top"
        ? new T.Vector3(0.01, 1, 0)
        : new T.Vector3(1.15, 0.94, 1.35).normalize();
    const rightAxis = new T.Vector3(offset.z, 0, -offset.x).normalize(),
      upAxis = offset.clone().cross(rightAxis).normalize();
    let fit = 5;
    for (const p of this.track.pieces) {
      for (let i = 0; i <= 40; i++) {
        const q = new T.Vector3(...worldPoint(p, i / 40));
        for (const y of [q.y + 0.65, Math.max(-0.15, q.y - 0.3)]) {
          const delta = q.clone().setY(y).sub(center);
          fit = Math.max(
            fit,
            delta.dot(offset) +
              (Math.abs(delta.dot(rightAxis)) + 0.65) /
                ((tangent * usableW) / h),
            delta.dot(offset) +
              (Math.abs(delta.dot(upAxis)) + 0.25) / ((tangent * usableH) / h),
          );
        }
      }
    }
    this.targetFocus = center;
    this.targetCamera = center.clone().addScaledVector(offset, fit * 1.1);
    if (this.reduced || this.camera.position.length() < 1) {
      this.camera.position.copy(this.targetCamera);
      this.controls.target.copy(center);
      this.targetCamera = null;
      this.targetFocus = null;
    }
    this.events.followExit();
  }
  setPhoto(on: boolean) {
    this.photo = on;
    this.grid.visible = !on && !!this.track?.settings.grid;
    this.aids.visible = !on && this.mode === "build";
    this.selection.visible = !on && this.mode === "build";
    this.ghost.visible = !on;
  }
  async capture(): Promise<Blob> {
    const was = this.photo;
    this.setPhoto(true);
    const oldRatio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1.5));
    this.renderer.render(this.scene, this.camera);
    const blob = await new Promise<Blob | null>((r) =>
      this.renderer.domElement.toBlob(r, "image/png"),
    );
    this.renderer.setPixelRatio(oldRatio);
    this.setPhoto(was);
    if (!blob)
      throw new Error("Your browser could not create the image. Try again.");
    return blob;
  }
  pointerDown = (e: PointerEvent) => {
    this.clickStart = [e.clientX, e.clientY];
  };
  pointerUp = (e: PointerEvent) => {
    if (
      e.button !== 0 ||
      Math.hypot(
        e.clientX - this.clickStart[0],
        e.clientY - this.clickStart[1],
      ) > 5 ||
      this.photo
    )
      return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      [this.root, this.aids, this.marbleGroup],
      true,
    );
    for (const hit of hits) {
      if (hit.object.userData.marble !== undefined) {
        this.events.marble(hit.object.userData.marble);
        return;
      }
      if (this.mode === "run") continue;
      if (hit.object.userData.connector) {
        this.events.attach(hit.object.userData.connector);
        return;
      }
      if (hit.object.userData.pieceId) {
        this.events.select(hit.object.userData.pieceId);
        return;
      }
    }
    if (this.mode === "build") this.events.select(null);
  };
  syncMarbles() {
    this.sim?.marbles.forEach((m, i) => {
      const p = m.body.translation(),
        q = m.body.rotation(),
        mesh = this.marbleMeshes[i];
      if (mesh) {
        mesh.position.set(p.x, p.y, p.z);
        mesh.quaternion.set(q.x, q.y, q.z, q.w);
      }
    });
  }
  project(p: Vec3): [number, number] | null {
    const v = new T.Vector3(...p).project(this.camera);
    if (v.z > 1) return null;
    return [
      (v.x * 0.5 + 0.5) * this.host.clientWidth,
      (-v.y * 0.5 + 0.5) * this.host.clientHeight,
    ];
  }
  tick = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min((now - this.last) / 1000 || 0, 0.06);
    this.last = now;
    if (this.playing && this.sim) {
      this.accumulator += dt * this.speed;
      let steps = 0;
      while (this.accumulator >= STEP && steps < 30) {
        this.sim.step();
        this.accumulator -= STEP;
        steps++;
      }
      this.syncMarbles();
      if (this.gateMesh && this.sim.released) {
        const start = this.track!.pieces.find((p) => p.type === "start")!;
        this.gateMesh.position.y = T.MathUtils.lerp(
          this.gateMesh.position.y,
          worldPoint(start, 0.9)[1] + 0.95,
          1 - Math.exp(-dt * 9),
        );
      }
      if (this.sim.impactPulse > this.lastImpactPulse) {
        this.sound.play("impact");
        this.lastImpactPulse = this.sim.impactPulse;
      }
      if (this.sim.stats.finished > this.lastFinished) {
        this.sound.play("finish");
        this.lastFinished = this.sim.stats.finished;
      }
      if (this.sim.stats.fallen > this.lastFallen) {
        this.sound.play("impact");
        this.lastFallen = this.sim.stats.fallen;
      }
      if (now - this.lastStats > 120) {
        this.events.stats(this.sim.stats);
        this.lastStats = now;
      }
    }
    if (this.follow !== null && this.marbleMeshes[this.follow]) {
      const p = this.marbleMeshes[this.follow].position;
      const rate = 1 - Math.exp(-dt * 4);
      this.controls.target.lerp(p, rate);
      this.camera.position.lerp(p.clone().add(new T.Vector3(4, 3.4, 5)), rate);
    } else if (this.targetCamera && this.targetFocus) {
      const rate = this.reduced ? 1 : 1 - Math.exp(-dt * 4.5);
      this.camera.position.lerp(this.targetCamera, rate);
      this.controls.target.lerp(this.targetFocus, rate);
      if (this.camera.position.distanceTo(this.targetCamera) < 0.015) {
        this.targetCamera = null;
        this.targetFocus = null;
      }
    }
    for (const [g, start] of this.animating) {
      const t = (now - start) / 1000;
      g.position.y = Math.exp(-9 * t) * Math.sin(t * 17) * 0.28;
      if (t > 0.7) {
        g.position.y = 0;
        this.animating.delete(g);
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.track && now - this.lastStats < 20) {
      const start = this.track.pieces.find((p) => p.type === "start"),
        finish = this.track.pieces.find((p) => p.type === "finish");
      this.events.labels({
        start: start
          ? this.project(
              worldPoint(start, 0.2).map((v, i) =>
                i === 1 ? v + 0.85 : v,
              ) as Vec3,
            )
          : null,
        finish: finish
          ? this.project(
              worldPoint(finish, 0.6).map((v, i) =>
                i === 1 ? v + 0.6 : v,
              ) as Vec3,
            )
          : null,
      });
    }
    if (!this.playing && now - this.lastStats > 120) {
      this.lastStats = now;
      const start = this.track?.pieces.find((p) => p.type === "start"),
        finish = this.track?.pieces.find((p) => p.type === "finish");
      this.events.labels({
        start: start
          ? this.project(
              worldPoint(start, 0.2).map((v, i) =>
                i === 1 ? v + 0.8 : v,
              ) as Vec3,
            )
          : null,
        finish: finish
          ? this.project(
              worldPoint(finish, 0.6).map((v, i) =>
                i === 1 ? v + 0.6 : v,
              ) as Vec3,
            )
          : null,
      });
    }
    this.frameId = requestAnimationFrame(this.tick);
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.controls.dispose();
    this.sim?.dispose();
    this.sound.dispose();
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.pointerDown,
    );
    this.renderer.domElement.removeEventListener("pointerup", this.pointerUp);
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
