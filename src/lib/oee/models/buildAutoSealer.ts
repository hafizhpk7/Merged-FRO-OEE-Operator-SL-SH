import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildAutoSealer(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 105);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "AutoCartonSealer";

  const M = (c: number, o: Record<string, unknown> = {}) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.5,
      metalness:
        lod === 0
          ? Math.min(0.3, (o.metalness as number) ?? 0.4)
          : ((o.metalness as number) ?? 0.4),
      ...o,
    });

  const add = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    p?: THREE.Object3D,
    part: "body" | "guard" | "conveyor" | "product" | "floor" | "hmi" | "lamps" = "body",
  ) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    tagPart(o, part);
    (p || group).add(o);
    return o;
  };

  const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cylZ = (
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: THREE.Material,
    p?: THREE.Object3D,
    part: "body" | "guard" | "conveyor" | "product" | "floor" | "hmi" | "lamps" = "body",
  ) => {
    const g = new THREE.CylinderGeometry(r, r, h, 20);
    g.rotateX(Math.PI / 2);
    const s = new THREE.Mesh(g, m);
    s.position.set(x, y, z);
    tagPart(s, part);
    (p || group).add(s);
    return s;
  };

  // Conveyors
  const rollers: THREE.Mesh[] = [];
  for (const [cx] of [[-6.5], [6.5]]) {
    const rm = M(0x9aa5b4);
    const fm = M(0x4a5566);
    for (let i = 0; i < 7; i++) {
      rollers.push(cylZ(0.12, 1.5, cx - 3 + i * 1, 0.9, 0, rm, group, "conveyor"));
    }
    for (const z of [-0.85, 0.85]) add(B(7, 0.25, 0.1), fm, cx, 0.85, z, group, "conveyor");
    for (const x of [-3, 0, 3]) {
      for (const z of [-0.8, 0.8]) add(B(0.12, 0.8, 0.12), fm, cx + x, 0.4, z, group, "conveyor");
    }
  }

  // Frame & Guards
  const fr = M(0x1c5fd4, { metalness: 0.3 });
  for (const x of [-3.1, 3.1]) {
    for (const z of [-1.3, 1.3]) add(B(0.25, 3.75, 0.25), fr, x, 1.875, z, group, "body");
  }
  for (const z of [-1.3, 1.3]) add(B(6.5, 0.25, 0.25), fr, 0, 3.75, z, group, "body");
  for (const x of [-3.1, 0, 3.1]) add(B(0.25, 0.25, 2.6), fr, x, 3.75, 0, group, "body");
  for (const z of [-1.3, 1.3]) {
    add(
      B(6.2, 2.4, 0.03),
      M(0x9fd4ff, {
        transparent: lod >= 1,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      0,
      2.4,
      z,
      group,
      "guard",
    );
  }

  // Flap Folder & Side Belts
  const bm = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  const lugs: { m: THREE.Mesh; i: number }[] = [];
  for (const s of [-1, 1]) {
    add(B(6, 0.7, 0.12), bm, 0, 1.5, s * 0.62, group, "body");
    add(B(0.9, 0.8, 0.6), M(0x5b6675), -2.3, 2.3, s * 1.0, group, "body");
    const pl = add(B(1.3, 0.03, 0.5), M(0xd2d8e2), -3.5, 1.75, s * 0.4, group, "body");
    pl.rotation.x = s * 0.5;
    pl.rotation.y = -s * 0.15;
    for (let i = 0; i < 5; i++) {
      lugs.push({
        m: add(
          B(0.25, 0.45, 0.06),
          M(0xf2a516, { metalness: 0.1 }),
          0,
          1.5,
          s * 0.56,
          group,
          "body",
        ),
        i,
      });
    }
  }

  // Top Tape Head
  const topRoll = cylZ(0.5, 0.35, 0, 3.25, -0.75, M(0xe8dfc6, { metalness: 0.05 }), group, "body");
  add(B(1.3, 0.8, 1), M(0xd22e2e), 0, 3.2, 0, group, "body");
  add(B(0.3, 0.9, 0.3), M(0x8a95a5), 0, 2.5, 0, group, "body");
  cylZ(0.12, 0.5, 0, 2.2, 0, M(0x444b57), group, "body");

  // Bottom Tape Head
  const botRoll = cylZ(0.4, 0.3, 0, 0.4, 0.75, M(0xe8dfc6, { metalness: 0.05 }), group, "body");
  add(B(1.3, 0.5, 0.8), M(0xe07b00), 0, 0.45, 0, group, "body");
  add(B(0.4, 0.2, 0.4), M(0x8a95a5), 0, 0.85, 0, group, "body");

  // HMI
  const hmi = add(B(0.9, 1.6, 0.8), M(0x2a3444), -3.4, 1.8, -2.2, group, "hmi");
  const scrMat = new THREE.MeshStandardMaterial({
    color: 0x2ecc71,
    emissive: 0x2ecc71,
    emissiveIntensity: 0.6,
  });
  const scr = add(new THREE.PlaneGeometry(0.7, 0.5), scrMat, 0, 0.4, 0.41, hmi, "hmi");

  // Stack light
  const lamps = createStackLight(0.5, 0.16, 0.3);
  lamps.group.position.set(3.1, 3.8, -1.3);
  group.add(lamps.group);

  // Cartons
  const pal = [0xe63946, 0x2a9d8f, 0x1d8ed6, 0x6a4c93, 0xf2cc0f];
  const kraft = M(0xc9a06b, { metalness: 0.02, roughness: 0.85 });
  const flapM = M(0xd8b482, { metalness: 0.02, roughness: 0.85 });
  const tapeM = M(0xf6f0dc, { metalness: 0.05, roughness: 0.3 });
  const N = 6;
  const L = 20;
  const X0 = -10;
  const cts: { g: THREE.Group; fl: THREE.Group[]; tp: THREE.Mesh; band: THREE.Mesh }[] = [];

  for (let i = 0; i < N; i++) {
    const cg = new THREE.Group();
    tagPart(cg, "product");
    add(B(1.6, 1, 1.1), kraft, 0, 0.5, 0, cg, "product");
    const band = add(
      new THREE.PlaneGeometry(1.0, 0.5),
      new THREE.MeshBasicMaterial({ color: pal[i % 5] }),
      0,
      0.5,
      0.552,
      cg,
      "product",
    );
    const fl = [-1, 1].map((s) => {
      const p = new THREE.Group();
      tagPart(p, "product");
      p.position.set(0, 1, s * 0.55);
      cg.add(p);
      add(B(1.6, 0.02, 0.55), flapM, 0, 0.01, s * 0.275, p, "product");
      return p;
    });
    const tp = add(B(1.6, 0.012, 0.06), tapeM, 0, 1.026, 0, cg, "product");
    cg.position.set(X0 + (i * L) / N, 1.02, 0);
    group.add(cg);
    cts.push({ g: cg, fl, tp, band });
  }

  applyLOD(group, lod);

  let localT = rng() * 10;
  let bp = 0;

  const instance: ModelInstance = {
    group,
    setStatus: (s) => {
      currentStatus = s;
      updateStatusVisuals({ status: s, t: localT, lamps, hmiScreen: scr });
    },
    update: (dt, _globalT) => {
      const timeScale = updateStatusVisuals({
        status: currentStatus,
        t: localT,
        lamps,
        hmiScreen: scr,
      });
      if (timeScale <= 0) return;

      const effDt = dt * timeScale;
      localT += effDt;

      const v = 2.4 * timeScale;
      bp += v * effDt;

      for (const c of cts) {
        c.g.position.x += v * effDt;
        if (c.g.position.x > X0 + L) {
          c.g.position.x -= L;
          (c.band.material as THREE.MeshBasicMaterial).color.setHex(pal[Math.floor(rng() * 5)]);
        }
        const x = c.g.position.x;
        const k = Math.min(1, Math.max(0, (x + 3.9) / 1.8));
        const a = 1.3 * (1 - k);
        c.fl[0].rotation.x = a;
        c.fl[1].rotation.x = -a;
        const len = Math.min(1.6, Math.max(0, x + 0.8));
        c.tp.visible = len > 0.03;
        c.tp.scale.x = Math.max(0.01, len / 1.6);
        c.tp.position.x = 0.8 - len / 2;
      }

      for (const r of rollers) r.rotation.z -= (v * effDt) / 0.12;
      for (const l of lugs) l.m.position.x = -2.8 + ((bp + l.i * 1.12) % 5.6);
      topRoll.rotation.z -= v * effDt * 0.6;
      botRoll.rotation.z -= v * effDt * 0.6;
    },
    setLOD: (lvl) => {
      applyLOD(group, lvl);
    },
    getBounds: () => {
      const box = new THREE.Box3();
      group.traverse((obj) => {
        if (obj.userData.part === "body" && obj instanceof THREE.Mesh) {
          box.expandByObject(obj);
        }
      });
      if (box.isEmpty()) box.setFromObject(group);
      return box;
    },
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    },
  };

  instance.setStatus(currentStatus);
  return instance;
}
