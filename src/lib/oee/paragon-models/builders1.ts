import * as THREE from "three";
import type { MachineState } from "../machineModels";
import {
  createHelpers,
  updateStandardVisuals,
  type BuilderContext,
  type StandardStatusControls,
} from "./common";

export function buildFill(ctx: BuilderContext) {
  const { group, floor, disposables } = ctx;
  const { M, box, cylY } = createHelpers(ctx);

  let st: MachineState = "running";
  let t = 0;
  let flow = 0;
  let speedMultiplier = 1;

  if (floor) {
    const flGeo = new THREE.CircleGeometry(6, 48);
    disposables.push(flGeo);
    const flMat = M(0x888882, { transparent: true, opacity: 0.25 });
    const fl = new THREE.Mesh(flGeo, flMat);
    fl.rotation.x = -Math.PI / 2;
    group.add(fl);
  }

  box(8, 0.08, 0.9, 0, 0.96, 0, M(0x2b2e33, { roughness: 0.8 }));
  [-0.5, 0.5].forEach((z) => box(8, 0.14, 0.05, 0, 1.06, z, M(0xb9bec6)));
  [-3.6, -1.2, 1.2, 3.6].forEach((x) =>
    [-0.4, 0.4].forEach((z) => box(0.07, 0.92, 0.07, x, 0.46, z, M(0x8d939c))),
  );

  box(1.5, 2.4, 1.1, 0, 1.2, -1.2, M(0x6b3fa0));
  box(1.56, 0.05, 1.16, 0, 2.47, -1.2, M(0xc9ced6));
  box(1.0, 0.25, 0.75, 0, 2.3, -0.3, M(0x6b3fa0));

  const steel = M(0xd5d9de, { metalness: 0.7, roughness: 0.3 });
  [-0.3, 0.3].forEach((dx) =>
    [-0.3, 0.3].forEach((dz) => box(0.06, 0.9, 0.06, -1.4 + dx, 0.45, -1.2 + dz, M(0x8d939c))),
  );
  cylY(0.45, 1.1, -1.4, 1.45, -1.2, steel);
  cylY(0.1, 0.25, -1.4, 2.12, -1.2, steel);
  cylY(0.1, 0.08, -1.4, 2.28, -1.2, M(0x555b64));

  const ps = new THREE.Vector3(-1.4, 2.28, -1.2);
  const pe = new THREE.Vector3(-0.2, 2.3, -0.3);
  const pDist = ps.distanceTo(pe);
  const pGeo = new THREE.CylinderGeometry(0.04, 0.04, pDist, 12);
  pGeo.rotateX(Math.PI / 2);
  disposables.push(pGeo);
  const pipe = new THREE.Mesh(pGeo, M(0xb9bec6));
  pipe.position.copy(ps).add(pe).multiplyScalar(0.5);
  pipe.lookAt(pe);
  group.add(pipe);

  const pm = M(0xf4a3c0, { emissive: 0xf4a3c0, emissiveIntensity: 0.35 });
  const blobs: THREE.Mesh[] = [];
  const blobGeo = new THREE.SphereGeometry(0.05, 12, 12);
  disposables.push(blobGeo);
  for (let k = 0; k < 6; k++) {
    const b = new THREE.Mesh(blobGeo, pm);
    group.add(b);
    blobs.push(b);
  }

  box(0.04, 0.25, 0.04, -0.7, 1.12, 0.55, M(0x9aa0a8));
  box(0.09, 0.09, 0.09, -0.7, 1.28, 0.55, M(0x19c2d6, { emissive: 0x0a7d8a }));

  box(0.36, 0.26, 0.03, 0.45, 1.3, -0.64, M(0x111418));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
  disposables.push(scrMat);
  const scr = box(0.3, 0.2, 0.005, 0.45, 1.3, -0.62, scrMat);

  const noz = new THREE.Group();
  noz.position.set(0, 1.84, 0);
  group.add(noz);
  cylY(0.03, 0.6, 0, 0.3, 0, M(0x8d939c), noz);
  cylY(0.045, 0.08, 0, 0.04, 0, M(0x333840), noz);

  const strGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 16);
  disposables.push(strGeo);
  const stream = new THREE.Mesh(strGeo, pm);
  stream.visible = false;
  group.add(stream);

  cylY(0.02, 0.5, 0.6, 2.7, -1.2, M(0x888888), undefined, 8);
  const lGreenMat = M(0x2ecc71, { emissive: 0x2ecc71, emissiveIntensity: 0.08 });
  const lAmberMat = M(0xf5a623, { emissive: 0xf5a623, emissiveIntensity: 0.08 });
  const lRedMat = M(0xe24b4a, { emissive: 0xe24b4a, emissiveIntensity: 0.08 });
  cylY(0.08, 0.12, 0.6, 2.55, -1.2, lGreenMat, undefined, 16);
  cylY(0.08, 0.12, 0.6, 2.68, -1.2, lAmberMat, undefined, 16);
  cylY(0.08, 0.12, 0.6, 2.81, -1.2, lRedMat, undefined, 16);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const bm = M(0x9fd6d0, { transparent: true, opacity: 0.4, roughness: 0.2 });
  const lm = M(0xf4c6d7, { roughness: 0.3 });
  const bottles: { g: THREE.Group; liq: THREE.Mesh; done: boolean }[] = [];
  const bBodyGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 24);
  const bNeckGeo = new THREE.CylinderGeometry(0.06, 0.15, 0.1, 24);
  const bLipGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 24);
  const bLiqGeo = new THREE.CylinderGeometry(0.14, 0.14, 1, 24);
  disposables.push(bBodyGeo, bNeckGeo, bLipGeo, bLiqGeo);

  for (let i = 0; i < 10; i++) {
    const bg = new THREE.Group();
    const b1 = new THREE.Mesh(bBodyGeo, bm);
    b1.position.y = 0.25;
    bg.add(b1);
    const b2 = new THREE.Mesh(bNeckGeo, bm);
    b2.position.y = 0.55;
    bg.add(b2);
    const b3 = new THREE.Mesh(bLipGeo, bm);
    b3.position.y = 0.64;
    bg.add(b3);
    const liq = new THREE.Mesh(bLiqGeo, lm);
    liq.position.y = 0.04;
    liq.visible = false;
    bg.add(liq);
    bg.position.set(-4 + i * 0.8, 1.0, 0);
    group.add(bg);
    bottles.push({ g: bg, liq, done: false });
  }

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      t += dt;
      let cur: { x: number; h: number } | null = null;
      if (st === "running") {
        flow = (flow + dt * 0.4) % 1;
        bottles.forEach((b) => {
          let x = b.g.position.x + dt * 1.2;
          if (x > 4) {
            x -= 8;
            b.done = false;
          }
          b.g.position.x = x;
          const lv = Math.max(0, Math.min(1, (x + 0.35) / 0.7));
          const h = 0.42 * lv;
          b.liq.visible = h > 0.01;
          b.liq.scale.y = Math.max(h, 0.001);
          b.liq.position.y = 0.04 + h / 2;
          if (x > -0.35 && x < 0.35) cur = { x, h };
        });
      }
      const ty = cur ? 1.62 : 1.84;
      const tx = cur ? cur.x : -0.35;
      noz.position.y += (ty - noz.position.y) * 0.25;
      noz.position.x += (tx - noz.position.x) * 0.3;
      if (cur && noz.position.y < 1.7) {
        const top = 1.04 + cur.h;
        const len = noz.position.y - top;
        stream.visible = len > 0;
        stream.scale.y = Math.max(len, 0.001);
        stream.position.set(noz.position.x, top + len / 2, 0);
      } else {
        stream.visible = false;
      }
      blobs.forEach((o, i) => {
        o.visible = st === "running";
        const f = (flow + i / blobs.length) % 1;
        o.position.set(
          ps.x + (pe.x - ps.x) * f,
          ps.y + (pe.y - ps.y) * f,
          ps.z + (pe.z - ps.z) * f,
        );
      });
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildCap(ctx: BuilderContext) {
  const { group, floor, disposables } = ctx;
  const { M, box, cylY } = createHelpers(ctx);

  let st: MachineState = "running";
  let t = 0;
  let flow = 0;
  let speedMultiplier = 1;

  if (floor) {
    const flGeo = new THREE.CircleGeometry(6, 48);
    disposables.push(flGeo);
    const fl = new THREE.Mesh(flGeo, M(0x888882, { transparent: true, opacity: 0.25 }));
    fl.rotation.x = -Math.PI / 2;
    group.add(fl);
  }

  box(8, 0.08, 0.9, 0, 0.96, 0, M(0x2b2e33, { roughness: 0.8 }));
  [-0.5, 0.5].forEach((z) => box(8, 0.14, 0.05, 0, 1.06, z, M(0xb9bec6)));
  [-3.6, -1.2, 1.2, 3.6].forEach((x) =>
    [-0.4, 0.4].forEach((z) => box(0.07, 0.92, 0.07, x, 0.46, z, M(0x8d939c))),
  );

  box(1.5, 2.4, 1.1, 0, 1.2, -1.2, M(0x0f7a6b));
  box(1.56, 0.05, 1.16, 0, 2.47, -1.2, M(0xc9ced6));
  box(0.5, 0.25, 0.75, 0, 2.3, -0.3, M(0x0f7a6b));

  box(0.7, 1.4, 0.7, -1.3, 0.7, -1.2, M(0xc9ced6));
  box(0.8, 0.08, 0.8, -1.3, 1.44, -1.2, M(0x8d939c));
  const hop = cylY(0.4, 0.35, -1.3, 1.66, -1.2, M(0xe8ebef), undefined, 4);
  hop.rotation.y = Math.PI / 4;

  const cs = new THREE.Vector3(-1.3, 1.95, -1.2);
  const ce = new THREE.Vector3(0, 2.3, -0.3);
  const chute = box(0.1, 0.06, cs.distanceTo(ce), 0, 0, 0, M(0xb9bec6));
  chute.position.copy(cs).add(ce).multiplyScalar(0.5);
  chute.lookAt(ce);

  const capM = M(0x2b6fd6);
  const chCaps: THREE.Mesh[] = [];
  const capGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16);
  disposables.push(capGeo);
  for (let k = 0; k < 5; k++) {
    const c = new THREE.Mesh(capGeo, capM);
    group.add(c);
    chCaps.push(c);
  }

  box(0.04, 0.25, 0.04, -0.7, 1.12, 0.55, M(0x9aa0a8));
  box(0.09, 0.09, 0.09, -0.7, 1.28, 0.55, M(0x19c2d6, { emissive: 0x0a7d8a }));

  box(0.36, 0.26, 0.03, 0.35, 1.3, -0.64, M(0x111418));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
  disposables.push(scrMat);
  const scr = box(0.3, 0.2, 0.005, 0.35, 1.3, -0.62, scrMat);

  const chuck = new THREE.Group();
  chuck.position.set(0, 2.02, 0);
  group.add(chuck);
  cylY(0.045, 0.3, 0, 0.18, 0, M(0x8d939c), chuck);
  const head = cylY(0.1, 0.12, 0, 0, 0, M(0x333840), chuck);
  box(0.16, 0.02, 0.02, 0, -0.061, 0, M(0xe24b4a), head);

  cylY(0.02, 0.5, 0.6, 2.7, -1.2, M(0x888888), undefined, 8);
  const lGreenMat = M(0x2ecc71, { emissive: 0x2ecc71, emissiveIntensity: 0.08 });
  const lAmberMat = M(0xf5a623, { emissive: 0xf5a623, emissiveIntensity: 0.08 });
  const lRedMat = M(0xe24b4a, { emissive: 0xe24b4a, emissiveIntensity: 0.08 });
  cylY(0.08, 0.12, 0.6, 2.55, -1.2, lGreenMat, undefined, 16);
  cylY(0.08, 0.12, 0.6, 2.68, -1.2, lAmberMat, undefined, 16);
  cylY(0.08, 0.12, 0.6, 2.81, -1.2, lRedMat, undefined, 16);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const bm = M(0x3fb6a8, { transparent: true, opacity: 0.85, roughness: 0.2 });
  const bottles: { g: THREE.Group; cap: THREE.Mesh }[] = [];
  const bBodyGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 24);
  const bNeckGeo = new THREE.CylinderGeometry(0.06, 0.15, 0.1, 24);
  const bLipGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 24);
  const bCapGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.07, 24);
  disposables.push(bBodyGeo, bNeckGeo, bLipGeo, bCapGeo);

  for (let i = 0; i < 10; i++) {
    const bg = new THREE.Group();
    const b1 = new THREE.Mesh(bBodyGeo, bm);
    b1.position.y = 0.25;
    bg.add(b1);
    const b2 = new THREE.Mesh(bNeckGeo, bm);
    b2.position.y = 0.55;
    bg.add(b2);
    const b3 = new THREE.Mesh(bLipGeo, bm);
    b3.position.y = 0.64;
    bg.add(b3);
    const cap = new THREE.Mesh(bCapGeo, capM);
    cap.position.y = 0.71;
    cap.visible = false;
    bg.add(cap);
    bg.position.set(-4 + i * 0.8, 1.0, 0);
    group.add(bg);
    bottles.push({ g: bg, cap });
  }

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      t += dt;
      let dip = 0;
      if (st === "running") {
        flow = (flow + dt * 0.35) % 1;
        bottles.forEach((b) => {
          b.g.position.x += dt * 1.2;
          if (b.g.position.x > 4) {
            b.g.position.x -= 8;
            b.cap.visible = false;
          }
          const d = Math.abs(b.g.position.x);
          dip = Math.max(dip, 1 - d / 0.3);
          if (!b.cap.visible && b.g.position.x > 0.12) {
            b.cap.visible = true;
          }
        });
      }
      dip = Math.max(0, dip);
      const ty = 2.02 - 0.18 * dip;
      chuck.position.y += (ty - chuck.position.y) * 0.25;
      if (st === "running" && dip > 0.3) head.rotation.y += dt * 10;

      chCaps.forEach((c, i) => {
        c.visible = st === "running";
        const f = (flow + i / chCaps.length) % 1;
        c.position.set(
          cs.x + (ce.x - cs.x) * f,
          cs.y + (ce.y - cs.y) * f + 0.05,
          cs.z + (ce.z - cs.z) * f,
        );
      });
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildLab(ctx: BuilderContext) {
  const { group, floor, disposables } = ctx;
  const { M, box, cylY } = createHelpers(ctx);

  let st: MachineState = "running";
  let t = 0;
  let speedMultiplier = 1;

  if (floor) {
    const flGeo = new THREE.CircleGeometry(6, 48);
    disposables.push(flGeo);
    const fl = new THREE.Mesh(flGeo, M(0x888882, { transparent: true, opacity: 0.25 }));
    fl.rotation.x = -Math.PI / 2;
    group.add(fl);
  }

  box(8, 0.08, 0.9, 0, 0.96, 0, M(0x2b2e33, { roughness: 0.8 }));
  [-0.5, 0.5].forEach((z) => box(8, 0.14, 0.05, 0, 1.06, z, M(0xb9bec6)));
  [-3.6, -1.2, 1.2, 3.6].forEach((x) =>
    [-0.4, 0.4].forEach((z) => box(0.07, 0.92, 0.07, x, 0.46, z, M(0x8d939c))),
  );

  box(1.5, 1.9, 1.1, 0, 0.95, -1.2, M(0x1f5fa8));
  box(1.56, 0.05, 1.16, 0, 1.92, -1.2, M(0xc9ced6));

  function makeReel(r: number, x: number) {
    const rGeo = new THREE.CylinderGeometry(r, r, 0.06, 24);
    rGeo.rotateX(Math.PI / 2);
    disposables.push(rGeo);
    const rg = new THREE.Mesh(rGeo, M(0xe8ebef));
    rg.position.set(x, 1.65, -0.6);
    group.add(rg);
    cylY(r * 0.3, 0.08, 0, 0, 0, M(0x555b64), rg);
    box(r * 1.6, 0.012, 0.04, 0, 0.035, 0, M(0x555b64), rg);
    return rg;
  }
  const reels = [makeReel(0.3, -0.45), makeReel(0.2, 0.35)];

  box(0.55, 0.03, 0.4, 0, 1.25, -0.45, M(0xd7dbe0));
  cylY(0.05, 0.3, 0.3, 1.25, -0.25, M(0x333840));
  box(0.04, 0.25, 0.04, -0.7, 1.12, 0.55, M(0x9aa0a8));
  box(0.09, 0.09, 0.09, -0.7, 1.28, 0.55, M(0x19c2d6, { emissive: 0x0a7d8a }));

  box(0.36, 0.26, 0.03, 0.35, 1.3, -0.64, M(0x111418));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
  disposables.push(scrMat);
  const scr = box(0.3, 0.2, 0.005, 0.35, 1.3, -0.62, scrMat);

  cylY(0.02, 0.5, 0.6, 2.2, -1.2, M(0x888888), undefined, 8);
  const lGreenMat = M(0x2ecc71, { emissive: 0x2ecc71, emissiveIntensity: 0.08 });
  const lAmberMat = M(0xf5a623, { emissive: 0xf5a623, emissiveIntensity: 0.08 });
  const lRedMat = M(0xe24b4a, { emissive: 0xe24b4a, emissiveIntensity: 0.08 });
  cylY(0.08, 0.12, 0.6, 2.0, -1.2, lGreenMat, undefined, 16);
  cylY(0.08, 0.12, 0.6, 2.13, -1.2, lAmberMat, undefined, 16);
  cylY(0.08, 0.12, 0.6, 2.26, -1.2, lRedMat, undefined, 16);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const bm = M(0x3fb6a8, { transparent: true, opacity: 0.85, roughness: 0.2 });
  const labM = M(0xf2b84b, { side: THREE.DoubleSide });
  const bottles: { g: THREE.Group; lab: THREE.Mesh }[] = [];
  const bBodyGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 24);
  const bNeckGeo = new THREE.CylinderGeometry(0.06, 0.15, 0.1, 24);
  const bLipGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 24);
  const bCapGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.07, 24);
  const bLabGeo = new THREE.CylinderGeometry(0.152, 0.152, 0.22, 24, 1, true);
  disposables.push(bBodyGeo, bNeckGeo, bLipGeo, bCapGeo, bLabGeo);

  for (let i = 0; i < 10; i++) {
    const bg = new THREE.Group();
    const b1 = new THREE.Mesh(bBodyGeo, bm);
    b1.position.y = 0.25;
    bg.add(b1);
    const b2 = new THREE.Mesh(bNeckGeo, bm);
    b2.position.y = 0.55;
    bg.add(b2);
    const b3 = new THREE.Mesh(bLipGeo, bm);
    b3.position.y = 0.64;
    bg.add(b3);
    const cap = new THREE.Mesh(bCapGeo, M(0x2b6fd6));
    cap.position.y = 0.71;
    bg.add(cap);
    const lab = new THREE.Mesh(bLabGeo, labM);
    lab.position.y = 0.25;
    lab.visible = false;
    bg.add(lab);
    bg.position.set(-4 + i * 0.8, 1.0, 0);
    group.add(bg);
    bottles.push({ g: bg, lab });
  }

  return {
    setState(s: MachineState, sf = 1.0) {
      st = s;
      speedMultiplier = sf;
    },
    update(dtRaw: number) {
      const dt = dtRaw * speedMultiplier;
      t += dt;
      if (st === "running") {
        bottles.forEach((b) => {
          b.g.position.x += dt * 1.2;
          if (b.g.position.x > 4) {
            b.g.position.x -= 8;
            b.lab.visible = false;
          }
          if (!b.lab.visible && b.g.position.x > 0.15) {
            b.lab.visible = true;
          }
        });
        reels.forEach((r) => {
          r.rotation.y += dt * 1.2;
        });
      }
      updateStandardVisuals(statusControls, st, t);
    },
  };
}

