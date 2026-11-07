import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildFeeder(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 112);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "FeederMachine";

  const M = (c: number, o: Record<string, unknown> = {}) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.5,
      metalness:
        lod === 0
          ? Math.min(0.3, (o.metalness as number) ?? 0.25)
          : ((o.metalness as number) ?? 0.25),
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
  const cylY = (
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: THREE.Material,
    p?: THREE.Object3D,
    part: "body" | "guard" | "conveyor" | "product" | "floor" | "hmi" | "lamps" = "body",
  ) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), m);
    s.position.set(x, y, z);
    tagPart(s, part);
    (p || group).add(s);
    return s;
  };

  const steel = M(0xd5d9de, { metalness: 0.4, roughness: 0.4 });
  const dark = M(0x333840, { metalness: 0.1, roughness: 0.8 });
  const teal = M(0x0f7a6b);
  const teal2 = M(0x0b5f53);
  const lite = M(0xeceff2, { metalness: 0.1 });
  const belt = M(0x2b2e33, { metalness: 0.05, roughness: 0.85 });

  // Drive cabinet + door
  add(B(1.9, 0.9, 1.9), teal, 0, 0.45, 0, group, "body");
  add(B(1.5, 0.7, 0.01), teal2, 0, 0.45, 0.955, group, "body");
  add(B(0.3, 0.04, 0.03), steel, 0.5, 0.5, 0.97, group, "body");

  // Rotary unscrambler table
  const tbl = new THREE.Group();
  tagPart(tbl, "body");
  group.add(tbl);
  cylY(0.85, 0.06, 0, 0.93, 0, lite, tbl, "body");
  for (let i = 0; i < 3; i++) {
    const s = add(B(0.85, 0.012, 0.05), steel, 0, 0.965, 0, tbl, "body");
    s.rotation.y = (i * Math.PI) / 3;
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 32), steel);
  cone.position.set(0, 1.06, 0);
  tagPart(cone, "body");
  tbl.add(cone);

  // Bottles on table
  const pal = [0x3fb6a8, 0xe63946, 0x1d8ed6, 0xf2a516, 0x6a4c93];
  function makeBottle(col: number, p: THREE.Object3D, x: number, y: number, z: number) {
    const bg = new THREE.Group();
    tagPart(bg, "product");
    const m = M(col, { metalness: 0.05, roughness: 0.35 });
    cylY(0.11, 0.36, 0, 0.18, 0, m, bg, "product");
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.08, 32), m);
    sh.position.y = 0.4;
    tagPart(sh, "product");
    bg.add(sh);
    cylY(0.05, 0.06, 0, 0.47, 0, m, bg, "product");
    cylY(0.055, 0.05, 0, 0.525, 0, M(0xf5f5f5, { metalness: 0.1 }), bg, "product");
    bg.position.set(x, y, z);
    p.add(bg);
    return bg;
  }

  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996;
    const r = 0.3 + 0.46 * Math.sqrt((i + 0.5) / 18);
    makeBottle(pal[i % 5], tbl, r * Math.cos(a), 0.96, r * Math.sin(a));
  }

  // Outer ring with exit gap (+X)
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.92, 0.32, 64, 1, true, Math.PI / 2 + 0.4, Math.PI * 2 - 0.8),
    M(0xb9c2cf, { metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide }),
  );
  ring.position.y = 1.13;
  tagPart(ring, "body");
  group.add(ring);

  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.02, 8, 64, Math.PI * 2 - 0.8), steel);
  lip.rotation.x = Math.PI / 2;
  lip.rotation.z = Math.PI / 2 + 0.4 - Math.PI / 2;
  lip.position.y = 1.29;
  tagPart(lip, "body");
  group.add(lip);

  // Exit conveyor + guide rails
  add(B(2.7, 0.1, 0.4), steel, 2.35, 0.86, 0, group, "conveyor");
  add(B(2.7, 0.03, 0.34), belt, 2.35, 0.935, 0, group, "conveyor");
  for (const z of [-0.2, 0.2]) add(B(2.7, 0.12, 0.03), steel, 2.35, 1.02, z, group, "conveyor");
  for (const x of [1.3, 3.3]) {
    for (const z of [-0.17, 0.17]) add(B(0.05, 0.8, 0.05), steel, x, 0.4, z, group, "conveyor");
  }

  const cb: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    cb.push(makeBottle(pal[i % 5], group, 1, 0.95, 0));
  }

  // Bulk elevator (incline) + hopper + discharge chute
  const ea = 0.6;
  const ex0 = -2.8;
  const ey0 = 0.3;
  const el = 2.12;

  function inc(
    w: number,
    h: number,
    d: number,
    s: number,
    o: number,
    z: number,
    m: THREE.Material,
  ) {
    const b = add(
      B(w, h, d),
      m,
      ex0 + Math.cos(ea) * s - Math.sin(ea) * o,
      ey0 + Math.sin(ea) * s + Math.cos(ea) * o,
      z,
      group,
      "body",
    );
    b.rotation.z = ea;
    return b;
  }

  inc(el, 0.05, 0.46, el / 2, 0, 0, belt);
  for (const z of [-0.25, 0.25]) inc(el, 0.16, 0.03, el / 2, 0.06, z, steel);
  const cl: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) cl.push(inc(0.04, 0.08, 0.44, 0, 0.06, 0, steel));

  for (const z of [-0.22, 0.22]) {
    add(B(0.06, 0.64, 0.06), steel, -2.3, 0.32, z, group, "body");
    add(B(0.06, 1.22, 0.06), steel, -1.4, 0.61, z, group, "body");
  }
  add(B(0.04, 0.45, 0.6), steel, -3.0, 0.52, 0, group, "body");
  for (const z of [-0.3, 0.3]) add(B(0.55, 0.45, 0.04), steel, -2.72, 0.52, z, group, "body");
  const chute = add(B(0.55, 0.03, 0.4), steel, -0.85, 1.42, 0, group, "body");
  chute.rotation.z = -0.5;

  // HMI on pole
  cylY(0.03, 1.4, 1.15, 0.7, 1.15, steel, group, "hmi");
  const hg = new THREE.Group();
  tagPart(hg, "hmi");
  hg.position.set(1.15, 1.45, 1.15);
  hg.rotation.y = -0.6;
  group.add(hg);
  add(B(0.42, 0.3, 0.05), dark, 0, 0, 0, hg, "hmi");
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), scrMat);
  scr.position.z = 0.028;
  tagPart(scr, "hmi");
  hg.add(scr);

  // Stack light (added per spec)
  const lamps = createStackLight(0.4, 0.06, 0.1);
  lamps.group.position.set(-0.7, 1.4, -0.7);
  group.add(lamps.group);

  applyLOD(group, lod);

  let localT = rng() * 10;
  let bp = 0;
  let es = 0;

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

      tbl.rotation.y -= effDt * 0.6;
      bp += effDt * 0.5;
      es += effDt * 0.6;

      cb.forEach((b, i) => {
        b.position.x = 1.05 + ((bp + i * 0.52) % 2.6);
      });
      cl.forEach((c, i) => {
        const s = (es + (i * el) / 8) % el;
        c.position.set(
          ex0 + Math.cos(ea) * s - Math.sin(ea) * 0.06,
          ey0 + Math.sin(ea) * s + Math.cos(ea) * 0.06,
          0,
        );
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
