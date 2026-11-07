import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildLabelling(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 103);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "LabellingMachine";

  const M = (c: number, o: Record<string, unknown> = {}) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.5,
      metalness:
        lod === 0
          ? Math.min(0.3, (o.metalness as number) ?? 0.3)
          : ((o.metalness as number) ?? 0.3),
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
  const C = (a: number, b: number, h: number, s = 32) => new THREE.CylinderGeometry(a, b, h, s);

  // Floor circle
  const flGeo = new THREE.CircleGeometry(6, 48);
  const fl = add(flGeo, M(0x888882, { transparent: true, opacity: 0.25 }), 0, 0, 0, group, "floor");
  fl.rotation.x = -Math.PI / 2;

  // Conveyor & Legs
  add(B(8, 0.08, 0.9), M(0x2b2e33, { roughness: 0.8 }), 0, 0.96, 0, group, "conveyor");
  [-0.5, 0.5].forEach((z) => {
    add(B(8, 0.14, 0.05), M(0xb9bec6), 0, 1.06, z, group, "conveyor");
  });
  [-3.6, -1.2, 1.2, 3.6].forEach((x) => {
    [-0.4, 0.4].forEach((z) => {
      add(B(0.07, 0.92, 0.07), M(0x8d939c), x, 0.46, z, group, "conveyor");
    });
  });

  // Machine Cabinet & Top Frame
  add(B(1.5, 1.9, 1.1), M(0x1f5fa8), 0, 0.95, -1.2, group, "body");
  add(B(1.56, 0.05, 1.16), M(0xc9ced6), 0, 1.92, -1.2, group, "body");

  // Reels
  function makeReel(r: number, x: number) {
    const rg = new THREE.Group();
    tagPart(rg, "body");
    rg.position.set(x, 1.65, -0.6);
    rg.rotation.x = Math.PI / 2;
    group.add(rg);
    const disc = add(C(r, r, 0.06), M(0xe8ebef), 0, 0, 0, rg, "body");
    add(C(r * 0.3, r * 0.3, 0.08), M(0x555b64), 0, 0, 0, disc, "body");
    add(B(r * 1.6, 0.012, 0.04), M(0x555b64), 0, 0.035, 0, disc, "body");
    return disc;
  }
  const reels = [makeReel(0.3, -0.45), makeReel(0.2, 0.35)];

  // Applicator & Peel Plate
  add(B(0.55, 0.03, 0.4), M(0xd7dbe0), 0, 1.25, -0.45, group, "body");
  add(C(0.05, 0.05, 0.3), M(0x333840), 0.3, 1.25, -0.25, group, "body");

  // Sensor
  add(B(0.04, 0.25, 0.04), M(0x9aa0a8), -0.7, 1.12, 0.55, group, "body");
  add(B(0.09, 0.09, 0.09), M(0x19c2d6, { emissive: 0x0a7d8a }), -0.7, 1.28, 0.55, group, "body");

  // HMI
  add(B(0.36, 0.26, 0.03), M(0x111418), 0.35, 1.3, -0.64, group, "hmi");
  const scrMat = new THREE.MeshStandardMaterial({
    color: 0x2ecc71,
    emissive: 0x2ecc71,
    emissiveIntensity: 0.6,
  });
  const scr = add(B(0.3, 0.2, 0.005), scrMat, 0.35, 1.3, -0.62, group, "hmi");

  // Stack light
  const lamps = createStackLight(0.5, 0.08, 0.12);
  lamps.group.position.set(0.6, 2.0, -1.2);
  group.add(lamps.group);

  // Bottles
  const bm = M(0x3fb6a8, { transparent: lod >= 1, opacity: 0.85, roughness: 0.2 });
  const bottles: { g: THREE.Group; lab: THREE.Mesh }[] = [];
  for (let i = 0; i < 10; i++) {
    const bg = new THREE.Group();
    tagPart(bg, "product");
    add(C(0.15, 0.15, 0.5), bm, 0, 0.25, 0, bg, "product");
    add(C(0.06, 0.15, 0.1), bm, 0, 0.55, 0, bg, "product");
    add(C(0.06, 0.06, 0.08), bm, 0, 0.64, 0, bg, "product");
    add(C(0.07, 0.07, 0.07), M(0x2b6fd6), 0, 0.71, 0, bg, "product");
    const lab = add(
      new THREE.CylinderGeometry(0.152, 0.152, 0.22, 24, 1, true),
      M(0xf2b84b, { side: THREE.DoubleSide }),
      0,
      0.25,
      0,
      bg,
      "product",
    );
    lab.visible = false;
    bg.position.set(-4 + i * 0.8, 1.0, 0);
    group.add(bg);
    bottles.push({ g: bg, lab });
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

      bottles.forEach((b) => {
        b.g.position.x += effDt * 0.9;
        if (b.g.position.x > 4) {
          b.g.position.x -= 8;
          b.lab.visible = false;
        }
        if (!b.lab.visible && b.g.position.x > 0.15) {
          b.lab.visible = true;
        }
      });

      reels.forEach((r) => {
        r.rotation.y += effDt * 1.2;
      });
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
