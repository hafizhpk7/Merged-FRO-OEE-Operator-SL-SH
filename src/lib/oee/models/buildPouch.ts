import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildPouch(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 111);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "PouchPackingMachine";

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
  const cylX = (
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: THREE.Material,
    p?: THREE.Object3D,
    part: "body" | "guard" | "conveyor" | "product" | "floor" | "hmi" | "lamps" = "body",
  ) => {
    const g = new THREE.CylinderGeometry(r, r, h, 40);
    g.rotateZ(Math.PI / 2);
    const s = new THREE.Mesh(g, m);
    s.position.set(x, y, z);
    tagPart(s, part);
    (p || group).add(s);
    return s;
  };

  const ss = (a: number, b: number, p: number) => {
    const k = Math.min(1, Math.max(0, (p - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };

  const steel = M(0xd5d9de, { metalness: 0.4, roughness: 0.4 });
  const dark = M(0x333840, { metalness: 0.1, roughness: 0.8 });
  const blue = M(0x1f5fa8);
  const blue2 = M(0x174c86);
  const lite = M(0xeceff2, { metalness: 0.1 });
  const film = M(0xaebfcf, { metalness: 0.3, roughness: 0.25 });
  const redMat = M(0xd6533a, { emissive: 0x5a1a10 });

  // Frame & legs
  for (const x of [-0.74, 0.74]) {
    for (const z of [-0.48, 0]) {
      add(B(0.08, 1.2, 0.08), steel, x, 0.6, z, group, "body");
      add(B(0.14, 0.03, 0.14), dark, x, 0.015, z, group, "body");
    }
  }
  add(B(1.5, 0.05, 0.05), steel, 0, 0.45, -0.48, group, "body");
  add(B(1.5, 0.05, 0.05), steel, 0, 0.45, 0, group, "body");
  for (const x of [-0.74, 0.74]) add(B(0.05, 0.05, 0.48), steel, x, 0.45, -0.24, group, "body");

  // Body, door, control cabinet
  add(B(1.6, 1.4, 0.6), blue, 0, 1.9, -0.25, group, "body");
  add(B(1.4, 1.2, 0.01), blue2, 0, 1.9, 0.055, group, "body");
  add(B(0.04, 0.3, 0.04), steel, 0.6, 1.9, 0.08, group, "body");
  add(B(0.5, 1.4, 0.6), steel, -1.15, 0.7, -0.25, group, "body");
  add(B(0.44, 1.3, 0.01), lite, -1.15, 0.7, 0.055, group, "body");
  add(B(0.03, 0.25, 0.03), dark, -0.98, 0.7, 0.075, group, "body");

  // Film reel
  const reel = cylX(0.45, 0.45, 0, 2.2, -1.05, film, group, "body");
  add(B(0.47, 0.06, 0.06), dark, 0, 0.3, 0, reel, "body");
  cylX(0.15, 0.5, 0, 2.2, -1.05, dark, group, "body");
  for (const x of [-0.235, 0.235]) cylX(0.48, 0.02, x, 2.2, -1.05, steel, group, "body");
  for (const x of [-0.28, 0.28]) add(B(0.06, 0.06, 0.5), steel, x, 2.2, -0.8, group, "body");

  // Film path, dancer rollers
  add(B(0.42, 0.006, 1.35), film, 0, 2.62, -0.375, group, "body");
  add(B(0.42, 0.17, 0.006), film, 0, 2.535, 0.3, group, "body");
  cylX(0.05, 0.5, 0, 2.05, 0.11, steel, group, "body");
  cylX(0.05, 0.5, 0, 1.75, 0.11, steel, group, "body");

  // Forming collar, tube, hopper
  cylY(0.14, 0.3, 0, 2.55, 0.3, steel, group, "body");
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.14, 0.3, 32), steel);
  col.position.set(0, 2.3, 0.3);
  tagPart(col, "body");
  group.add(col);

  cylY(0.14, 0.85, 0, 1.725, 0.3, steel, group, "body");
  const fun = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.14, 0.5, 32), steel);
  fun.position.set(0, 2.95, 0.3);
  tagPart(fun, "body");
  group.add(fun);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.02, 8, 48), dark);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 3.2, 0.3);
  tagPart(rim, "body");
  group.add(rim);

  add(B(0.1, 0.7, 0.1), steel, 0, 2.95, -0.25, group, "body");
  add(B(0.08, 0.08, 0.7), steel, 0, 3.1, 0.05, group, "body");

  // Sealing jaws
  const jb = add(B(0.55, 0.12, 0.08), redMat, 0, 1.4, 0.12, group, "body");
  const jf = add(B(0.55, 0.12, 0.08), redMat, 0, 1.4, 0.48, group, "body");
  for (const x of [-0.35, 0.35]) add(B(0.06, 0.06, 0.5), steel, x, 1.4, 0.3, group, "body");

  // Outfeed chute, side rails, bin
  const ch = add(B(0.6, 0.03, 0.9), steel, 0, 0.62, 0.55, group, "conveyor");
  ch.rotation.x = 0.45;
  for (const x of [-0.3, 0.3]) {
    const r = add(B(0.02, 0.08, 0.9), steel, x, 0.665, 0.572, group, "conveyor");
    r.rotation.x = 0.45;
  }
  const bm = M(0x555b64);
  add(B(0.8, 0.04, 0.6), bm, 0, 0.02, 1.3, group, "conveyor");
  add(B(0.8, 0.3, 0.04), bm, 0, 0.17, 1.6, group, "conveyor");
  for (const x of [-0.4, 0.4]) add(B(0.04, 0.3, 0.6), bm, x, 0.17, 1.3, group, "conveyor");

  // HMI on pole
  cylY(0.03, 1.6, 1.15, 0.8, 0.3, steel, group, "hmi");
  const hg = new THREE.Group();
  tagPart(hg, "hmi");
  hg.position.set(1.15, 1.65, 0.3);
  hg.rotation.y = -0.45;
  group.add(hg);
  add(B(0.42, 0.3, 0.05), dark, 0, 0, 0, hg, "hmi");
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), scrMat);
  scr.position.z = 0.028;
  tagPart(scr, "hmi");
  hg.add(scr);

  // Stack light (added per spec)
  const lamps = createStackLight(0.4, 0.06, 0.1);
  lamps.group.position.set(-0.7, 2.6, -0.25);
  group.add(lamps.group);

  // Pouches
  const pcol = [0xf5c16c, 0x7fc8a9, 0xe88a9c];
  const pouches: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const pg = new THREE.Group();
    tagPart(pg, "product");
    const m = M(pcol[i], { metalness: 0, roughness: 0.6 });
    const sm = M(pcol[i], {
      metalness: 0,
      roughness: 0.6,
      color: new THREE.Color(pcol[i]).multiplyScalar(0.8),
    });
    add(B(0.32, 0.4, 0.05), m, 0, 0, 0, pg, "product");
    add(B(0.33, 0.04, 0.055), sm, 0, 0.2, 0, pg, "product");
    add(B(0.33, 0.04, 0.055), sm, 0, -0.2, 0, pg, "product");
    group.add(pg);
    pouches.push(pg);
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

      let c = 0;
      pouches.forEach((g, i) => {
        const q = (localT / 3 + i / 3) % 1;
        g.visible = q < 0.92;
        if (q < 0.3) {
          g.position.set(0, 1.2, 0.3);
          g.rotation.x = 0;
          c = Math.max(c, ss(0, 0.06, q) - ss(0.2, 0.3, q));
        } else if (q < 0.45) {
          const f = ss(0.3, 0.45, q);
          g.position.set(0, 1.2 + (0.79 - 1.2) * f, 0.3);
          g.rotation.x = -1.1208 * f;
        } else {
          const s = -0.3 + (0.75 * (q - 0.45)) / 0.47;
          g.position.set(0, 0.62 - 0.435 * s + 0.04, 0.55 + 0.9 * s + 0.02);
          g.rotation.x = -1.1208;
        }
      });

      jb.position.z = 0.12 + 0.05 * c;
      jf.position.z = 0.48 - 0.05 * c;
      redMat.emissiveIntensity = 0.3 + 1.6 * c;

      reel.rotation.x -= effDt * 0.4;
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
