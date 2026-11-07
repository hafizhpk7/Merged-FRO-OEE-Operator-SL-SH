import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildShrink(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 104);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "ShrinkSleeveMachine";

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
  const C = (
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: THREE.Material,
    p?: THREE.Object3D,
    part: "body" | "guard" | "conveyor" | "product" | "floor" | "hmi" | "lamps" = "body",
  ) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), m);
    s.position.set(x, y, z);
    tagPart(s, part);
    (p || group).add(s);
    return s;
  };

  // Conveyors
  const belt = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  add(B(9, 0.12, 1.5), belt, -5.5, 1, 0, group, "conveyor");
  add(B(9, 0.12, 1.5), belt, 5.5, 1, 0, group, "conveyor");
  for (const cx of [-5.5, 5.5]) {
    for (const z of [-0.85, 0.85])
      add(B(9, 0.3, 0.08), M(0xc3ccd8), cx, 1.25, z, group, "conveyor");
    for (const x of [-4.5, 0, 4.5]) {
      for (const z of [-0.7, 0.7])
        add(B(0.12, 0.95, 0.12), M(0x8a95a5), cx + x, 0.5, z, group, "conveyor");
    }
  }

  // Applicator
  const blue = M(0x1c5fd4, { metalness: 0.3 });
  for (const z of [-1.5, 1.5]) add(B(3, 3.2, 0.9), blue, -3.5, 1.6, z, group, "body");
  add(B(3, 0.8, 3.9), blue, -3.5, 3.4, 0, group, "body");
  add(B(3.1, 0.15, 4), M(0xdfe5ee), -3.5, 3.85, 0, group, "body");
  C(0.32, 1.4, -3.5, 2.4, 0, M(0xaab4c2, { metalness: 0.8, roughness: 0.2 }), group, "body");

  // Reel
  const reel = C(0.9, 0.6, -3.5, 4.7, -1.2, M(0xf2a516, { metalness: 0.1 }), group, "body");
  reel.rotation.x = Math.PI / 2;
  const reelAxle = C(0.25, 0.7, -3.5, 4.7, -1.2, M(0x444b57), group, "body");
  reelAxle.rotation.x = Math.PI / 2;
  add(B(0.6, 1, 0.5), M(0xdfe5ee), -3.5, 4.4, -0.4, group, "body");

  // Tunnel
  const tm = M(0xb9c2cf, { metalness: 0.7, roughness: 0.35 });
  for (const z of [-1.3, 1.3]) add(B(6, 2.4, 0.35), tm, 2.5, 2.1, z, group, "body");
  add(B(6, 0.4, 3), tm, 2.5, 3.5, 0, group, "body");
  for (let i = 0; i < 5; i++) C(0.22, 0.5, 0.4 + i * 1.2, 3.95, 0, M(0x6a7482), group, "body");
  add(B(6.2, 0.2, 0.1), M(0x8a95a5), 2.5, 1.15, -1.4, group, "body");

  // HMI
  const hmi = add(B(0.9, 1.6, 0.8), M(0x2a3444), -6.2, 1.8, -2.2, group, "hmi");
  const scrMat = new THREE.MeshStandardMaterial({
    color: 0x2ecc71,
    emissive: 0x2ecc71,
    emissiveIntensity: 0.6,
  });
  const scr = add(new THREE.PlaneGeometry(0.7, 0.5), scrMat, 0, 0.4, 0.41, hmi, "hmi");

  // Stack light
  const lamps = createStackLight(0.5, 0.16, 0.3);
  lamps.group.position.set(-2.3, 4.2, 1.5);
  group.add(lamps.group);

  // Bottles
  const pal = [0xe63946, 0x2a9d8f, 0xf4a261, 0x6a4c93, 0x1d8ed6, 0xf2cc0f];
  const bots: { g: THREE.Group; sl: THREE.Mesh }[] = [];
  const N = 14;
  const L = 20;
  const X0 = -10;
  for (let i = 0; i < N; i++) {
    const bg = new THREE.Group();
    tagPart(bg, "product");
    C(0.34, 1.1, 0, 0.55, 0, M(0xf5f7fa, { metalness: 0.05, roughness: 0.3 }), bg, "product");
    const sh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.34, 0.3, 20),
      M(0xf5f7fa, { metalness: 0.05, roughness: 0.3 }),
    );
    sh.position.y = 1.25;
    tagPart(sh, "product");
    bg.add(sh);
    C(0.15, 0.16, 0, 1.48, 0, M(0x222831), bg, "product");
    const sl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.37, 0.37, 0.8, 28, 1, true),
      M(pal[i % 6], { metalness: 0.05, roughness: 0.45, side: THREE.DoubleSide }),
    );
    sl.position.y = 0.6;
    tagPart(sl, "product");
    bg.add(sl);
    bg.position.set(X0 + (i * L) / N, 1.06, 0);
    group.add(bg);
    bots.push({ g: bg, sl });
  }

  // Steam (for LOD 2)
  const steamM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
  const steam: { s: THREE.Mesh; t: number }[] = [];
  if (lod >= 2) {
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10), steamM.clone());
      tagPart(s, "product");
      group.add(s);
      steam.push({ s, t: rng() });
    }
  }

  applyLOD(group, lod);

  let localT = rng() * 10;

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

      const v = 2.6 * timeScale;
      for (const b of bots) {
        b.g.position.x += v * effDt;
        if (b.g.position.x > X0 + L) {
          b.g.position.x -= L;
          (b.sl.material as THREE.MeshStandardMaterial).color.setHex(pal[Math.floor(rng() * 6)]);
        }
        const x = b.g.position.x;
        b.sl.visible = x > -3.7;
        const k = Math.min(1, Math.max(0, (x - 0.2) / 4.5));
        const sc = 1.13 - 0.13 * k;
        b.sl.scale.set(sc, 1 - 0.02 * k, sc);
      }

      reel.rotation.y -= effDt * 1.2;

      for (const p of steam) {
        p.t = (p.t + effDt * 0.5) % 1;
        p.s.position.set(
          1 + ((p.t * 7) % 5) * 0.8 - 0.4 + Math.sin(p.t * 9) * 0.2,
          4.3 + p.t * 1.8,
          Math.cos(p.t * 7) * 0.4,
        );
        (p.s.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - p.t);
        p.s.scale.setScalar(0.6 + p.t * 1.4);
      }
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
