import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildCartoning(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 106);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "CartoningAndCheckWeigher";

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
  const C = (a: number, b: number, h: number, s = 24) => new THREE.CylinderGeometry(a, b, h, s);

  // Floor
  const flGeo = new THREE.CircleGeometry(7, 48);
  const fl = add(flGeo, M(0x888882, { transparent: true, opacity: 0.25 }), 0, 0, 0, group, "floor");
  fl.rotation.x = -Math.PI / 2;

  // Conveyor & Legs
  add(B(8, 0.08, 0.9), M(0x2b2e33, { roughness: 0.8 }), 0, 0.96, 0, group, "conveyor");
  [-0.5, 0.5].forEach((z) => {
    add(B(8, 0.14, 0.05), M(0xb9bec6), 0, 1.06, z, group, "conveyor");
  });
  [-3.6, -1.2, 0, 3.6].forEach((x) => {
    [-0.4, 0.4].forEach((z) => {
      add(B(0.07, 0.92, 0.07), M(0x8d939c), x, 0.46, z, group, "conveyor");
    });
  });

  // Cartoner Cabinet
  const kraft = M(0xc99a5b, { roughness: 0.8, metalness: 0.05 });
  const flap = M(0x9c7440, { roughness: 0.8, metalness: 0.05 });
  add(B(1.4, 1.8, 1.0), M(0x0f5f8a), -2.2, 0.9, -1.2, group, "body");
  add(B(1.46, 0.05, 1.06), M(0xc9ced6), -2.2, 1.82, -1.2, group, "body");
  for (let s = 0; s < 6; s++) {
    add(B(0.6, 0.06, 0.45), kraft, -2.2, 1.88 + s * 0.07, -1.2, group, "body");
  }
  [-0.32, 0.32].forEach((dx) => {
    add(B(0.03, 0.5, 0.03), M(0x8d939c), -2.2 + dx, 2.1, -1.42, group, "body");
    add(B(0.03, 0.5, 0.03), M(0x8d939c), -2.2 + dx, 2.1, -0.98, group, "body");
  });

  // Product Pusher
  const prod = add(
    C(0.04, 0.04, 0.6),
    M(0xd5d9de, { metalness: 0.7 }),
    -2.2,
    1.15,
    -0.95,
    group,
    "body",
  );
  prod.rotation.x = Math.PI / 2;
  const phead = add(B(0.22, 0.22, 0.03), M(0x333840), -2.2, 1.15, -0.65, group, "body");

  // HMI
  add(B(0.36, 0.26, 0.03), M(0x111418), -1.75, 1.3, -0.69, group, "hmi");
  const scrMat = new THREE.MeshStandardMaterial({
    color: 0x2ecc71,
    emissive: 0x2ecc71,
    emissiveIntensity: 0.6,
  });
  const scr = add(B(0.3, 0.2, 0.005), scrMat, -1.75, 1.3, -0.67, group, "hmi");

  // Checkweigher Platform & Display
  add(B(1.2, 0.09, 0.9), M(0x3a8f6a), 1.5, 0.962, 0, group, "body");
  add(B(0.5, 0.25, 0.5), M(0xb9bec6), 1.5, 0.75, 0, group, "body");
  add(C(0.03, 0.03, 1.6, 12), M(0x8d939c), 1.5, 0.8, 0.75, group, "body");
  add(B(0.52, 0.34, 0.05), M(0x111418), 1.5, 1.6, 0.75, group, "hmi");
  const dsp = add(B(0.44, 0.26, 0.005), scrMat.clone(), 1.5, 1.6, 0.78, group, "hmi");

  // Sensor
  add(B(0.04, 0.25, 0.04), M(0x9aa0a8), 1.0, 1.12, 0.55, group, "body");
  add(B(0.09, 0.09, 0.09), M(0x19c2d6, { emissive: 0x0a7d8a }), 1.0, 1.28, 0.55, group, "body");

  // Reject Pusher & Bin
  add(B(0.22, 0.4, 0.22), M(0x8d939c), 2.6, 1.15, -0.85, group, "body");
  const rod = add(
    C(0.045, 0.045, 0.6),
    M(0xd5d9de, { metalness: 0.7 }),
    2.6,
    1.15,
    -0.9,
    group,
    "body",
  );
  rod.rotation.x = Math.PI / 2;
  const rhead = add(B(0.26, 0.22, 0.03), M(0xe24b4a), 2.6, 1.15, -0.6, group, "body");

  const wm = M(0x8d939c, { transparent: lod >= 1, opacity: 0.55 });
  add(B(0.8, 0.05, 0.6), M(0x555b64), 2.6, 0.55, 0.95, group, "body");
  add(B(0.8, 0.4, 0.04), wm, 2.6, 0.77, 1.25, group, "body");
  add(B(0.04, 0.4, 0.6), wm, 2.2, 0.77, 0.95, group, "body");
  add(B(0.04, 0.4, 0.6), wm, 3.0, 0.77, 0.95, group, "body");

  // Stack light
  const lamps = createStackLight(0.5, 0.08, 0.12);
  lamps.group.position.set(-1.7, 1.95, -1.35);
  group.add(lamps.group);

  // Cartons
  const cartons: {
    g: THREE.Group;
    x: number;
    w: boolean;
    ok: boolean;
    rej: boolean;
    rejT: number;
    rx: number;
  }[] = [];
  for (let i = 0; i < 8; i++) {
    const cg = new THREE.Group();
    tagPart(cg, "product");
    add(B(0.4, 0.3, 0.3), kraft, 0, 0, 0, cg, "product");
    add(B(0.41, 0.02, 0.12), flap, 0, 0.151, 0, cg, "product");
    cg.position.set(-4 + i, 1.15, 0);
    group.add(cg);
    cartons.push({ g: cg, x: -4 + i, w: false, ok: true, rej: false, rejT: 0, rx: 0 });
  }

  applyLOD(group, lod);

  let localT = rng() * 10;
  let flashEnd = 0;
  let lastOk = true;

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

      let act = 0;
      cartons.forEach((c) => {
        c.x += effDt * 0.9;
        if (c.x > 4) {
          c.x -= 8;
          c.w = false;
          c.ok = true;
          c.rej = false;
          c.rejT = 0;
        }
        if (!c.w && c.x > 1.5) {
          c.w = true;
          const wt = 247 + rng() * 8;
          c.ok = Math.abs(wt - 251) <= 3.5;
          lastOk = c.ok;
          flashEnd = localT + 1.2;
        }
        if (c.w && !c.ok && !c.rej && c.x > 2.6) {
          c.rej = true;
          c.rx = c.x;
        }
        if (c.rej && c.rejT < 1) {
          c.rejT = Math.min(1, c.rejT + effDt * 1.6);
        }
        if (c.rej && c.rejT < 1) act = Math.max(act, c.rejT);
        c.g.position.set(c.rej ? c.rx : c.x, 1.15 - c.rejT * 0.4, c.rejT * 0.95);
        c.g.visible = c.x > -2.2 && c.rejT < 1;
      });

      const ext = Math.pow(Math.max(0, Math.sin(localT * 3.5)), 2);
      phead.position.z = -0.65 + 0.45 * ext;
      prod.position.z = phead.position.z - 0.3;

      const rz = -0.6 + 0.6 * Math.min(1, act * 2);
      rhead.position.z = rz;
      rod.position.z = rz - 0.3;

      const dc =
        currentStatus === "down"
          ? 0xe24b4a
          : currentStatus === "idle"
            ? 0xf5a623
            : localT < flashEnd && !lastOk
              ? 0xe24b4a
              : 0x2ecc71;
      dsp.material.color.setHex(dc);
      dsp.material.emissive.setHex(dc);
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