export function buildShr(ctx: BuilderContext) {
  const { group, disposables } = ctx;
  const { M, box, cylY } = createHelpers(ctx);

  let st: MachineState = "running";
  let t = 0;
  let speedMultiplier = 1;

  const belt = M(0x2b2f36, { metalness: 0.1, roughness: 0.8 });
  box(9, 0.12, 1.5, -5.5, 1, 0, belt);
  box(9, 0.12, 1.5, 5.5, 1, 0, M(0x2b2f36, { metalness: 0.1 }));

  for (const cx of [-5.5, 5.5]) {
    for (const z of [-0.85, 0.85]) box(9, 0.3, 0.08, cx, 1.25, z, M(0xc3ccd8));
    for (const x of [-4.5, 0, 4.5]) {
      for (const z of [-0.7, 0.7]) box(0.12, 0.95, 0.12, cx + x, 0.5, z, M(0x8a95a5));
    }
  }

  const blue = M(0x1c5fd4, { metalness: 0.3 });
  for (const z of [-1.5, 1.5]) box(3, 3.2, 0.9, -3.5, 1.6, z, blue);
  box(3, 0.8, 3.9, -3.5, 3.4, 0, M(0x1c5fd4));
  box(3.1, 0.15, 4, -3.5, 3.85, 0, M(0xdfe5ee));

  cylY(0.32, 1.4, -3.5, 2.4, 0, M(0xaab4c2, { metalness: 0.8, roughness: 0.2 }));

  const reelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.6, 24);
  reelGeo.rotateX(Math.PI / 2);
  disposables.push(reelGeo);
  const reel = new THREE.Mesh(reelGeo, M(0xf2a516, { metalness: 0.1 }));
  reel.position.set(-3.5, 4.7, -1.2);
  group.add(reel);

  const hubGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.7, 24);
  hubGeo.rotateX(Math.PI / 2);
  disposables.push(hubGeo);
  const hub = new THREE.Mesh(hubGeo, M(0x444b57));
  hub.position.set(-3.5, 4.7, -1.2);
  group.add(hub);

  box(0.6, 1, 0.5, -3.5, 4.4, -0.4, M(0xdfe5ee));

  const tm = M(0xb9c2cf, { metalness: 0.7, roughness: 0.35 });
  for (const z of [-1.3, 1.3]) box(6, 2.4, 0.35, 2.5, 2.1, z, tm);
  box(6, 0.4, 3, 2.5, 3.5, 0, tm);
  for (let i = 0; i < 5; i++) cylY(0.22, 0.5, 0.4 + i * 1.2, 3.95, 0, M(0x6a7482));
  box(6.2, 0.2, 0.1, 2.5, 1.15, -1.4, M(0x8a95a5));

  box(0.9, 1.6, 0.8, -6.2, 1.8, -2.2, M(0x2a3444));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x33d6ff });
  disposables.push(scrMat);
  const scrGeo = new THREE.PlaneGeometry(0.7, 0.5);
  disposables.push(scrGeo);
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.set(-6.2, 2.2, -1.79);
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
  cylY(0.16, 0.3, -2.3, 4.45, 1.5, lRedMat);
  cylY(0.16, 0.3, -2.3, 4.77, 1.5, lAmberMat);
  cylY(0.16, 0.3, -2.3, 5.09, 1.5, lGreenMat);

  const statusControls: StandardStatusControls = {
    scrMesh: scr,
    lamps: [
      { mat: lGreenMat, role: "green" },
      { mat: lAmberMat, role: "amber" },
      { mat: lRedMat, role: "red" },
    ],
  };

  const pal = [0xe63946, 0x2a9d8f, 0xf4a261, 0x6a4c93, 0x1d8ed6, 0xf2cc0f];
  const bots: { g: THREE.Group; sl: THREE.Mesh }[] = [];
  const N = 12;
  const L = 19.2;
  const X0 = -9.6;

  const bBodyGeo = new THREE.CylinderGeometry(0.34, 0.34, 1.1, 24);
  const bShGeo = new THREE.CylinderGeometry(0.14, 0.34, 0.3, 20);
  const bCapGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.16, 20);
  const bSleeveGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.8, 28, 1, true);
  disposables.push(bBodyGeo, bShGeo, bCapGeo, bSleeveGeo);

  for (let i = 0; i < N; i++) {
    const bg = new THREE.Group();
    const b1 = new THREE.Mesh(bBodyGeo, M(0xf5f7fa, { metalness: 0.05, roughness: 0.3 }));
    b1.position.y = 0.55;
    bg.add(b1);
    const sh = new THREE.Mesh(bShGeo, M(0xf5f7fa, { metalness: 0.05, roughness: 0.3 }));
    sh.position.y = 1.25;
    bg.add(sh);
    const cp = new THREE.Mesh(bCapGeo, M(0x222831));
    cp.position.y = 1.48;
    bg.add(cp);
    const sl = new THREE.Mesh(
      bSleeveGeo,
      M(pal[i % 6], { metalness: 0.05, roughness: 0.45, side: THREE.DoubleSide }),
    );
    sl.position.y = 0.6;
    bg.add(sl);
    bg.position.set(X0 + (i * L) / N, 1.06, 0);
    group.add(bg);
    bots.push({ g: bg, sl });
  }

  const steamGeo = new THREE.SphereGeometry(0.25, 10, 10);
  disposables.push(steamGeo);
  const steam: { s: THREE.Mesh; t: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    disposables.push(sMat);
    const s = new THREE.Mesh(steamGeo, sMat);
    group.add(s);
    steam.push({ s, t: Math.random() });
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
      for (const b of bots) {
        b.g.position.x += v * dt;
        if (b.g.position.x > X0 + L) {
          b.g.position.x -= L;
          if (b.sl.material instanceof THREE.MeshStandardMaterial) {
            b.sl.material.color.setHex(pal[Math.floor(Math.random() * 6)]);
          }
        }
        const x = b.g.position.x;
        b.sl.visible = x > -3.7;
        const k = Math.min(1, Math.max(0, (x - 0.2) / 4.5));
        const sc = 1.13 - 0.13 * k;
        b.sl.scale.set(sc, 1 - 0.02 * k, sc);
      }
      if (isRunning) {
        reel.rotation.y -= dt * 1.2;
      }
      for (const p of steam) {
        p.t = (p.t + (isRunning ? dt * 0.5 : 0)) % 1;
        p.s.position.set(
          1 + ((p.t * 7) % 5) * 0.8 - 0.4 + Math.sin(p.t * 9) * 0.2,
          4.3 + p.t * 1.8,
          Math.cos(p.t * 7) * 0.4,
        );
        if (p.s.material instanceof THREE.MeshBasicMaterial) {
          p.s.material.opacity = 0.3 * (1 - p.t);
        }
        p.s.scale.setScalar(0.6 + p.t * 1.4);
      }
      updateStandardVisuals(statusControls, st, t);
    },
  };
}
