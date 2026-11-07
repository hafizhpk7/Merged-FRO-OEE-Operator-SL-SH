import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildCaseSealer(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 109);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "CaseSealerMachine";

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
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), m);
    s.position.set(x, y, z);
    tagPart(s, part);
    (p || group).add(s);
    return s;
  };
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
    const g = new THREE.CylinderGeometry(r, r, h, 24);
    g.rotateX(Math.PI / 2);
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

  const steel = M(0xb9c2cf, { metalness: 0.7, roughness: 0.35 });
  const dark = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  const blue = M(0x1c5fd4, { metalness: 0.3 });
  const rail = M(0x4a5566);
  const lite = M(0xdfe5ee, { metalness: 0.2 });
  const hot = M(0xe07b00);
  const red = M(0xd22e2e);
  const tapeRoll = M(0xe8dfc6, { metalness: 0.05, roughness: 0.4 });

  // Roller conveyors
  const rollers: THREE.Mesh[] = [];
  const rm = M(0x9aa5b4);
  for (const cx of [-7, 7]) {
    for (let i = 0; i < 8; i++)
      rollers.push(cylZ(0.12, 1.5, cx - 3.5 + i, 0.9, 0, rm, group, "conveyor"));
    for (const z of [-0.85, 0.85]) add(B(8, 0.25, 0.1), rail, cx, 0.85, z, group, "conveyor");
    for (const x of [-3.5, 0, 3.5]) {
      for (const z of [-0.8, 0.8]) add(B(0.12, 0.8, 0.12), rail, cx + x, 0.4, z, group, "conveyor");
    }
  }

  // Sealer chassis
  for (const x of [-3, 3]) {
    for (const z of [-1, 1]) {
      add(B(0.16, 0.95, 0.16), blue, x, 0.475, z, group, "body");
      add(B(0.34, 0.05, 0.34), rail, x, 0.025, z, group, "body");
    }
  }
  for (const z of [-1, 1]) {
    add(B(6.4, 0.55, 0.04), lite, 0, 0.55, z * 1.02, group, "body");
    add(B(6.4, 0.14, 0.14), blue, 0, 0.85, z, group, "body");
  }
  for (const z of [-0.35, 0.35]) add(B(7, 0.06, 0.4), steel, 0, 0.96, z, group, "body");

  // Bottom tape head
  add(B(1.3, 0.55, 0.9), hot, 0, 0.5, 0, group, "body");
  add(B(0.5, 0.1, 0.25), steel, 0, 0.95, 0, group, "body");
  cylZ(0.42, 0.3, 0, 0.45, 0.8, tapeRoll, group, "body");
  cylZ(0.08, 0.5, 0, 0.45, 0.8, rail, group, "body");

  // Upper frame, posts, guards
  for (const x of [-3.1, 3.1]) {
    for (const z of [-1.25, 1.25]) add(B(0.2, 3.5, 0.2), blue, x, 1.75, z, group, "body");
  }
  for (const z of [-1.25, 1.25]) add(B(6.4, 0.2, 0.2), blue, 0, 3.5, z, group, "body");
  for (const x of [-3.1, 3.1]) add(B(0.2, 0.2, 2.7), blue, x, 3.5, 0, group, "body");
  for (const z of [-1.3, 1.3]) {
    add(
      B(6, 2.2, 0.03),
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

  // Upper carriage
  add(B(0.4, 0.25, 2.7), rail, 0, 3.4, 0, group, "body");
  for (const z of [-1, 1]) cylY(0.07, 0.6, 0, 3.0, z, steel, group, "body");
  cylY(0.09, 0.15, 0, 3.6, 0, steel, group, "body");
  add(B(0.6, 0.05, 0.07), steel, 0, 3.7, 0, group, "body");
  add(B(0.07, 0.05, 0.6), steel, 0, 3.7, 0, group, "body");

  // Side drive belts
  const lugs: { m: THREE.Mesh; i: number }[] = [];
  for (const s of [-1, 1]) {
    add(B(6.4, 1.6, 0.08), lite, 0, 1.9, s * 0.97, group, "body");
    add(B(6.4, 0.5, 0.1), dark, 0, 1.62, s * 0.67, group, "body");
    add(B(0.9, 0.7, 0.45), M(0x5b6675), -2.7, 2.3, s * 1.15, group, "body");
    for (let i = 0; i < 8; i++) {
      lugs.push({
        m: add(
          B(0.3, 0.5, 0.05),
          M(0x6a7482, { metalness: 0.1 }),
          0,
          1.62,
          s * 0.62,
          group,
          "body",
        ),
        i,
      });
    }
  }

  // Top tape head
  add(B(0.35, 0.4, 0.35), rail, 0, 3.3, 0, group, "body");
  add(B(1.3, 0.9, 1.0), red, 0, 2.7, 0, group, "body");
  add(B(0.5, 0.08, 0.5), steel, 0, 2.24, 0, group, "body");
  const topRoll = cylZ(0.5, 0.35, 0, 2.95, -0.95, tapeRoll, group, "body");
  cylZ(0.1, 0.6, 0, 2.95, -0.95, rail, group, "body");

  // Flap plows
  add(B(0.15, 2.4, 0.15), rail, -4.4, 2.2, -1.0, group, "body");
  add(B(0.12, 0.12, 1.0), rail, -4.4, 2.0, -0.5, group, "body");
  const pb = add(B(1.0, 0.06, 0.06), steel, -4.0, 1.9, 0, group, "body");
  pb.rotation.z = -0.35;
  for (const s of [-1, 1]) {
    const p = add(B(1.6, 0.6, 0.04), steel, -1.6, 2.35, s * 0.81, group, "body");
    p.rotation.y = s * 0.23;
    add(B(0.1, 0.9, 0.1), rail, -2.2, 2.9, s * 1.0, group, "body");
    add(B(0.1, 0.9, 0.1), rail, -1.0, 2.9, s * 0.8, group, "body");
  }

  // HMI
  cylY(0.08, 2, 4.0, 1, 1.9, M(0x5b6675), group, "hmi");
  const hmi = add(B(0.9, 0.6, 0.08), M(0x2a3444), 4.0, 2.2, 1.9, group, "hmi");
  hmi.rotation.x = -0.25;
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.45), scrMat);
  scr.position.z = 0.05;
  tagPart(scr, "hmi");
  hmi.add(scr);

  // Stack light
  const lamps = createStackLight(0.5, 0.16, 0.3);
  lamps.group.position.set(3.1, 3.5, 1.25);
  group.add(lamps.group);

  // Master cartons
  const pal = [0xe63946, 0x2a9d8f, 0x1d8ed6, 0x6a4c93, 0xf2a516];
  const kraft = M(0xc9a06b, { metalness: 0.02, roughness: 0.85 });
  const flapM = M(0xd8b482, { metalness: 0.02, roughness: 0.85 });
  const tapeM = M(0xf6f0dc, { metalness: 0.05, roughness: 0.3 });
  const N = 6;
  const L = 22;
  const X0 = -11;
  const cts: {
    g: THREE.Group;
    lead: THREE.Group;
    trail: THREE.Group;
    maj: THREE.Group[];
    strip: THREE.Mesh;
    tf: THREE.Mesh;
    tr: THREE.Mesh;
    bf: THREE.Mesh;
    br: THREE.Mesh;
    bands: THREE.Mesh[];
  }[] = [];

  for (let i = 0; i < N; i++) {
    const cg = new THREE.Group();
    tagPart(cg, "product");
    add(B(1.8, 1.2, 1.2), kraft, 0, 0.6, 0, cg, "product");

    const bands: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const pnl = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 0.7),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      pnl.position.set(0, 0.65, s * 0.601);
      if (s < 0) pnl.rotation.y = Math.PI;
      tagPart(pnl, "product");
      cg.add(pnl);

      const bd = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 0.2),
        new THREE.MeshBasicMaterial({ color: pal[i % 5] }),
      );
      bd.position.set(0, 0.42, s * 0.602);
      if (s < 0) bd.rotation.y = Math.PI;
      tagPart(bd, "product");
      cg.add(bd);
      bands.push(bd);
    }

    const mkFlap = (px: number, pz: number, mx: number, mz: number, lx: number, lz: number) => {
      const p = new THREE.Group();
      tagPart(p, "product");
      p.position.set(px, 1.2, pz);
      cg.add(p);
      add(B(lx, 0.03, lz), flapM, mx, 0.005, mz, p, "product");
      return p;
    };

    const lead = mkFlap(0.9, 0, -0.3, 0, 0.6, 1.2);
    const trail = mkFlap(-0.9, 0, 0.3, 0, 0.6, 1.2);
    const maj = [-1, 1].map((s) => {
      const p = mkFlap(0, s * 0.6, 0, -s * 0.3, 1.8, 0.6);
      p.children[0].position.y = 0.03;
      return p;
    });

    const strip = add(B(1, 0.008, 0.12), tapeM, 0, 1.245, 0, cg, "product");
    const tf = add(B(0.008, 0.16, 0.12), tapeM, 0.904, 1.12, 0, cg, "product");
    const tr = add(B(0.008, 0.16, 0.12), tapeM, -0.904, 1.12, 0, cg, "product");
    const bf = add(B(0.008, 0.16, 0.12), tapeM, 0.904, 0.08, 0, cg, "product");
    const br = add(B(0.008, 0.16, 0.12), tapeM, -0.904, 0.08, 0, cg, "product");

    cg.position.set(X0 + (i * L) / N, 1.02, 0);
    group.add(cg);
    cts.push({ g: cg, lead, trail, maj, strip, tf, tr, bf, br, bands });
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
          const col = pal[Math.floor(rng() * 5)];
          c.bands.forEach((b) => (b.material as THREE.MeshBasicMaterial).color.setHex(col));
        }
        const x = c.g.position.x;
        c.lead.rotation.z = -1.9 * (1 - ss(-5.8, -4.8, x));
        c.trail.rotation.z = 1.9 * (1 - ss(-2.9, -2.0, x));
        const a = 1.9 * (1 - ss(-1.9, -0.8, x));
        c.maj[0].rotation.x = -a;
        c.maj[1].rotation.x = a;

        const len = Math.min(1.8, Math.max(0, x + 0.9));
        c.strip.visible = len > 0.03;
        c.strip.scale.x = Math.max(0.01, len);
        c.strip.position.x = 0.9 - len / 2;
        c.tf.visible = c.bf.visible = len > 0.12;
        c.tr.visible = c.br.visible = x - 0.9 > 0.5;
      }

      for (const r of rollers) r.rotation.z -= (v * effDt) / 0.12;
      for (const l of lugs) l.m.position.x = -3.1 + ((bp + l.i * 0.8) % 6.4);
      topRoll.rotation.z -= effDt * 0.8;
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
