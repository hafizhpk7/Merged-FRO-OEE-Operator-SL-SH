import * as THREE from "three";
import {
  applyLOD,
  createStackLight,
  makeSeededRng,
  tagPart,
  updateStatusVisuals,
} from "./materials";
import type { MachineStatus, ModelBuilderOptions, ModelInstance } from "./types";

export function buildBlister(options: ModelBuilderOptions = {}): ModelInstance {
  const lod = options.lod ?? 2;
  const rng = makeSeededRng(options.seed ?? 110);
  let currentStatus: MachineStatus = options.status ?? "running";

  const group = new THREE.Group();
  group.name = "BlisterPackMachine";

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
    const g = new THREE.CylinderGeometry(r, r, h, 28);
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
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xcfe8f5,
    transparent: lod >= 1,
    opacity: 0.32,
    roughness: 0.05,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pockM = new THREE.MeshPhysicalMaterial({
    color: 0xcfe8f5,
    transparent: lod >= 1,
    opacity: 0.5,
    roughness: 0.05,
    metalness: 0,
    depthWrite: false,
  });
  const foilM = M(0xdfe3ea, {
    transparent: lod >= 1,
    opacity: 0.7,
    metalness: 0.6,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });

  // Base cabinet & web rails
  add(B(12.2, 1.5, 2.2), lite, -0.7, 0.75, 0, group, "body");
  for (const z of [-0.8, 0.8]) add(B(13.6, 0.06, 0.06), steel, -0.5, 2.0, z, group, "body");
  for (const x of [-6.9, 5.1]) {
    for (const z of [-1.3, 1.3]) add(B(0.25, 4, 0.25), blue, x, 2, z, group, "body");
  }
  for (const z of [-1.3, 1.3]) add(B(12.2, 0.2, 0.2), blue, -0.9, 4, z, group, "body");
  for (const x of [-6.9, 5.1]) add(B(0.25, 0.2, 2.7), blue, x, 4, 0, group, "body");
  for (const z of [-1.32, 1.32]) {
    add(
      B(12, 2.3, 0.03),
      M(0x9fd4ff, {
        transparent: lod >= 1,
        opacity: 0.1,
        depthWrite: false,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      -0.9,
      2.75,
      z,
      group,
      "guard",
    );
  }

  // Reels
  function makeReel(x: number, y: number, r: number, len: number, m: THREE.Material) {
    const s = cylZ(r, len, x, y, 0, m, group, "body");
    add(B(r * 1.7, 0.08, 0.03), rail, 0, 0, len / 2 + 0.02, s, "body");
    cylZ(0.12, len + 0.3, 0, 0, 0, steel, s, "body");
    for (const z of [-1, 1]) {
      add(
        B(0.25, y + 0.2, 0.25),
        blue,
        x,
        (y + 0.2) / 2 - 0.1,
        z * (len / 2 + 0.35),
        group,
        "body",
      );
    }
    return s;
  }
  const rFilm = makeReel(
    -8.4,
    3.2,
    0.9,
    1.7,
    M(0xcfe8f5, { transparent: lod >= 1, opacity: 0.65, metalness: 0, roughness: 0.2 }),
  );
  const rFoil = makeReel(-0.9, 4.75, 0.7, 1.7, M(0xc8ccd4, { metalness: 0.9, roughness: 0.25 }));
  const rScrap = makeReel(
    5.7,
    3.4,
    0.55,
    1.7,
    M(0x9fc5dc, { transparent: lod >= 1, opacity: 0.7, metalness: 0 }),
  );
  add(B(0.3, 0.3, 2.7), blue, -8.4, 0.15, 0, group, "body");

  // Web paths
  const wp = add(B(1.0, 0.02, 1.45), glass, -7.95, 2.15, 0, group, "body");
  wp.rotation.z = -0.3;
  cylZ(0.1, 1.6, -7.5, 2.0, 0, steel, group, "body");
  add(B(0.012, 2.4, 1.5), foilM, -0.2, 3.45, 0, group, "body");
  cylZ(0.08, 1.6, -0.2, 2.25, 0, steel, group, "body");
  add(B(1.9, 0.012, 1.5), foilM, 0.75, 2.25, 0, group, "body");
  const sk = add(B(1.04, 0.02, 1.5), glass, 5.3, 2.42, 0, group, "body");
  sk.rotation.z = 0.955;

  // Stations
  const sts = [
    {
      x: -4.6,
      c: 0xff7a1a,
      dn: 2.42,
      f: (p: number) => ss(0.9, 1.2, p) - ss(2.6, 2.9, p),
      pl: null as THREE.Mesh | null,
      rod: null as THREE.Mesh | null,
    },
    {
      x: -2.8,
      c: 0x1c9fd6,
      dn: 2.42,
      f: (p: number) => ss(0.9, 1.2, p) - ss(1.7, 2, p),
      pl: null as THREE.Mesh | null,
      rod: null as THREE.Mesh | null,
    },
    {
      x: 0.8,
      c: 0xd22e2e,
      dn: 2.5,
      f: (p: number) => ss(1.2, 1.5, p) - ss(2.3, 2.6, p),
      pl: null as THREE.Mesh | null,
      rod: null as THREE.Mesh | null,
    },
    {
      x: 2.6,
      c: 0x2a4bd6,
      dn: 2.42,
      f: (p: number) => ss(1.2, 1.4, p) - ss(1.7, 1.9, p),
      pl: null as THREE.Mesh | null,
      rod: null as THREE.Mesh | null,
    },
    {
      x: 4.4,
      c: 0x777f8c,
      dn: 2.42,
      f: (p: number) => ss(1.5, 1.7, p) - ss(1.85, 2.05, p),
      pl: null as THREE.Mesh | null,
      rod: null as THREE.Mesh | null,
    },
  ];
  for (const s of sts) {
    const sm = M(s.c, { metalness: 0.3 });
    s.pl = add(B(1.6, 0.5, 1.5), sm, s.x, 2.95, 0, group, "body");
    s.rod = cylY(0.12, 1, s.x, 3.4, 0, steel, group, "body");
    add(B(1.6, 0.3, 1.5), sm, s.x, 1.65, 0, group, "body");
    add(B(0.3, 0.3, 2.7), rail, s.x, 3.9, 0, group, "body");
  }

  // Product Feeder
  cylY(0.5, 1, -1, 0.5, -2.6, rail, group, "body");
  cylY(0.85, 0.5, -1, 1.25, -2.6, M(0x6a7482), group, "body");
  cylY(0.75, 0.06, -1, 1.52, -2.6, steel, group, "body");
  const ch = add(B(0.5, 0.08, 2.1), steel, -1, 2.12, -1.6, group, "body");
  ch.rotation.x = -0.27;
  const brush = add(B(1.2, 0.5, 1.5), M(0x2a9d8f), -1, 2.55, 0, group, "body");

  // HMI
  cylY(0.08, 2, -3.6, 1, 2.1, M(0x5b6675), group, "hmi");
  const hmi = add(B(0.9, 0.6, 0.08), M(0x2a3444), -3.6, 2.2, 2.1, group, "hmi");
  hmi.rotation.x = -0.25;
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.45), scrMat);
  scr.position.z = 0.05;
  tagPart(scr, "hmi");
  hmi.add(scr);

  // Stack light
  const lamps = createStackLight(0.5, 0.16, 0.3);
  lamps.group.position.set(5.1, 4.0, 1.3);
  group.add(lamps.group);

  // Outfeed chute + conveyor
  const cp = add(B(1.35, 0.04, 1.6), steel, 6.8, 1.45, 0, group, "conveyor");
  cp.rotation.z = -0.605;
  add(B(7.4, 0.12, 1.7), dark, 9.9, 0.94, 0, group, "conveyor");
  for (const z of [-0.9, 0.9]) add(B(7.4, 0.25, 0.06), steel, 9.9, 1.1, z, group, "conveyor");
  for (let i = 0; i < 5; i++) {
    for (const z of [-0.8, 0.8])
      add(B(0.12, 0.9, 0.12), rail, 6.9 + i * 1.7, 0.45, z, group, "conveyor");
  }

  const ribs: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++)
    ribs.push(
      add(B(0.05, 0.02, 1.6), M(0x555c66, { metalness: 0.1 }), 0, 1.0, 0, group, "conveyor"),
    );

  // Blister cards
  const pal = [0xe63946, 0x2a9d8f, 0x1d8ed6, 0x6a4c93, 0xf2a516];
  function makeCard(col: number) {
    const cg = new THREE.Group();
    tagPart(cg, "product");
    const pk = new THREE.Group();
    tagPart(pk, "product");
    const pr = new THREE.Group();
    tagPart(pr, "product");
    const cd = new THREE.Group();
    tagPart(cd, "product");
    const pm = M(col, { metalness: 0.1, roughness: 0.4 });

    cg.add(pk);
    cg.add(pr);
    cg.add(cd);
    add(B(1.7, 0.02, 1.45), glass, 0, 0, 0, cg, "product");

    for (let c = -1; c <= 1; c++) {
      for (const r of [-1, 1]) {
        cylY(0.2, 0.16, c * 0.5, -0.09, r * 0.36, pockM, pk, "product");
        cylY(0.11, 0.1, c * 0.5, -0.07, r * 0.36, pm, pr, "product");
      }
    }
    const fo = add(B(1.7, 0.012, 1.45), foilM, 0, 0.03, 0, cg, "product");
    add(B(0.3, 0.014, 0.06), dark, 0.5, 0.04, 0.6, cd, "product");
    add(B(0.16, 0.014, 0.06), dark, -0.5, 0.04, 0.6, cd, "product");
    return { g: cg, pk, pr, fo, cd, pm, col, i: 0, lk: 0, on: false, x: 0 };
  }

  const wcs: ReturnType<typeof makeCard>[] = [];
  const ocs: ReturnType<typeof makeCard>[] = [];
  for (let i = 0; i < 7; i++) {
    const c = makeCard(pal[i % 5]);
    c.i = i;
    group.add(c.g);
    wcs.push(c);
  }
  for (let i = 0; i < 6; i++) {
    const c = makeCard(pal[i % 5]);
    c.on = i < 3;
    c.x = 7.9 + i * 1.8;
    group.add(c.g);
    ocs.push(c);
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
      bp += 1.6 * effDt;

      const cyc = Math.floor(localT / 3);
      const p = localT - cyc * 3;
      const u = cyc + ss(0, 0.8, p);

      for (const c of wcs) {
        const k = (c.i + u) % 7;
        if (k < c.lk - 1) {
          const o = ocs.find((q) => !q.on);
          if (o) {
            o.on = true;
            o.x = 6.2;
            o.col = c.col;
            (o.pm as THREE.MeshStandardMaterial).color.setHex(c.col);
          }
          c.col = pal[Math.floor(rng() * 5)];
          (c.pm as THREE.MeshStandardMaterial).color.setHex(c.col);
        }
        c.lk = k;
        c.g.position.set(-6.4 + 1.8 * k, 2, 0);
        const vis = (stIdx: number, pa: number) =>
          k > stIdx + 0.01 || (Math.abs(k - stIdx) < 0.01 && !(p >= 0.8 && p < pa));
        c.pk.visible = vis(2, 1.3);
        c.pr.visible = vis(3, 1.2);
        c.fo.visible = vis(4, 1.6);
        c.cd.visible = vis(5, 1.5);
      }

      for (const o of ocs) {
        if (!o.on) {
          o.g.visible = false;
          continue;
        }
        o.x += 1.6 * effDt;
        if (o.x > 13.6) {
          o.on = false;
          o.g.visible = false;
          continue;
        }
        o.g.visible = true;
        o.g.position.set(o.x, 2 - 0.83 * ss(6.2, 7.4, o.x), 0);
      }

      for (const s of sts) {
        const y = 2.95 - (2.95 - s.dn) * s.f(p);
        if (s.pl) s.pl.position.y = y;
        if (s.rod) {
          s.rod.scale.y = 3.75 - (y + 0.25);
          s.rod.position.y = (3.75 + y + 0.25) / 2;
        }
      }

      ribs.forEach((r, i) => {
        r.position.x = 6.3 + ((bp + i * 0.6) % 7.2);
      });
      brush.position.x = -1 + (p > 1 ? 0.015 * Math.sin(localT * 40) : 0);

      rFilm.rotation.z -= effDt * 0.15;
      rFoil.rotation.z -= effDt * 0.15;
      rScrap.rotation.z += effDt * 0.15;
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
