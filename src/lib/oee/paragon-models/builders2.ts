import * as THREE from "three";
import type { MachineState } from "../machineModels";
import {
  createHelpers,
  ss,
  updateStandardVisuals,
  type BuilderContext,
  type StandardStatusControls,
} from "./common";

export function buildLas(ctx: BuilderContext) {
  const { group, disposables } = ctx;
  const { M, box, cylY, cylZ } = createHelpers(ctx);

  let st: MachineState = "running";
  let bp = 0;
  let t = 0;
  let speedMultiplier = 1;

  const rollers: THREE.Mesh[] = [];
  for (const cx of [-6.5, 6.5]) {
    const rm = M(0x9aa5b4);
    const fm = M(0x4a5566);
    for (let i = 0; i < 7; i++) rollers.push(cylZ(0.12, 1.5, cx - 3 + i * 1, 0.9, 0, rm));
    for (const z of [-0.85, 0.85]) box(7, 0.25, 0.1, cx, 0.85, z, fm);
    for (const x of [-3, 0, 3]) {
      for (const z of [-0.8, 0.8]) box(0.12, 0.8, 0.12, cx + x, 0.4, z, fm);
    }
  }

  const fr = M(0x1c5fd4, { metalness: 0.3 });
  for (const x of [-3.1, 3.1]) {
    for (const z of [-1.3, 1.3]) box(0.25, 3.75, 0.25, x, 1.875, z, fr);
  }
  for (const z of [-1.3, 1.3]) box(6.5, 0.25, 0.25, 0, 3.75, z, fr);
  for (const x of [-3.1, 0, 3.1]) box(0.25, 0.25, 2.6, x, 3.75, 0, fr);

  const guardMat = new THREE.MeshStandardMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  disposables.push(guardMat);
  for (const z of [-1.3, 1.3]) box(6.2, 2.4, 0.03, 0, 2.4, z, guardMat);

  const bm = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  const lugs: { m: THREE.Mesh; i: number }[] = [];
  for (const s of [-1, 1]) {
    box(6, 0.7, 0.12, 0, 1.5, s * 0.62, bm);
    box(0.9, 0.8, 0.6, -2.3, 2.3, s * 1.0, M(0x5b6675));
    const pl = box(1.3, 0.03, 0.5, -3.5, 1.75, s * 0.4, M(0xd2d8e2));
    pl.rotation.x = s * 0.5;
    pl.rotation.y = -s * 0.15;
    for (let i = 0; i < 5; i++) {
      lugs.push({
        m: box(0.25, 0.45, 0.06, 0, 1.5, s * 0.56, M(0xf2a516, { metalness: 0.1 })),
        i,
      });
    }
  }

  const topRoll = cylZ(0.5, 0.35, 0, 3.25, -0.75, M(0xe8dfc6, { metalness: 0.05 }));
  box(1.3, 0.8, 1, 0, 3.2, 0, M(0xd22e2e));
  box(0.3, 0.9, 0.3, 0, 2.5, 0, M(0x8a95a5));
  cylZ(0.12, 0.5, 0, 2.2, 0.0, M(0x444b57));

  const botRoll = cylZ(0.4, 0.3, 0, 0.4, 0.75, M(0xe8dfc6, { metalness: 0.05 }));
  box(1.3, 0.5, 0.8, 0, 0.45, 0, M(0xe07b00));
  box(0.4, 0.2, 0.4, 0, 0.85, 0, M(0x8a95a5));

  box(0.9, 1.6, 0.8, -3.4, 1.8, -2.2, M(0x2a3444));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  disposables.push(scrMat);
  const scrGeo = new THREE.PlaneGeometry(0.7, 0.5);
  disposables.push(scrGeo);
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.set(-3.4, 2.2, -1.79);
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
  cylY(0.16, 0.3, 3.1, 4.0, -1.3, lRedMat);
  cylY(0.16, 0.3, 3.1, 4.32, -1.3, lAmberMat);
  cylY(0.16, 0.3, 3.1, 4.64, -1.3, lGreenMat);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const pal = [0xe63946, 0x2a9d8f, 0x1d8ed6, 0x6a4c93, 0xf2cc0f];
  const kraft = M(0xc9a06b, { metalness: 0.02, roughness: 0.85 });
  const flapM = M(0xd8b482, { metalness: 0.02, roughness: 0.85 });
  const tapeM = M(0xf6f0dc, { metalness: 0.05, roughness: 0.3 });
  const N = 6;
  const L = 20;
  const X0 = -10;
  const cts: {
    g: THREE.Group;
    fl: THREE.Group[];
    tp: THREE.Mesh;
    band: THREE.Mesh;
  }[] = [];

  const cBoxGeo = new THREE.BoxGeometry(1.6, 1, 1.1);
  const bandGeo = new THREE.PlaneGeometry(1.0, 0.5);
  const flapGeo = new THREE.BoxGeometry(1.6, 0.02, 0.55);
  const tapeGeo = new THREE.BoxGeometry(1.6, 0.012, 0.06);
  disposables.push(cBoxGeo, bandGeo, flapGeo, tapeGeo);

  for (let i = 0; i < N; i++) {
    const cg = new THREE.Group();
    const cb = new THREE.Mesh(cBoxGeo, kraft);
    cb.position.y = 0.5;
    cg.add(cb);

    const bMat = new THREE.MeshBasicMaterial({ color: pal[i % 5] });
    disposables.push(bMat);
    const band = new THREE.Mesh(bandGeo, bMat);
    band.position.set(0, 0.5, 0.552);
    cg.add(band);

    const fl = [-1, 1].map((s) => {
      const p = new THREE.Group();
      p.position.set(0, 1, s * 0.55);
      cg.add(p);
      const fm = new THREE.Mesh(flapGeo, flapM);
      fm.position.set(0, 0.01, s * 0.275);
      p.add(fm);
      return p;
    });

    const tp = new THREE.Mesh(tapeGeo, tapeM);
    tp.position.set(0, 1.026, 0);
    cg.add(tp);

    cg.position.set(X0 + (i * L) / N, 1.02, 0);
    group.add(cg);
    cts.push({ g: cg, fl, tp, band });
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
          if (c.band.material instanceof THREE.MeshBasicMaterial) {
            c.band.material.color.setHex(pal[Math.floor(Math.random() * 5)]);
          }
        }
        const x = c.g.position.x;
        const k = Math.min(1, Math.max(0, (x + 3.9) / 1.8));
        const a = 1.3 * (1 - k);
        c.fl[0].rotation.x = a;
        c.fl[1].rotation.x = -a;
        const len = Math.min(1.6, Math.max(0, x + 0.8));
        c.tp.visible = len > 0.03;
        c.tp.scale.x = Math.max(0.01, len / 1.6);
        c.tp.position.x = 0.8 - len / 2;
      }
      for (const r of rollers) r.rotation.z -= (v * dt) / 0.12;
      for (const l of lugs) l.m.position.x = -2.8 + ((bp + l.i * 1.12) % 5.6);
      if (isRunning) {
        topRoll.rotation.z -= v * dt * 0.6;
        botRoll.rotation.z -= v * dt * 0.6;
      }
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildCrt(ctx: BuilderContext) {
  const { group, floor, disposables } = ctx;
  const { M, box, cylY } = createHelpers(ctx);

  let st: MachineState = "running";
  let t = 0;
  let speedMultiplier = 1;
  let okN = 0;
  let rejN = 0;
  let lastW = 0;
  let lastOk = true;
  let flashEnd = 0;

  if (floor) {
    const flGeo = new THREE.CircleGeometry(7, 48);
    disposables.push(flGeo);
    const fl = new THREE.Mesh(flGeo, M(0x888882, { transparent: true, opacity: 0.25 }));
    fl.rotation.x = -Math.PI / 2;
    group.add(fl);
  }

  box(8, 0.08, 0.9, 0, 0.96, 0, M(0x2b2e33, { roughness: 0.8 }));
  [-0.5, 0.5].forEach((z) => box(8, 0.14, 0.05, 0, 1.06, z, M(0xb9bec6)));
  [-3.6, -1.2, 0, 3.6].forEach((x) =>
    [-0.4, 0.4].forEach((z) => box(0.07, 0.92, 0.07, x, 0.46, z, M(0x8d939c))),
  );

  const kraft = M(0xc99a5b, { roughness: 0.8, metalness: 0.05 });
  const flap = M(0x9c7440, { roughness: 0.8, metalness: 0.05 });
  box(1.4, 1.8, 1.0, -2.2, 0.9, -1.2, M(0x0f5f8a));
  box(1.46, 0.05, 1.06, -2.2, 1.82, -1.2, M(0xc9ced6));
  for (let s = 0; s < 6; s++) box(0.6, 0.06, 0.45, -2.2, 1.88 + s * 0.07, -1.2, kraft);
  [-0.32, 0.32].forEach((dx) => {
    box(0.03, 0.5, 0.03, -2.2 + dx, 2.1, -1.42, M(0x8d939c));
    box(0.03, 0.5, 0.03, -2.2 + dx, 2.1, -0.98, M(0x8d939c));
  });

  const prodGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 16);
  prodGeo.rotateX(Math.PI / 2);
  disposables.push(prodGeo);
  const prod = new THREE.Mesh(prodGeo, M(0xd5d9de, { metalness: 0.7 }));
  prod.position.set(-2.2, 1.15, -0.95);
  group.add(prod);

  const phead = box(0.22, 0.22, 0.03, -2.2, 1.15, -0.65, M(0x333840));
  box(0.36, 0.26, 0.03, -1.75, 1.3, -0.69, M(0x111418));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
  disposables.push(scrMat);
  const scr = box(0.3, 0.2, 0.005, -1.75, 1.3, -0.67, scrMat);

  box(1.2, 0.09, 0.9, 1.5, 0.962, 0, M(0x3a8f6a));
  box(0.5, 0.25, 0.5, 1.5, 0.75, 0, M(0xb9bec6));
  cylY(0.03, 1.6, 1.5, 0.8, 0.75, M(0x8d939c), undefined, 12);
  box(0.52, 0.34, 0.05, 1.5, 1.6, 0.75, M(0x111418));
  const dspMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
  disposables.push(dspMat);
  const dsp = box(0.44, 0.26, 0.005, 1.5, 1.6, 0.78, dspMat);

  box(0.04, 0.25, 0.04, 1.0, 1.12, 0.55, M(0x9aa0a8));
  box(0.09, 0.09, 0.09, 1.0, 1.28, 0.55, M(0x19c2d6, { emissive: 0x0a7d8a }));

  box(0.22, 0.4, 0.22, 2.6, 1.15, -0.85, M(0x8d939c));
  const rodGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.6, 16);
  rodGeo.rotateX(Math.PI / 2);
  disposables.push(rodGeo);
  const rod = new THREE.Mesh(rodGeo, M(0xd5d9de, { metalness: 0.7 }));
  rod.position.set(2.6, 1.15, -0.9);
  group.add(rod);

  const rhead = box(0.26, 0.22, 0.03, 2.6, 1.15, -0.6, M(0xe24b4a));
  const wm = M(0x8d939c, { transparent: true, opacity: 0.55 });
  box(0.8, 0.05, 0.6, 2.6, 0.55, 0.95, M(0x555b64));
  box(0.8, 0.4, 0.04, 2.6, 0.77, 1.25, wm);
  box(0.04, 0.4, 0.6, 2.2, 0.77, 0.95, wm);
  box(0.04, 0.4, 0.6, 3.0, 0.77, 0.95, wm);

  cylY(0.02, 0.5, -1.7, 2.1, -1.35, M(0x888888), undefined, 8);
  const lGreenMat = M(0x2ecc71, { emissive: 0x2ecc71, emissiveIntensity: 0.08 });
  const lAmberMat = M(0xf5a623, { emissive: 0xf5a623, emissiveIntensity: 0.08 });
  const lRedMat = M(0xe24b4a, { emissive: 0xe24b4a, emissiveIntensity: 0.08 });
  cylY(0.08, 0.12, -1.7, 1.95, -1.35, lGreenMat, undefined, 16);
  cylY(0.08, 0.12, -1.7, 2.08, -1.35, lAmberMat, undefined, 16);
  cylY(0.08, 0.12, -1.7, 2.21, -1.35, lRedMat, undefined, 16);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const cartons: {
    g: THREE.Group;
    x: number;
    w: boolean;
    ok: boolean;
    rej: boolean;
    rejT: number;
    rx: number;
    wt?: number;
  }[] = [];
  const cBodyGeo = new THREE.BoxGeometry(0.4, 0.3, 0.3);
  const cFlapGeo = new THREE.BoxGeometry(0.41, 0.02, 0.12);
  disposables.push(cBodyGeo, cFlapGeo);

  for (let i = 0; i < 8; i++) {
    const cg = new THREE.Group();
    const c1 = new THREE.Mesh(cBodyGeo, kraft);
    cg.add(c1);
    const c2 = new THREE.Mesh(cFlapGeo, flap);
    c2.position.y = 0.151;
    cg.add(c2);
    cg.position.set(-4 + i, 1.15, 0);
    group.add(cg);
    cartons.push({ g: cg, x: -4 + i, w: false, ok: true, rej: false, rejT: 0, rx: 0 });
  }

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      t += dt;
      let act = 0;
      cartons.forEach((c) => {
        if (st === "running") {
          c.x += dt * 1.2;
          if (c.x > 4) {
            c.x -= 8;
            c.w = false;
            c.ok = true;
            c.rej = false;
            c.rejT = 0;
          }
          if (!c.w && c.x > 1.5) {
            c.w = true;
            c.wt = 247 + Math.random() * 8;
            c.ok = Math.abs(c.wt - 251) <= 3.5;
            lastW = c.wt;
            lastOk = c.ok;
            flashEnd = t + 1.2;
            if (c.ok) okN++;
            else rejN++;
          }
          if (c.w && !c.ok && !c.rej && c.x > 2.6) {
            c.rej = true;
            c.rx = c.x;
          }
          if (c.rej && c.rejT < 1) c.rejT = Math.min(1, c.rejT + dt * 1.6);
        }
        if (c.rej && c.rejT < 1) act = Math.max(act, c.rejT);
        c.g.position.set(c.rej ? c.rx : c.x, 1.15 - c.rejT * 0.4, c.rejT * 0.95);
        c.g.visible = c.x > -2.2 && c.rejT < 1;
      });

      const ext = st === "running" ? Math.pow(Math.max(0, Math.sin(t * 3.5)), 2) : 0;
      phead.position.z = -0.65 + 0.45 * ext;
      prod.position.z = phead.position.z - 0.3;
      const rz = -0.6 + 0.6 * Math.min(1, act * 2);
      rhead.position.z = rz;
      rod.position.z = rz - 0.3;

      const dc =
        st === "down"
          ? 0xe24b4a
          : st === "idle"
            ? 0xf5a623
            : t < flashEnd && !lastOk
              ? 0xe24b4a
              : 0x2ecc71;
      dsp.material.color.setHex(dc);
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildCel(ctx: BuilderContext) {
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
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    roughness: 0.05,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  disposables.push(glass);

  const rollers: THREE.Mesh[] = [];
  for (const cx of [-6.5, 9]) {
    for (let i = 0; i < 7; i++) rollers.push(cylZ(0.12, 1.5, cx - 3 + i, 0.9, 0, M(0x9aa5b4)));
    for (const z of [-0.85, 0.85]) box(7, 0.25, 0.1, cx, 0.85, z, rail);
    for (const x of [-3, 0, 3]) {
      for (const z of [-0.8, 0.8]) box(0.12, 0.8, 0.12, cx + x, 0.4, z, rail);
    }
  }

  box(6.4, 0.7, 2.4, 0, 0.35, 0, M(0xdfe5ee, { metalness: 0.2 }));
  box(9.2, 0.06, 1.0, 1.4, 0.96, 0, steel);
  box(3.2, 0.7, 1.8, 4.6, 0.35, 0, M(0xdfe5ee, { metalness: 0.2 }));

  for (const x of [-3.1, 3.1]) {
    for (const z of [-1.3, 1.3]) box(0.25, 3.6, 0.25, x, 1.8, z, blue);
  }
  for (const z of [-1.3, 1.3]) box(6.5, 0.25, 0.25, 0, 3.6, z, blue);
  for (const x of [-3.1, 0, 3.1]) box(0.25, 0.25, 2.6, x, 3.6, 0, blue);

  const guardMat = new THREE.MeshStandardMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  disposables.push(guardMat);
  for (const z of [-1.3, 1.3]) box(6.2, 2.3, 0.03, 0, 2.35, z, guardMat);

  box(0.5, 5.7, 0.5, -2.4, 2.85, -2.0, blue);
  cylZ(0.14, 1.5, -2.4, 4.7, -1.3, steel);
  cylZ(
    0.9,
    0.9,
    -2.4,
    4.7,
    -1.1,
    M(0xcfe8f5, { transparent: true, opacity: 0.6, metalness: 0, roughness: 0.2 }),
  );
  cylZ(0.3, 1.0, -2.4, 4.7, -1.1, M(0xf2f2f2, { metalness: 0.1 }));
  const reel = cylZ(0.05, 1.0, -2.4, 4.7, -1.1, M(0x888888));
  cylZ(0.1, 1.7, -1.4, 3.95, -0.3, steel);
  cylZ(0.1, 1.7, -1.4, 2.75, -0.3, steel);

  const webGeo = new THREE.PlaneGeometry(1.5, 1.2);
  disposables.push(webGeo);
  const web = new THREE.Mesh(webGeo, glass);
  web.position.set(-1.4, 3.35, -0.3);
  web.rotation.y = Math.PI / 2;
  group.add(web);

  box(1.5, 0.5, 1.5, -1.4, 2.2, 0, M(0xd2d8e2));
  for (const s of [-1, 1]) {
    const p = box(1.5, 0.05, 0.5, -0.6, 1.55, s * 0.62, steel);
    p.rotation.x = s * 0.6;
  }
  box(0.4, 0.7, 0.4, -1.4, 2.75, 0, M(0x8a95a5));

  const jaw = new THREE.Group();
  jaw.position.set(2.0, 2.15, 0);
  group.add(jaw);
  box(0.5, 0.35, 1.3, 0, 0, 0, steel, jaw);
  box(0.5, 0.06, 1.3, 0, -0.2, 0, M(0xff7a1a, { emissive: 0xff5500, emissiveIntensity: 0.5 }), jaw);
  box(0.2, 1.0, 0.2, 0, 0.7, 0, M(0x8a95a5), jaw);
  box(0.5, 0.2, 1.3, 2.0, 0.8, 0, M(0xff7a1a, { emissive: 0xff5500, emissiveIntensity: 0.5 }));

  for (const s of [-1, 1]) {
    box(9, 0.5, 0.1, 1.5, 1.3, s * 0.55, dark);
    box(
      2.6,
      0.35,
      0.12,
      4.6,
      1.3,
      s * 0.75,
      M(0xff7a1a, { emissive: 0xff5500, emissiveIntensity: 0.35 }),
    );
    box(0.3, 1.6, 0.3, 6.4, 0.8, s * 1.0, rail);
  }

  const lugs: { m: THREE.Mesh; i: number }[] = [];
  for (let i = 0; i < 8; i++) {
    for (const s of [-1, 1]) {
      lugs.push({
        m: box(0.25, 0.4, 0.06, 0, 1.3, s * 0.49, M(0xf2a516, { metalness: 0.1 })),
        i,
      });
    }
  }

  box(0.9, 0.6, 0.08, -3.7, 2.2, 2.0, M(0x2a3444));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  disposables.push(scrMat);
  const scrGeo = new THREE.PlaneGeometry(0.75, 0.45);
  disposables.push(scrGeo);
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.set(-3.7, 2.2, 2.05);
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
  cylY(0.16, 0.3, 3.1, 3.95, -1.3, lRedMat);
  cylY(0.16, 0.3, 3.1, 4.27, -1.3, lAmberMat);
  cylY(0.16, 0.3, 3.1, 4.59, -1.3, lGreenMat);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const pal = [0xe63946, 0x2a9d8f, 0x1d8ed6, 0x6a4c93, 0xf2a516];
  const N = 8;
  const L = 22;
  const X0 = -10;
  const prods: {
    g: THREE.Group;
    body: THREE.Mesh;
    shell: THREE.Group;
    fins: THREE.Group;
  }[] = [];
  const edge = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  disposables.push(edge);

  const pBodyGeo = new THREE.BoxGeometry(1.2, 0.9, 0.8);
  const pLabGeo = new THREE.PlaneGeometry(0.8, 0.5);
  const shGeo = new THREE.BoxGeometry(1.3, 1, 0.9);
  const edgeGeo = new THREE.EdgesGeometry(shGeo);
  disposables.push(pBodyGeo, pLabGeo, shGeo, edgeGeo);

  for (let i = 0; i < N; i++) {
    const pg = new THREE.Group();
    const bMat = M(pal[i % 5], { metalness: 0.05, roughness: 0.6 });
    const body = new THREE.Mesh(pBodyGeo, bMat);
    body.position.y = 0.45;
    pg.add(body);

    const labMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    disposables.push(labMat);
    const lab = new THREE.Mesh(pLabGeo, labMat);
    lab.position.set(0, 0.5, 0.401);
    pg.add(lab);

    const shell = new THREE.Group();
    pg.add(shell);
    const sh = new THREE.Mesh(shGeo, glass);
    sh.position.y = 0.5;
    shell.add(sh);
    const ln = new THREE.LineSegments(edgeGeo, edge);
    ln.position.copy(sh.position);
    shell.add(ln);

    const fins = new THREE.Group();
    pg.add(fins);
    for (const s of [-1, 1]) box(0.16, 0.6, 0.5, s * 0.72, 0.5, 0, glass, fins);

    pg.position.set(X0 + (i * L) / N, 1.02, 0);
    group.add(pg);
    prods.push({ g: pg, body, shell, fins });
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
      for (const p of prods) {
        p.g.position.x += v * dt;
        if (p.g.position.x > X0 + L) {
          p.g.position.x -= L;
          if (p.body.material instanceof THREE.MeshStandardMaterial) {
            p.body.material.color.setHex(pal[Math.floor(Math.random() * 5)]);
          }
        }
        const x = p.g.position.x;
        p.shell.visible = x > -0.5;
        p.shell.scale.set(1, 1, Math.min(1, Math.max(0.6, 0.6 + ((x + 0.5) / 1.5) * 0.4)));
        const k = Math.min(1, Math.max(0, (x - 2.1) / 0.9));
        p.fins.visible = x > 2.1;
        p.fins.scale.set(k, 1, 1);
      }
      for (const r of rollers) r.rotation.z -= (v * dt) / 0.12;
      for (const l of lugs) l.m.position.x = -3 + ((bp + l.i * 1.125) % 9);
      if (isRunning) {
        reel.rotation.z -= v * dt * 0.4;
        jaw.position.y = 2.15 - 0.12 * (0.5 + 0.5 * Math.sin(t * 4));
      }
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildRep(ctx: BuilderContext) {
  const { group, disposables } = ctx;
  const { M, box, cylY } = createHelpers(ctx);

  let st: MachineState = "running";
  let t = 0;
  let lp = -1;
  let placeY = 1.64;
  let speedMultiplier = 1;

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
    const g1 = new THREE.CylinderGeometry(0.16, 0.16, 0.8, 18);
    g1.rotateX(Math.PI / 2);
    disposables.push(g1);
    const m1 = new THREE.Mesh(g1, tubeM);
    m1.position.set(0, 0, -0.08);
    tg.add(m1);

    const g2 = new THREE.CylinderGeometry(0.07, 0.16, 0.16, 18);
    g2.rotateX(Math.PI / 2);
    disposables.push(g2);
    const m2 = new THREE.Mesh(g2, capM);
    m2.position.set(0, 0, 0.4);
    tg.add(m2);

    const g3 = new THREE.CylinderGeometry(0.08, 0.08, 0.14, 18);
    g3.rotateX(Math.PI / 2);
    disposables.push(g3);
    const m3 = new THREE.Mesh(g3, capM);
    m3.position.set(0, 0, 0.55);
    tg.add(m3);

    box(0.32, 0.03, 0.14, 0, 0, -0.55, tailM, tg);
    return tg;
  }

  box(12.6, 0.12, 1.5, -4.7, 0.94, 1.6, dark);
  for (const s of [-1, 1]) box(12.6, 0.3, 0.06, -4.7, 1.15, 1.6 + s * 0.78, steel);
  for (let i = 0; i < 8; i++) {
    for (const s of [-1, 1]) box(0.12, 0.9, 0.12, -10.5 + i * 1.7, 0.45, 1.6 + s * 0.7, rail);
  }
  box(0.1, 0.45, 1.4, 1.3, 1.25, 1.6, M(0xd22e2e));

  box(24, 0.12, 1.7, 0, 0.94, -1.6, dark);
  for (const s of [-1, 1]) box(24, 0.25, 0.06, 0, 1.1, -1.6 + s * 0.92, steel);
  for (let i = 0; i < 14; i++) {
    for (const s of [-1, 1]) box(0.12, 0.9, 0.12, -11 + i * 1.7, 0.45, -1.6 + s * 0.8, rail);
  }

  box(1.8, 1.9, 1.9, -12.9, 1.95, 1.6, M(0x6a7482));
  box(1.85, 0.3, 1.95, -12.9, 2.7, 1.6, M(0xff7a1a));
  const ch = box(2.6, 0.12, 1.4, -11.6, 1.55, 1.6, steel);
  ch.rotation.z = -0.3;

  box(2.2, 1.9, 1.7, -12.4, 1.95, -1.6, lite);
  for (let i = 0; i < 5; i++) box(2.25, 0.05, 1.75, -12.4, 1.2 + i * 0.35, -1.6, rail);

  for (const x of [-3.2, 3.2]) {
    for (const z of [-3.6, 3.6]) box(0.25, 4.4, 0.25, x, 2.2, z, blue);
  }
  for (const z of [-3.6, 3.6]) box(6.6, 0.25, 0.25, 0, 4.4, z, blue);
  for (const x of [-3.2, 3.2]) box(0.25, 0.25, 7.4, x, 4.4, 0, blue);

  const guardMat = new THREE.MeshStandardMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  disposables.push(guardMat);
  for (const z of [-3.6, 3.6]) box(6.4, 2.5, 0.03, 0, 2.4, z, guardMat);
  box(0.4, 0.35, 7.4, 0, 4.4, 0, M(0x9aa5b4));

  for (const z of [-2.8, -0.4]) box(0.3, 2.4, 0.3, 7.5, 1.2, z, blue);
  box(0.3, 0.3, 2.7, 7.5, 2.5, -1.6, blue);
  for (const s of [-1, 1]) {
    const f = box(1.8, 0.05, 0.5, 7.5, 2.0, -1.6 + s * 0.6, steel);
    f.rotation.x = s * 0.5;
  }

  const headG = new THREE.Group();
  group.add(headG);
  box(2.3, 0.12, 1.15, 0, 0, 0, steel, headG);
  for (let k = 0; k < 6; k++) cylY(0.08, 0.2, (k - 2.5) * 0.34, -0.16, 0, M(0x222831), headG);
  const carry = new THREE.Group();
  carry.position.y = -0.42;
  headG.add(carry);
  for (let k = 0; k < 6; k++) {
    const tMesh = makeTube();
    tMesh.position.x = (k - 2.5) * 0.34;
    carry.add(tMesh);
  }

  const car = box(0.8, 0.5, 1.0, 0, 4.4, 0, M(0xd22e2e));
  const col = cylY(0.1, 1, 0, 3, 0, steel);

  cylY(0.08, 2, 4.6, 1, 3.0, M(0x5b6675));
  box(0.9, 0.6, 0.08, 4.6, 2.2, 3.0, M(0x2a3444));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  disposables.push(scrMat);
  const scrGeo = new THREE.PlaneGeometry(0.75, 0.45);
  disposables.push(scrGeo);
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.set(4.6, 2.2, 3.05);
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
  cylY(0.16, 0.3, 3.2, 4.7, 3.6, lRedMat);
  cylY(0.16, 0.3, 3.2, 5.02, 3.6, lAmberMat);
  cylY(0.16, 0.3, 3.2, 5.34, 3.6, lGreenMat);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

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

  const kraft = M(0xc9a06b, { metalness: 0.02, roughness: 0.85 });
  const cts: {
    g: THREE.Group;
    layers: THREE.Group[];
    n: number;
    lm: number;
    i: number;
  }[] = [];
  for (let i = 0; i < 4; i++) {
    const cg = new THREE.Group();
    box(2.4, 0.05, 1.5, 0, 0.025, 0, kraft, cg);
    for (const s of [-1, 1]) {
      box(2.4, 1.4, 0.06, 0, 0.7, s * 0.72, kraft, cg);
      box(0.06, 1.4, 1.5, s * 1.17, 0.7, 0, kraft, cg);
    }
    const layers = [0, 1, 2, 3].map((L) => {
      const lg = new THREE.Group();
      lg.position.y = 0.22 + L * 0.34;
      cg.add(lg);
      for (let k = 0; k < 6; k++) {
        const tMesh = makeTube();
        tMesh.position.x = (k - 2.5) * 0.34;
        lg.add(tMesh);
      }
      return lg;
    });
    cg.position.set(0, 1.0, -1.6);
    group.add(cg);
    cts.push({ g: cg, layers, n: i === 3 ? 4 : 0, lm: 0, i });
  }

  const UP = 3.4;
  const YPICK = 1.58;
  const nearest = () =>
    cts.reduce((a, c) => (Math.abs(c.g.position.x) < Math.abs(a.g.position.x) ? c : a));

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      const isRunning = st === "running";
      if (isRunning) t += dt;

      const cyc = Math.floor(t / 6);
      const p = t - cyc * 6;
      if (p < lp) lp = -1;
      if (lp < 0.6 && p >= 0.6) {
        for (const b of bt) if (b.g.position.x > -0.9) b.picked = true;
      }
      if (lp < 1.5 && p >= 1.5) {
        placeY = 1.64 + Math.min(nearest().n, 3) * 0.34;
      }
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
        c.layers.forEach((l, L) => {
          l.visible = c.n > L;
        });
      }
      updateStandardVisuals(statusControls, st, t);
    },
  };
}
