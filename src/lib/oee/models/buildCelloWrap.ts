import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildCelloWrap(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 107);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "CelloWrappingMachine";

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
    const g = new THREE.CylinderGeometry(r, r, h, 24);
    g.rotateX(Math.PI / 2);
    const s = new THREE.Mesh(g, m);
    s.position.set(x, y, z);
    tagPart(s, part);
    (p || group).add(s);
    return s;
  };
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

  const steel = M(0xb9c2cf, { metalness: 0.7, roughness: 0.35 });
  const dark = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  const blue = M(0x1c5fd4, { metalness: 0.3 });
  const rail = M(0x4a5566);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: lod >= 1,
    opacity: 0.22,
    roughness: 0.05,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Roller conveyors
  const rollers: THREE.Mesh[] = [];
  for (const cx of [-6.5, 9]) {
    for (let i = 0; i < 7; i++) {
      rollers.push(cylZ(0.12, 1.5, cx - 3 + i, 0.9, 0, M(0x9aa5b4), group, "conveyor"));
    }
    for (const z of [-0.85, 0.85]) add(B(7, 0.25, 0.1), rail, cx, 0.85, z, group, "conveyor");
    for (const x of [-3, 0, 3]) {
      for (const z of [-0.8, 0.8]) add(B(0.12, 0.8, 0.12), rail, cx + x, 0.4, z, group, "conveyor");
    }
  }

  // Machine body, bed, frame, guards
  add(B(6.4, 0.7, 2.4), M(0xdfe5ee, { metalness: 0.2 }), 0, 0.35, 0, group, "body");
  add(B(9.2, 0.06, 1.0), steel, 1.4, 0.96, 0, group, "body");
  add(B(3.2, 0.7, 1.8), M(0xdfe5ee, { metalness: 0.2 }), 4.6, 0.35, 0, group, "body");

  for (const x of [-3.1, 3.1]) {
    for (const z of [-1.3, 1.3]) add(B(0.25, 3.6, 0.25), blue, x, 1.8, z, group, "body");
  }
  for (const z of [-1.3, 1.3]) add(B(6.5, 0.25, 0.25), blue, 0, 3.6, z, group, "body");
  for (const x of [-3.1, 0, 3.1]) add(B(0.25, 0.25, 2.6), blue, x, 3.6, 0, group, "body");
  for (const z of [-1.3, 1.3]) {
    add(
      B(6.2, 2.3, 0.03),
      M(0x9fd4ff, {
        transparent: lod >= 1,
        opacity: 0.12,
        depthWrite: false,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      0,
      2.35,
      z,
      group,
      "guard",
    );
  }

  // Film reel stand
  add(B(0.5, 5.7, 0.5), blue, -2.4, 2.85, -2.0, group, "body");
  cylZ(0.14, 1.5, -2.4, 4.7, -1.3, steel, group, "body");
  cylZ(
    0.9,
    0.9,
    -2.4,
    4.7,
    -1.1,
    M(0xcfe8f5, { transparent: lod >= 1, opacity: 0.6, metalness: 0, roughness: 0.2 }),
    group,
    "body",
  );
  cylZ(0.3, 1.0, -2.4, 4.7, -1.1, M(0xf2f2f2, { metalness: 0.1 }), group, "body");
  const reel = cylZ(0.05, 1.0, -2.4, 4.7, -1.1, M(0x888888), group, "body");
  cylZ(0.1, 1.7, -1.4, 3.95, -0.3, steel, group, "body");
  cylZ(0.1, 1.7, -1.4, 2.75, -0.3, steel, group, "body");

  const web = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), glass);
  tagPart(web, "body");
  web.position.set(-1.4, 3.35, -0.3);
  web.rotation.y = Math.PI / 2;
  group.add(web);

  // Film former + fold plates
  add(B(1.5, 0.5, 1.5), M(0xd2d8e2), -1.4, 2.2, 0, group, "body");
  for (const s of [-1, 1]) {
    const p = add(B(1.5, 0.05, 0.5), steel, -0.6, 1.55, s * 0.62, group, "body");
    p.rotation.x = s * 0.6;
  }
  add(B(0.4, 0.7, 0.4), M(0x8a95a5), -1.4, 2.75, 0, group, "body");

  // End sealer jaws
  const jaw = new THREE.Group();
  tagPart(jaw, "body");
  jaw.position.set(2.0, 2.15, 0);
  group.add(jaw);
  add(B(0.5, 0.35, 1.3), steel, 0, 0, 0, jaw, "body");
  add(
    B(0.5, 0.06, 1.3),
    M(0xff7a1a, { emissive: 0xff5500, emissiveIntensity: 0.5 }),
    0,
    -0.2,
    0,
    jaw,
    "body",
  );
  add(B(0.2, 1.0, 0.2), M(0x8a95a5), 0, 0.7, 0, jaw, "body");
  add(
    B(0.5, 0.2, 1.3),
    M(0xff7a1a, { emissive: 0xff5500, emissiveIntensity: 0.5 }),
    2.0,
    0.8,
    0,
    group,
    "body",
  );

  // Side belts + hot plates
  for (const s of [-1, 1]) {
    add(B(9, 0.5, 0.1), dark, 1.5, 1.3, s * 0.55, group, "body");
    add(
      B(2.6, 0.35, 0.12),
      M(0xff7a1a, { emissive: 0xff5500, emissiveIntensity: 0.35 }),
      4.6,
      1.3,
      s * 0.75,
      group,
      "body",
    );
    add(B(0.3, 1.6, 0.3), rail, 6.4, 0.8, s * 1.0, group, "body");
  }

  const lugs: { m: THREE.Mesh; i: number }[] = [];
  for (let i = 0; i < 8; i++) {
    for (const s of [-1, 1]) {
      lugs.push({
        m: add(
          B(0.25, 0.4, 0.06),
          M(0xf2a516, { metalness: 0.1 }),
          0,
          1.3,
          s * 0.49,
          group,
          "body",
        ),
        i,
      });
    }
  }

  // HMI
  cylY(0.08, 2, -3.7, 1, 2.0, M(0x5b6675), group, "hmi");
  const hmi = add(B(0.9, 0.6, 0.08), M(0x2a3444), -3.7, 2.2, 2.0, group, "hmi");
  hmi.rotation.x = -0.25;
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.45), scrMat);
  scr.position.z = 0.05;
  tagPart(scr, "hmi");
  hmi.add(scr);

  // Stack light
  const lamps = createStackLight(0.5, 0.16, 0.3);
  lamps.group.position.set(3.1, 3.8, -1.3);
  group.add(lamps.group);

  // Products
  const pal = [0xe63946, 0x2a9d8f, 0x1d8ed6, 0x6a4c93, 0xf2a516];
  const N = 8;
  const L = 22;
  const X0 = -10;
  const prods: { g: THREE.Group; body: THREE.Mesh; shell: THREE.Group; fins: THREE.Group }[] = [];
  const edge = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });

  for (let i = 0; i < N; i++) {
    const pg = new THREE.Group();
    tagPart(pg, "product");
    const pBody = add(
      B(1.2, 0.9, 0.8),
      M(pal[i % 5], { metalness: 0.05, roughness: 0.6 }),
      0,
      0.45,
      0,
      pg,
      "product",
    );
    const lab = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    lab.position.set(0, 0.5, 0.401);
    tagPart(lab, "product");
    pg.add(lab);

    const shell = new THREE.Group();
    tagPart(shell, "product");
    pg.add(shell);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, 0.9), glass);
    sh.position.y = 0.5;
    tagPart(sh, "product");
    shell.add(sh);

    const ln = new THREE.LineSegments(new THREE.EdgesGeometry(sh.geometry), edge);
    ln.position.copy(sh.position);
    tagPart(ln, "product");
    shell.add(ln);

    const fins = new THREE.Group();
    tagPart(fins, "product");
    pg.add(fins);
    for (const s of [-1, 1]) {
      add(B(0.16, 0.6, 0.5), glass, s * 0.72, 0.5, 0, fins, "product");
    }

    pg.position.set(X0 + (i * L) / N, 1.02, 0);
    group.add(pg);
    prods.push({ g: pg, body: pBody, shell, fins });
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

      for (const p of prods) {
        p.g.position.x += v * effDt;
        if (p.g.position.x > X0 + L) {
          p.g.position.x -= L;
          (p.body.material as THREE.MeshStandardMaterial).color.setHex(pal[Math.floor(rng() * 5)]);
        }
        const x = p.g.position.x;
        p.shell.visible = x > -0.5;
        p.shell.scale.set(1, 1, Math.min(1, Math.max(0.6, 0.6 + ((x + 0.5) / 1.5) * 0.4)));
        const k = Math.min(1, Math.max(0, (x - 2.1) / 0.9));
        p.fins.visible = x > 2.1;
        p.fins.scale.set(k, 1, 1);
      }

      for (const r of rollers) r.rotation.z -= (v * effDt) / 0.12;
      for (const l of lugs) l.m.position.x = -3 + ((bp + l.i * 1.125) % 9);
      reel.rotation.z -= v * effDt * 0.4;
      jaw.position.y = 2.15 - 0.12 * (0.5 + 0.5 * Math.sin(localT * 4));
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
