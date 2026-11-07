import * as THREE from "three";
import type { MachineState } from "../machineModels";
import {
  createHelpers,
  ss,
  updateStandardVisuals,
  type BuilderContext,
  type StandardStatusControls,
} from "./common";

export function buildCas(ctx: BuilderContext) {
  const { group, disposables } = ctx;
  const { M, box, cylY, cylZ } = createHelpers(ctx);

  let st: MachineState = "running";
  let bp = 0;
  let t = 0;
  let speedMultiplier = 1;

  const steel = M(0xb9c2cf, { metalness: 0.7, roughness: 0.35 });
  const dark = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  const blue = M(0x1c5fd4, { metalness: 0.3 });
  const rail = M(0x4a5566);
  const lite = M(0xdfe5ee, { metalness: 0.2 });
  const hot = M(0xe07b00);
  const red = M(0xd22e2e);
  const tapeRoll = M(0xe8dfc6, { metalness: 0.05, roughness: 0.4 });

  const rollers: THREE.Mesh[] = [];
  const rm = M(0x9aa5b4);
  for (const cx of [-7, 7]) {
    for (let i = 0; i < 8; i++) rollers.push(cylZ(0.12, 1.5, cx - 3.5 + i, 0.9, 0, rm));
    for (const z of [-0.85, 0.85]) box(8, 0.25, 0.1, cx, 0.85, z, rail);
    for (const x of [-3.5, 0, 3.5]) {
      for (const z of [-0.8, 0.8]) box(0.12, 0.8, 0.12, cx + x, 0.4, z, rail);
    }
  }

  for (const x of [-3, 3]) {
    for (const z of [-1, 1]) {
      box(0.16, 0.95, 0.16, x, 0.475, z, blue);
      box(0.34, 0.05, 0.34, x, 0.025, z, rail);
    }
  }
  for (const z of [-1, 1]) {
    box(6.4, 0.55, 0.04, 0, 0.55, z * 1.02, lite);
    box(6.4, 0.14, 0.14, 0, 0.85, z, blue);
  }
  for (const z of [-0.35, 0.35]) box(7, 0.06, 0.4, 0, 0.96, z, steel);

  box(1.3, 0.55, 0.9, 0, 0.5, 0, hot);
  box(0.5, 0.1, 0.25, 0, 0.95, 0, steel);
  cylZ(0.42, 0.3, 0, 0.45, 0.8, tapeRoll);
  cylZ(0.08, 0.5, 0, 0.45, 0.8, rail);

  for (const x of [-3.1, 3.1]) {
    for (const z of [-1.25, 1.25]) box(0.2, 3.5, 0.2, x, 1.75, z, blue);
  }
  for (const z of [-1.25, 1.25]) box(6.4, 0.2, 0.2, 0, 3.5, z, blue);
  for (const x of [-3.1, 3.1]) box(0.2, 0.2, 2.7, x, 3.5, 0, blue);

  const guardMat = new THREE.MeshStandardMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  disposables.push(guardMat);
  for (const z of [-1.3, 1.3]) box(6, 2.2, 0.03, 0, 2.4, z, guardMat);

  box(0.4, 0.25, 2.7, 0, 3.4, 0, rail);
  for (const z of [-1, 1]) cylY(0.07, 0.6, 0, 3.0, z, steel);
  cylY(0.09, 0.15, 0, 3.6, 0, steel);
  box(0.6, 0.05, 0.07, 0, 3.7, 0, steel);
  box(0.07, 0.05, 0.6, 0, 3.7, 0, steel);

  const lugs: { m: THREE.Mesh; i: number }[] = [];
  for (const s of [-1, 1]) {
    box(6.4, 1.6, 0.08, 0, 1.9, s * 0.97, lite);
    box(6.4, 0.5, 0.1, 0, 1.62, s * 0.67, dark);
    box(0.9, 0.7, 0.45, -2.7, 2.3, s * 1.15, M(0x5b6675));
    for (let i = 0; i < 8; i++) {
      lugs.push({
        m: box(0.3, 0.5, 0.05, 0, 1.62, s * 0.62, M(0x6a7482, { metalness: 0.1 })),
        i,
      });
    }
  }

  box(0.35, 0.4, 0.35, 0, 3.3, 0, rail);
  box(1.3, 0.9, 1.0, 0, 2.7, 0, red);
  box(0.5, 0.08, 0.5, 0, 2.24, 0, steel);
  const roll = cylZ(0.5, 0.35, 0, 2.95, -0.95, tapeRoll);
  cylZ(0.1, 0.6, 0, 2.95, -0.95, rail);

  box(0.15, 2.4, 0.15, -4.4, 2.2, -1.0, rail);
  box(0.12, 0.12, 1.0, -4.4, 2.0, -0.5, rail);
  const pb = box(1.0, 0.06, 0.06, -4.0, 1.9, 0, steel);
  pb.rotation.z = -0.35;
  for (const s of [-1, 1]) {
    const p = box(1.6, 0.6, 0.04, -1.6, 2.35, s * 0.81, steel);
    p.rotation.y = s * 0.23;
    box(0.1, 0.9, 0.1, -2.2, 2.9, s * 1.0, rail);
    box(0.1, 0.9, 0.1, -1.0, 2.9, s * 0.8, rail);
  }

  cylY(0.08, 2, 4.0, 1, 1.9, M(0x5b6675));
  box(0.9, 0.6, 0.08, 4.0, 2.2, 1.9, M(0x2a3444));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  disposables.push(scrMat);
  const scrGeo = new THREE.PlaneGeometry(0.75, 0.45);
  disposables.push(scrGeo);
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.set(4.0, 2.2, 1.95);
  group.add(scr);

  const lRedMat = new THREE.MeshStandardMaterial({
    color: 0xd93838,
    emissive: 0xd93838,
    emissiveIntensity: 0.15,
  });
  const lAmberMat = new THREE.MeshStandardMaterial({
    color: 0xe0a800,
    emissive: 0xe0a800,
    emissiveIntensity: 0.15,
  });
  const lGreenMat = new THREE.MeshStandardMaterial({
    color: 0x1fa35c,
    emissive: 0x1fa35c,
    emissiveIntensity: 1.0,
  });
  disposables.push(lRedMat, lAmberMat, lGreenMat);
  cylY(0.16, 0.3, 3.1, 3.65, 1.25, lRedMat);
  cylY(0.16, 0.3, 3.1, 3.97, 1.25, lAmberMat);
  cylY(0.16, 0.3, 3.1, 4.29, 1.25, lGreenMat);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

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

  const cBoxGeo = new THREE.BoxGeometry(1.8, 1.2, 1.2);
  const pnlGeo = new THREE.PlaneGeometry(1.0, 0.7);
  const bdGeo = new THREE.PlaneGeometry(1.0, 0.2);
  disposables.push(cBoxGeo, pnlGeo, bdGeo);

  for (let i = 0; i < N; i++) {
    const cg = new THREE.Group();
    const cb = new THREE.Mesh(cBoxGeo, kraft);
    cb.position.y = 0.6;
    cg.add(cb);

    const bands: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const pnl = new THREE.Mesh(pnlGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      pnl.position.set(0, 0.65, s * 0.601);
      if (s < 0) pnl.rotation.y = Math.PI;
      cg.add(pnl);

      const bdMat = new THREE.MeshBasicMaterial({ color: pal[i % 5] });
      disposables.push(bdMat);
      const bd = new THREE.Mesh(bdGeo, bdMat);
      bd.position.set(0, 0.42, s * 0.602);
      if (s < 0) bd.rotation.y = Math.PI;
      cg.add(bd);
      bands.push(bd);
    }

    const mk = (px: number, pz: number, mx: number, mz: number, lx: number, lz: number) => {
      const p = new THREE.Group();
      p.position.set(px, 1.2, pz);
      cg.add(p);
      box(lx, 0.03, lz, mx, 0.005, mz, flapM, p);
      return p;
    };

    const lead = mk(0.9, 0, -0.3, 0, 0.6, 1.2);
    const trail = mk(-0.9, 0, 0.3, 0, 0.6, 1.2);
    const maj = [-1, 1].map((s) => {
      const p = mk(0, s * 0.6, 0, -s * 0.3, 1.8, 0.6);
      p.children[0].position.y = 0.03;
      return p;
    });

    const strip = box(1, 0.008, 0.12, 0, 1.245, 0, tapeM, cg);
    const tf = box(0.008, 0.16, 0.12, 0.904, 1.12, 0, tapeM, cg);
    const tr = box(0.008, 0.16, 0.12, -0.904, 1.12, 0, tapeM, cg);
    const bf = box(0.008, 0.16, 0.12, 0.904, 0.08, 0, tapeM, cg);
    const br = box(0.008, 0.16, 0.12, -0.904, 0.08, 0, tapeM, cg);

    cg.position.set(X0 + (i * L) / N, 1.02, 0);
    group.add(cg);
    cts.push({ g: cg, lead, trail, maj, strip, tf, tr, bf, br, bands });
  }

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      t += dt;
      const isRunning = st === "running";
      const v = isRunning ? 2.4 : 0;
      bp += v * dt;
      for (const c of cts) {
        c.g.position.x += v * dt;
        if (c.g.position.x > X0 + L) {
          c.g.position.x -= L;
          const col = pal[Math.floor(Math.random() * 5)];
          c.bands.forEach((b) => {
            if (b.material instanceof THREE.MeshBasicMaterial) b.material.color.setHex(col);
          });
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
      for (const r of rollers) r.rotation.z -= (v * dt) / 0.12;
      for (const l of lugs) l.m.position.x = -3.1 + ((bp + l.i * 0.8) % 6.4);
      if (isRunning) roll.rotation.z -= dt * 0.8;
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildFed(ctx: BuilderContext) {
  const { group, disposables } = ctx;
  const { M, box, cylY } = createHelpers(ctx);

  let st: MachineState = "running";
  let bp = 0;
  let es = 0;
  let t = 0;
  let speedMultiplier = 1;

  const steel = M(0xd5d9de, { metalness: 0.4, roughness: 0.4 });
  const dark = M(0x333840, { metalness: 0.1, roughness: 0.8 });
  const teal = M(0x0f7a6b);
  const teal2 = M(0x0b5f53);
  const lite = M(0xeceff2, { metalness: 0.1 });
  const belt = M(0x2b2e33, { metalness: 0.05, roughness: 0.85 });

  box(1.9, 0.9, 1.9, 0, 0.45, 0, teal);
  box(1.5, 0.7, 0.01, 0, 0.45, 0.955, teal2);
  box(0.3, 0.04, 0.03, 0.5, 0.5, 0.97, steel);

  const tbl = new THREE.Group();
  group.add(tbl);
  cylY(0.85, 0.06, 0, 0.93, 0, lite, tbl);
  for (let i = 0; i < 3; i++) {
    const s = box(0.85, 0.012, 0.05, 0, 0.965, 0, steel, tbl);
    s.rotation.y = (i * Math.PI) / 3;
  }
  const coneGeo = new THREE.ConeGeometry(0.28, 0.2, 32);
  disposables.push(coneGeo);
  const cone = new THREE.Mesh(coneGeo, steel);
  cone.position.set(0, 1.06, 0);
  tbl.add(cone);

  const pal = [0x3fb6a8, 0xe63946, 0x1d8ed6, 0xf2a516, 0x6a4c93];
  const bBodyGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.36, 24);
  const bShGeo = new THREE.CylinderGeometry(0.05, 0.11, 0.08, 24);
  const bNeckGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 24);
  const bCapGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 24);
  disposables.push(bBodyGeo, bShGeo, bNeckGeo, bCapGeo);

  function makeBottle(col: number, p: THREE.Object3D, x: number, y: number, z: number) {
    const bg = new THREE.Group();
    const bm = M(col, { metalness: 0.05, roughness: 0.35 });
    const b1 = new THREE.Mesh(bBodyGeo, bm);
    b1.position.y = 0.18;
    bg.add(b1);
    const sh = new THREE.Mesh(bShGeo, bm);
    sh.position.y = 0.4;
    bg.add(sh);
    const b2 = new THREE.Mesh(bNeckGeo, bm);
    b2.position.y = 0.47;
    bg.add(b2);
    const b3 = new THREE.Mesh(bCapGeo, M(0xf5f5f5, { metalness: 0.1 }));
    b3.position.y = 0.525;
    bg.add(b3);
    bg.position.set(x, y, z);
    p.add(bg);
    return bg;
  }

  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996;
    const r = 0.3 + 0.46 * Math.sqrt((i + 0.5) / 18);
    makeBottle(pal[i % 5], tbl, r * Math.cos(a), 0.96, r * Math.sin(a));
  }

  const ringGeo = new THREE.CylinderGeometry(
    0.92,
    0.92,
    0.32,
    64,
    1,
    true,
    Math.PI / 2 + 0.4,
    Math.PI * 2 - 0.8,
  );
  disposables.push(ringGeo);
  const ring = new THREE.Mesh(
    ringGeo,
    M(0xb9c2cf, { metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide }),
  );
  ring.position.y = 1.13;
  group.add(ring);

  const lipGeo = new THREE.TorusGeometry(0.92, 0.02, 8, 64, Math.PI * 2 - 0.8);
  disposables.push(lipGeo);
  const lip = new THREE.Mesh(lipGeo, steel);
  lip.rotation.x = Math.PI / 2;
  lip.rotation.z = Math.PI / 2 + 0.4 - Math.PI / 2;
  lip.position.y = 1.29;
  group.add(lip);

  box(2.7, 0.1, 0.4, 2.35, 0.86, 0, steel);
  box(2.7, 0.03, 0.34, 2.35, 0.935, 0, belt);
  for (const z of [-0.2, 0.2]) box(2.7, 0.12, 0.03, 2.35, 1.02, z, steel);
  for (const x of [1.3, 3.3]) {
    for (const z of [-0.17, 0.17]) box(0.05, 0.8, 0.05, x, 0.4, z, steel);
  }

  const cb: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) cb.push(makeBottle(pal[i % 5], group, 1, 0.95, 0));

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
    const b = box(
      w,
      h,
      d,
      ex0 + Math.cos(ea) * s - Math.sin(ea) * o,
      ey0 + Math.sin(ea) * s + Math.cos(ea) * o,
      z,
      m,
    );
    b.rotation.z = ea;
    return b;
  }

  inc(el, 0.05, 0.46, el / 2, 0, 0, belt);
  for (const z of [-0.25, 0.25]) inc(el, 0.16, 0.03, el / 2, 0.06, z, steel);
  const cl: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) cl.push(inc(0.04, 0.08, 0.44, 0, 0.06, 0, steel));

  for (const z of [-0.22, 0.22]) {
    box(0.06, 0.64, 0.06, -2.3, 0.32, z, steel);
    box(0.06, 1.22, 0.06, -1.4, 0.61, z, steel);
  }
  box(0.04, 0.45, 0.6, -3.0, 0.52, 0, steel);
  for (const z of [-0.3, 0.3]) box(0.55, 0.45, 0.04, -2.72, 0.52, z, steel);
  const chute = box(0.55, 0.03, 0.4, -0.85, 1.42, 0, steel);
  chute.rotation.z = -0.5;

  cylY(0.03, 1.4, 1.15, 0.7, 1.15, steel);
  const hg = new THREE.Group();
  hg.position.set(1.15, 1.45, 1.15);
  hg.rotation.y = -0.6;
  group.add(hg);
  box(0.42, 0.3, 0.05, 0, 0, 0, dark, hg);
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  disposables.push(scrMat);
  const scrGeo = new THREE.PlaneGeometry(0.36, 0.24);
  disposables.push(scrGeo);
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.z = 0.028;
  hg.add(scr);

  // Standard 3-lamp stack light for Feeder (Requirement 3.6)
  cylY(0.02, 0.5, -0.8, 1.8, 0.8, steel, undefined, 8);
  const lRedMat = new THREE.MeshStandardMaterial({
    color: 0xd93838,
    emissive: 0xd93838,
    emissiveIntensity: 0.15,
  });
  const lAmberMat = new THREE.MeshStandardMaterial({
    color: 0xe0a800,
    emissive: 0xe0a800,
    emissiveIntensity: 0.15,
  });
  const lGreenMat = new THREE.MeshStandardMaterial({
    color: 0x1fa35c,
    emissive: 0x1fa35c,
    emissiveIntensity: 1.0,
  });
  disposables.push(lRedMat, lAmberMat, lGreenMat);
  cylY(0.08, 0.12, -0.8, 2.1, 0.8, lRedMat, undefined, 16);
  cylY(0.08, 0.12, -0.8, 2.23, 0.8, lAmberMat, undefined, 16);
  cylY(0.08, 0.12, -0.8, 2.36, 0.8, lGreenMat, undefined, 16);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      t += dt;
      const isRunning = st === "running";
      if (isRunning) {
        tbl.rotation.y -= dt * 0.6;
        bp += dt * 1.2;
        es += dt * 0.6;
      }
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
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildBlp(ctx: BuilderContext) {
  const { group, disposables } = ctx;
  const { M, box, cylY, cylZ } = createHelpers(ctx);

  let st: MachineState = "running";
  let t = 0;
  let bp = 0;
  let speedMultiplier = 1;

  const steel = M(0xb9c2cf, { metalness: 0.7, roughness: 0.35 });
  const dark = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  const blue = M(0x1c5fd4, { metalness: 0.3 });
  const rail = M(0x4a5566);
  const lite = M(0xdfe5ee, { metalness: 0.2 });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xcfe8f5,
    transparent: true,
    opacity: 0.32,
    roughness: 0.05,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pockM = new THREE.MeshPhysicalMaterial({
    color: 0xcfe8f5,
    transparent: true,
    opacity: 0.5,
    roughness: 0.05,
    metalness: 0,
    depthWrite: false,
  });
  const foilM = M(0xdfe3ea, {
    transparent: true,
    opacity: 0.7,
    metalness: 0.6,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });
  disposables.push(glass, pockM, foilM);

  box(12.2, 1.5, 2.2, -0.7, 0.75, 0, lite);
  for (const z of [-0.8, 0.8]) box(13.6, 0.06, 0.06, -0.5, 2.0, z, steel);
  for (const x of [-6.9, 5.1]) {
    for (const z of [-1.3, 1.3]) box(0.25, 4, 0.25, x, 2, z, blue);
  }
  for (const z of [-1.3, 1.3]) box(12.2, 0.2, 0.2, -0.9, 4, z, blue);
  for (const x of [-6.9, 5.1]) box(0.25, 0.2, 2.7, x, 4, 0, blue);

  const guardMat = new THREE.MeshStandardMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  disposables.push(guardMat);
  for (const z of [-1.32, 1.32]) box(12, 2.3, 0.03, -0.9, 2.75, z, guardMat);

  function makeReel(x: number, y: number, r: number, len: number, m: THREE.Material) {
    const s = cylZ(r, len, x, y, 0, m);
    box(r * 1.7, 0.08, 0.03, 0, 0, len / 2 + 0.02, rail, s);
    cylZ(0.12, len + 0.3, 0, 0, 0, steel, s);
    for (const z of [-1, 1])
      box(0.25, y + 0.2, 0.25, x, (y + 0.2) / 2 - 0.1, z * (len / 2 + 0.35), blue);
    return s;
  }

  const rFilm = makeReel(
    -8.4,
    3.2,
    0.9,
    1.7,
    M(0xcfe8f5, { transparent: true, opacity: 0.65, metalness: 0, roughness: 0.2 }),
  );
  const rFoil = makeReel(-0.9, 4.75, 0.7, 1.7, M(0xc8ccd4, { metalness: 0.9, roughness: 0.25 }));
  const rScrap = makeReel(
    5.7,
    3.4,
    0.55,
    1.7,
    M(0x9fc5dc, { transparent: true, opacity: 0.7, metalness: 0 }),
  );
  box(0.3, 0.3, 2.7, -8.4, 0.15, 0, blue);

  const wp = box(1.0, 0.02, 1.45, -7.95, 2.15, 0, glass);
  wp.rotation.z = -0.3;
  cylZ(0.1, 1.6, -7.5, 2.0, 0, steel);

  box(0.012, 2.4, 1.5, -0.2, 3.45, 0, foilM);
  cylZ(0.08, 1.6, -0.2, 2.25, 0, steel);
  box(1.9, 0.012, 1.5, 0.75, 2.25, 0, foilM);
  const sk = box(1.04, 0.02, 1.5, 5.3, 2.42, 0, glass);
  sk.rotation.z = 0.955;

  const sts = [
    { x: -4.6, c: 0xff7a1a, dn: 2.42, f: (p: number) => ss(0.9, 1.2, p) - ss(2.6, 2.9, p) },
    { x: -2.8, c: 0x1c9fd6, dn: 2.42, f: (p: number) => ss(0.9, 1.2, p) - ss(1.7, 2, p) },
    { x: 0.8, c: 0xd22e2e, dn: 2.5, f: (p: number) => ss(1.2, 1.5, p) - ss(2.3, 2.6, p) },
    { x: 2.6, c: 0x2a4bd6, dn: 2.42, f: (p: number) => ss(1.2, 1.4, p) - ss(1.7, 1.9, p) },
    { x: 4.4, c: 0x777f8c, dn: 2.42, f: (p: number) => ss(1.5, 1.7, p) - ss(1.85, 2.05, p) },
  ];

  const stRods: { pl: THREE.Mesh; rod: THREE.Mesh; dn: number; f: (p: number) => number }[] = [];
  for (const s of sts) {
    const sm = M(s.c, { metalness: 0.3 });
    const pl = box(1.6, 0.5, 1.5, s.x, 2.95, 0, sm);
    const rod = cylY(0.12, 1, s.x, 3.4, 0, steel);
    box(1.6, 0.3, 1.5, s.x, 1.65, 0, sm);
    box(0.3, 0.3, 2.7, s.x, 3.9, 0, rail);
    stRods.push({ pl, rod, dn: s.dn, f: s.f });
  }

  cylY(0.5, 1, -1, 0.5, -2.6, rail);
  cylY(0.85, 0.5, -1, 1.25, -2.6, M(0x6a7482));
  cylY(0.75, 0.06, -1, 1.52, -2.6, steel);
  const ch = box(0.5, 0.08, 2.1, -1, 2.12, -1.6, steel);
  ch.rotation.x = -0.27;
  const brush = box(1.2, 0.5, 1.5, -1, 2.55, 0, M(0x2a9d8f));

  cylY(0.08, 2, -3.6, 1, 2.1, M(0x5b6675));
  box(0.9, 0.6, 0.08, -3.6, 2.2, 2.1, M(0x2a3444));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  disposables.push(scrMat);
  const scrGeo = new THREE.PlaneGeometry(0.75, 0.45);
  disposables.push(scrGeo);
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.set(-3.6, 2.2, 2.15);
  group.add(scr);

  const lRedMat = new THREE.MeshStandardMaterial({
    color: 0xd93838,
    emissive: 0xd93838,
    emissiveIntensity: 0.15,
  });
  const lAmberMat = new THREE.MeshStandardMaterial({
    color: 0xe0a800,
    emissive: 0xe0a800,
    emissiveIntensity: 0.15,
  });
  const lGreenMat = new THREE.MeshStandardMaterial({
    color: 0x1fa35c,
    emissive: 0x1fa35c,
    emissiveIntensity: 1.0,
  });
  disposables.push(lRedMat, lAmberMat, lGreenMat);
  cylY(0.16, 0.3, 5.1, 4.25, 1.3, lRedMat);
  cylY(0.16, 0.3, 5.1, 4.57, 1.3, lAmberMat);
  cylY(0.16, 0.3, 5.1, 4.89, 1.3, lGreenMat);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const cp = box(1.35, 0.04, 1.6, 6.8, 1.45, 0, steel);
  cp.rotation.z = -0.605;
  box(7.4, 0.12, 1.7, 9.9, 0.94, 0, dark);
  for (const z of [-0.9, 0.9]) box(7.4, 0.25, 0.06, 9.9, 1.1, z, steel);
  for (let i = 0; i < 5; i++) {
    for (const z of [-0.8, 0.8]) box(0.12, 0.9, 0.12, 6.9 + i * 1.7, 0.45, z, rail);
  }
  const ribs: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    ribs.push(box(0.05, 0.02, 1.6, 0, 1.0, 0, M(0x555c66, { metalness: 0.1 })));
  }

  const pal = [0xe63946, 0x2a9d8f, 0x1d8ed6, 0x6a4c93, 0xf2a516];
  const cardBaseGeo = new THREE.BoxGeometry(1.7, 0.02, 1.45);
  const pockGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 16);
  const prodGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.1, 16);
  const foilGeo = new THREE.BoxGeometry(1.7, 0.012, 1.45);
  disposables.push(cardBaseGeo, pockGeo, prodGeo, foilGeo);

  function makeCard(col: number) {
    const cg = new THREE.Group();
    const pk = new THREE.Group();
    const pr = new THREE.Group();
    const cd = new THREE.Group();
    const pm = M(col, { metalness: 0.1, roughness: 0.4 });
    cg.add(pk);
    cg.add(pr);
    cg.add(cd);

    const b = new THREE.Mesh(cardBaseGeo, glass);
    cg.add(b);
    for (let c = -1; c <= 1; c++) {
      for (const r of [-1, 1]) {
        const pMesh = new THREE.Mesh(pockGeo, pockM);
        pMesh.position.set(c * 0.5, -0.09, r * 0.36);
        pk.add(pMesh);
        const prMesh = new THREE.Mesh(prodGeo, pm);
        prMesh.position.set(c * 0.5, -0.07, r * 0.36);
        pr.add(prMesh);
      }
    }
    const fo = new THREE.Mesh(foilGeo, foilM);
    fo.position.y = 0.03;
    cg.add(fo);
    box(0.3, 0.014, 0.06, 0.5, 0.04, 0.6, dark, cd);
    box(0.16, 0.014, 0.06, -0.5, 0.04, 0.6, dark, cd);
    return { g: cg, pk, pr, fo, cd, pm, col };
  }

  const wcs: ReturnType<typeof makeCard>[] = [];
  const ocs: (ReturnType<typeof makeCard> & { on: boolean; x: number })[] = [];
  for (let i = 0; i < 7; i++) {
    const c = makeCard(pal[i % 5]);
    group.add(c.g);
    (c as Record<string, unknown>).i = i;
    (c as Record<string, unknown>).lk = 0;
    wcs.push(c);
  }
  for (let i = 0; i < 6; i++) {
    const c = makeCard(pal[i % 5]);
    group.add(c.g);
    const entry = { ...c, on: i < 3, x: 7.9 + i * 1.8 };
    ocs.push(entry);
  }

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      const isRunning = st === "running";
      const dR = isRunning ? dt : 0;
      t += dR;
      bp += 1.6 * dR;

      const cyc = Math.floor(t / 3);
      const p = t - cyc * 3;
      const u = cyc + ss(0, 0.8, p);

      for (const c of wcs) {
        const cAny = c as unknown as { i: number; lk: number };
        const k = (cAny.i + u) % 7;
        if (k < cAny.lk - 1) {
          const o = ocs.find((q) => !q.on);
          if (o) {
            o.on = true;
            o.x = 6.2;
            o.col = c.col;
            if (o.pm instanceof THREE.MeshStandardMaterial) o.pm.color.setHex(c.col);
          }
          c.col = pal[Math.floor(Math.random() * 5)];
          if (c.pm instanceof THREE.MeshStandardMaterial) c.pm.color.setHex(c.col);
        }
        cAny.lk = k;
        c.g.position.set(-6.4 + 1.8 * k, 2, 0);

        const vis = (thresh: number, pa: number) =>
          k > thresh + 0.01 || (Math.abs(k - thresh) < 0.01 && !(p >= 0.8 && p < pa));
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
        o.x += 1.6 * dR;
        if (o.x > 13.6) {
          o.on = false;
          o.g.visible = false;
          continue;
        }
        o.g.visible = true;
        o.g.position.set(o.x, 2 - 0.83 * ss(6.2, 7.4, o.x), 0);
      }

      for (const s of stRods) {
        const y = 2.95 - (2.95 - s.dn) * s.f(p);
        s.pl.position.y = y;
        s.rod.scale.y = 3.75 - (y + 0.25);
        s.rod.position.y = (3.75 + y + 0.25) / 2;
      }

      ribs.forEach((r, i) => {
        r.position.x = 6.3 + ((bp + i * 0.6) % 7.2);
      });
      brush.position.x = -1 + (isRunning && p > 1 ? 0.015 * Math.sin(t * 40) : 0);
      if (isRunning) {
        rFilm.rotation.z -= dt * 0.15;
        rFoil.rotation.z -= dt * 0.15;
        rScrap.rotation.z += dt * 0.15;
      }
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildLpp(ctx: BuilderContext) {
  const { group, disposables } = ctx;
  const { M, box, cylY, cylX } = createHelpers(ctx);

  let st: MachineState = "running";
  let t = 0;
  let speedMultiplier = 1;

  const steel = M(0xd5d9de, { metalness: 0.4, roughness: 0.4 });
  const dark = M(0x333840, { metalness: 0.1, roughness: 0.8 });
  const blue = M(0x1f5fa8);
  const blue2 = M(0x174c86);
  const lite = M(0xeceff2, { metalness: 0.1 });
  const film = M(0xaebfcf, { metalness: 0.3, roughness: 0.25 });
  const red = M(0xd6533a, { emissive: 0x5a1a10 });

  for (const x of [-0.74, 0.74]) {
    for (const z of [-0.48, 0]) {
      box(0.08, 1.2, 0.08, x, 0.6, z, steel);
      box(0.14, 0.03, 0.14, x, 0.015, z, dark);
    }
  }
  box(1.5, 0.05, 0.05, 0, 0.45, -0.48, steel);
  box(1.5, 0.05, 0.05, 0, 0.45, 0, steel);
  for (const x of [-0.74, 0.74]) box(0.05, 0.05, 0.48, x, 0.45, -0.24, steel);

  box(1.6, 1.4, 0.6, 0, 1.9, -0.25, blue);
  box(1.4, 1.2, 0.01, 0, 1.9, 0.055, blue2);
  box(0.04, 0.3, 0.04, 0.6, 1.9, 0.08, steel);
  box(0.5, 1.4, 0.6, -1.15, 0.7, -0.25, steel);
  box(0.44, 1.3, 0.01, -1.15, 0.7, 0.055, lite);
  box(0.03, 0.25, 0.03, -0.98, 0.7, 0.075, dark);

  const reel = cylX(0.45, 0.45, 0, 2.2, -1.05, film);
  box(0.47, 0.06, 0.06, 0, 0.3, 0, dark, reel);
  cylX(0.15, 0.5, 0, 2.2, -1.05, dark);
  for (const x of [-0.235, 0.235]) cylX(0.48, 0.02, x, 2.2, -1.05, steel);
  for (const x of [-0.28, 0.28]) box(0.06, 0.06, 0.5, x, 2.2, -0.8, steel);

  box(0.42, 0.006, 1.35, 0, 2.62, -0.375, film);
  box(0.42, 0.17, 0.006, 0, 2.535, 0.3, film);
  cylX(0.05, 0.5, 0, 2.05, 0.11, steel);
  cylX(0.05, 0.5, 0, 1.75, 0.11, steel);

  cylY(0.14, 0.3, 0, 2.55, 0.3, steel);
  const colGeo = new THREE.CylinderGeometry(0.3, 0.14, 0.3, 32);
  disposables.push(colGeo);
  const col = new THREE.Mesh(colGeo, steel);
  col.position.set(0, 2.3, 0.3);
  group.add(col);

  cylY(0.14, 0.85, 0, 1.725, 0.3, steel);
  const funGeo = new THREE.CylinderGeometry(0.45, 0.14, 0.5, 32);
  disposables.push(funGeo);
  const fun = new THREE.Mesh(funGeo, steel);
  fun.position.set(0, 2.95, 0.3);
  group.add(fun);

  const rimGeo = new THREE.TorusGeometry(0.45, 0.02, 8, 48);
  disposables.push(rimGeo);
  const rim = new THREE.Mesh(rimGeo, dark);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 3.2, 0.3);
  group.add(rim);

  box(0.1, 0.7, 0.1, 0, 2.95, -0.25, steel);
  box(0.08, 0.08, 0.7, 0, 3.1, 0.05, steel);

  const jb = box(0.55, 0.12, 0.08, 0, 1.4, 0.12, red);
  const jf = box(0.55, 0.12, 0.08, 0, 1.4, 0.48, red);
  for (const x of [-0.35, 0.35]) box(0.06, 0.06, 0.5, x, 1.4, 0.3, steel);

  const ch = box(0.6, 0.03, 0.9, 0, 0.62, 0.55, steel);
  ch.rotation.x = 0.45;
  for (const x of [-0.3, 0.3]) {
    const r = box(0.02, 0.08, 0.9, x, 0.665, 0.572, steel);
    r.rotation.x = 0.45;
  }

  const bm = M(0x555b64);
  box(0.8, 0.04, 0.6, 0, 0.02, 1.3, bm);
  box(0.8, 0.3, 0.04, 0, 0.17, 1.6, bm);
  for (const x of [-0.4, 0.4]) box(0.04, 0.3, 0.6, x, 0.17, 1.3, bm);

  cylY(0.03, 1.6, 1.15, 0.8, 0.3, steel);
  const hg = new THREE.Group();
  hg.position.set(1.15, 1.65, 0.3);
  hg.rotation.y = -0.45;
  group.add(hg);
  box(0.42, 0.3, 0.05, 0, 0, 0, dark, hg);
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  disposables.push(scrMat);
  const scrGeo = new THREE.PlaneGeometry(0.36, 0.24);
  disposables.push(scrGeo);
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.z = 0.028;
  hg.add(scr);

  // Standard 3-lamp stack light for Pouch (Requirement 3.6)
  cylY(0.02, 0.5, -0.74, 2.8, -0.25, steel, undefined, 8);
  const lRedMat = new THREE.MeshStandardMaterial({
    color: 0xd93838,
    emissive: 0xd93838,
    emissiveIntensity: 0.15,
  });
  const lAmberMat = new THREE.MeshStandardMaterial({
    color: 0xe0a800,
    emissive: 0xe0a800,
    emissiveIntensity: 0.15,
  });
  const lGreenMat = new THREE.MeshStandardMaterial({
    color: 0x1fa35c,
    emissive: 0x1fa35c,
    emissiveIntensity: 1.0,
  });
  disposables.push(lRedMat, lAmberMat, lGreenMat);
  cylY(0.08, 0.12, -0.74, 3.1, -0.25, lRedMat, undefined, 16);
  cylY(0.08, 0.12, -0.74, 3.23, -0.25, lAmberMat, undefined, 16);
  cylY(0.08, 0.12, -0.74, 3.36, -0.25, lGreenMat, undefined, 16);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const pcol = [0xf5c16c, 0x7fc8a9, 0xe88a9c];
  const pouches: THREE.Group[] = [];
  const pBoxGeo = new THREE.BoxGeometry(0.32, 0.4, 0.05);
  const pRimGeo = new THREE.BoxGeometry(0.33, 0.04, 0.055);
  disposables.push(pBoxGeo, pRimGeo);

  for (let i = 0; i < 3; i++) {
    const pg = new THREE.Group();
    const pm = M(pcol[i], { metalness: 0, roughness: 0.6 });
    const sm = M(pcol[i], {
      metalness: 0,
      roughness: 0.6,
      color: new THREE.Color(pcol[i]).multiplyScalar(0.8),
    });
    box(0.32, 0.4, 0.05, 0, 0, 0, pm, pg);
    box(0.33, 0.04, 0.055, 0, 0.2, 0, sm, pg);
    box(0.33, 0.04, 0.055, 0, -0.2, 0, sm, pg);
    group.add(pg);
    pouches.push(pg);
  }

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      const isRunning = st === "running";
      if (isRunning) t += dt;

      let c = 0;
      pouches.forEach((g, i) => {
        const q = (t / 3 + i / 3) % 1;
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
      if (red instanceof THREE.MeshStandardMaterial) {
        red.emissiveIntensity = 0.3 + 1.6 * c;
      }
      if (isRunning) reel.rotation.x -= dt * 0.4;
      updateStandardVisuals(statusControls, st, t);
    },
  };
}
