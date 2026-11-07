import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildTubeRepack(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 108);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "TubeRepackMachine";

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
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m);
    s.position.set(x, y, z);
    tagPart(s, part);
    (p || group).add(s);
    return s;
  };
  const cone = (
    rt: number,
    rb: number,
    h: number,
    z: number,
    m: THREE.Material,
    p: THREE.Object3D,
  ) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 18);
    g.rotateX(Math.PI / 2);
    const s = new THREE.Mesh(g, m);
    s.position.set(0, 0, z);
    tagPart(s, "product");
    p.add(s);
    return s;
  };

  const ss = (a: number, b: number, p: number) => {
    const k = Math.min(1, Math.max(0, (p - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };

  const steel = M(0xb9c2cf, { metalness: 0.7, roughness: 0.35 });
  const dark = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  const blue = M(0x1c5fd4, { metalness: 0.3 });
  const rail = M(0x4a5566);
  const lite = M(0xdfe5ee, { metalness: 0.2 });

  const tubeM = M(0x2a9d8f, { metalness: 0.05, roughness: 0.35 });
  const capM = M(0xf4f4f4, { metalness: 0.05 });
  const tailM = M(0xd6dbe3, { metalness: 0.6, roughness: 0.3 });

  function makeTube() {
    const tg = new THREE.Group();
    tagPart(tg, "product");
    cone(0.16, 0.16, 0.8, -0.08, tubeM, tg);
    cone(0.07, 0.16, 0.16, 0.4, capM, tg);
    cone(0.08, 0.08, 0.14, 0.55, capM, tg);
    add(B(0.32, 0.03, 0.14), tailM, 0, 0, -0.55, tg, "product");
    return tg;
  }

  // Tube infeed conveyor z=+1.6
  add(B(12.6, 0.12, 1.5), dark, -4.7, 0.94, 1.6, group, "conveyor");
  for (const s of [-1, 1])
    add(B(12.6, 0.3, 0.06), steel, -4.7, 1.15, 1.6 + s * 0.78, group, "conveyor");
  for (let i = 0; i < 8; i++) {
    for (const s of [-1, 1])
      add(B(0.12, 0.9, 0.12), rail, -10.5 + i * 1.7, 0.45, 1.6 + s * 0.7, group, "conveyor");
  }
  add(B(0.1, 0.45, 1.4), M(0xd22e2e), 1.3, 1.25, 1.6, group, "body");

  // Carton conveyor z=-1.6
  add(B(24, 0.12, 1.7), dark, 0, 0.94, -1.6, group, "conveyor");
  for (const s of [-1, 1])
    add(B(24, 0.25, 0.06), steel, 0, 1.1, -1.6 + s * 0.92, group, "conveyor");
  for (let i = 0; i < 14; i++) {
    for (const s of [-1, 1])
      add(B(0.12, 0.9, 0.12), rail, -11 + i * 1.7, 0.45, -1.6 + s * 0.8, group, "conveyor");
  }

  // Filler outlet hopper + chute
  add(B(1.8, 1.9, 1.9), M(0x6a7482), -12.9, 1.95, 1.6, group, "body");
  add(B(1.85, 0.3, 1.95), M(0xff7a1a), -12.9, 2.7, 1.6, group, "body");
  const ch = add(B(2.6, 0.12, 1.4), steel, -11.6, 1.55, 1.6, group, "body");
  ch.rotation.z = -0.3;

  // Carton magazine
  add(B(2.2, 1.9, 1.7), lite, -12.4, 1.95, -1.6, group, "body");
  for (let i = 0; i < 5; i++)
    add(B(2.25, 0.05, 1.75), rail, -12.4, 1.2 + i * 0.35, -1.6, group, "body");

  // Cage frame + guards
  for (const x of [-3.2, 3.2]) {
    for (const z of [-3.6, 3.6]) add(B(0.25, 4.4, 0.25), blue, x, 2.2, z, group, "body");
  }
  for (const z of [-3.6, 3.6]) add(B(6.6, 0.25, 0.25), blue, 0, 4.4, z, group, "body");
  for (const x of [-3.2, 3.2]) add(B(0.25, 0.25, 7.4), blue, x, 4.4, 0, group, "body");
  for (const z of [-3.6, 3.6]) {
    add(
      B(6.4, 2.5, 0.03),
      M(0x9fd4ff, {
        transparent: lod >= 1,
        opacity: 0.12,
        depthWrite: false,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      0,
      2.4,
      z,
      group,
      "guard",
    );
  }
  add(B(0.4, 0.35, 7.4), M(0x9aa5b4), 0, 4.4, 0, group, "body");

  // Closing arch
  for (const z of [-2.8, -0.4]) add(B(0.3, 2.4, 0.3), blue, 7.5, 1.2, z, group, "body");
  add(B(0.3, 0.3, 2.7), blue, 7.5, 2.5, -1.6, group, "body");
  for (const s of [-1, 1]) {
    const f = add(B(1.8, 0.05, 0.5), steel, 7.5, 2.0, -1.6 + s * 0.6, group, "body");
    f.rotation.x = s * 0.5;
  }

  // Gantry Head
  const headG = new THREE.Group();
  tagPart(headG, "body");
  group.add(headG);
  add(B(2.3, 0.12, 1.15), steel, 0, 0, 0, headG, "body");
  for (let k = 0; k < 6; k++)
    cylY(0.08, 0.2, (k - 2.5) * 0.34, -0.16, 0, M(0x222831), headG, "body");

  const carry = new THREE.Group();
  tagPart(carry, "product");
  carry.position.y = -0.42;
  headG.add(carry);
  for (let k = 0; k < 6; k++) {
    const t = makeTube();
    t.position.x = (k - 2.5) * 0.34;
    carry.add(t);
  }

  const car = add(B(0.8, 0.5, 1.0), M(0xd22e2e), 0, 4.4, 0, group, "body");
  const col = cylY(0.1, 1, 0, 3, 0, steel, group, "body");

  // HMI
  cylY(0.08, 2, 4.6, 1, 3.0, M(0x5b6675), group, "hmi");
  const hmi = add(B(0.9, 0.6, 0.08), M(0x2a3444), 4.6, 2.2, 3.0, group, "hmi");
  hmi.rotation.x = -0.25;
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.45), scrMat);
  scr.position.z = 0.05;
  tagPart(scr, "hmi");
  hmi.add(scr);

  // Stack light
  const lamps = createStackLight(0.5, 0.16, 0.3);
  lamps.group.position.set(3.2, 4.5, 3.6);
  group.add(lamps.group);

  // Infeed tubes
  const PT = 0.34;
  const NB = 32;
  const W = NB * PT;
  const bt: { g: THREE.Group; i: number; lm: number; picked: boolean }[] = [];
  for (let i = 0; i < NB; i++) {
    const tg = makeTube();
    tg.position.set(0, 1.16, 1.6);
    group.add(tg);
    bt.push({ g: tg, i, lm: 0, picked: false });
  }

  // Cartons with 4 layers x 6 tubes
  const kraft = M(0xc9a06b, { metalness: 0.02, roughness: 0.85 });
  const cts: { g: THREE.Group; layers: THREE.Group[]; n: number; lm: number; i: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const cg = new THREE.Group();
    tagPart(cg, "product");
    add(B(2.4, 0.05, 1.5), kraft, 0, 0.025, 0, cg, "product");
    for (const s of [-1, 1]) {
      add(B(2.4, 1.4, 0.06), kraft, 0, 0.7, s * 0.72, cg, "product");
      add(B(0.06, 1.4, 1.5), kraft, s * 1.17, 0.7, 0, cg, "product");
    }
    const layers = [0, 1, 2, 3].map((L) => {
      const lg = new THREE.Group();
      tagPart(lg, "product");
      lg.position.y = 0.22 + L * 0.34;
      cg.add(lg);
      for (let k = 0; k < 6; k++) {
        const t = makeTube();
        t.position.x = (k - 2.5) * 0.34;
        lg.add(t);
      }
      return lg;
    });
    cg.position.set(0, 1.0, -1.6);
    group.add(cg);
    cts.push({ g: cg, layers, n: i === 3 ? 4 : 0, lm: 0, i });
  }

  applyLOD(group, lod);

  const UP = 3.4;
  const YPICK = 1.58;
  let localT = rng() * 10;
  let lp = -1;
  let placeY = 1.64;

  const nearest = () =>
    cts.reduce((a, c) => (Math.abs(c.g.position.x) < Math.abs(a.g.position.x) ? c : a));

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

      const cyc = Math.floor(localT / 6);
      const p = localT - cyc * 6;
      if (p < lp) lp = -1;
      if (lp < 0.6 && p >= 0.6) {
        for (const b of bt) {
          if (b.g.position.x > -0.9) b.picked = true;
        }
      }
      if (lp < 1.5 && p >= 1.5) placeY = 1.64 + Math.min(nearest().n, 3) * 0.34;
      if (lp < 3.6 && p >= 3.6) {
        const c = nearest();
        c.n = Math.min(4, c.n + 1);
      }
      lp = p;

      const yh =
        UP -
        (UP - YPICK) * (ss(0, 0.6, p) - ss(0.9, 1.5, p)) -
        (UP - placeY) * (ss(3, 3.6, p) - ss(3.9, 4.5, p));
      const zh = 1.6 - 3.2 * ss(1.5, 3, p) + 3.2 * ss(4.5, 6, p);
      headG.position.set(0, yh, zh);
      car.position.z = zh;
      carry.visible = p >= 0.6 && p < 3.6;

      const top2 = 4.2;
      const len = top2 - (yh + 0.06);
      col.scale.y = len;
      col.position.set(0, (top2 + yh + 0.06) / 2, zh);

      const bs = 2.04 * (cyc + ss(4.6, 5.6, p));
      for (const b of bt) {
        const m = (b.i * PT + bs) % W;
        if (m < b.lm - 1e-6) b.picked = false;
        b.lm = m;
        b.g.position.x = m - 9.69;
        b.g.visible = !b.picked;
      }

      const co = 5 * (Math.floor(cyc / 4) + (cyc % 4 === 3 ? ss(4.6, 5.6, p) : 0));
      for (const c of cts) {
        const m = (c.i * 5 + co) % 20;
        if (m < c.lm - 1e-6) c.n = 0;
        c.lm = m;
        c.g.position.x = m - 10;
        c.layers.forEach((l, idx) => {
          l.visible = c.n > idx;
        });
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
