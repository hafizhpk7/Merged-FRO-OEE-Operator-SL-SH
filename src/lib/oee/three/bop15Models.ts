import * as THREE from "three";

/**
 * BOP15 shared library - static isometric flat-shaded models.
 * Faithful port of the reference library script MC.
 * Local machine coordinates (metres):
 *   x = line direction (in-port x=0, out-port x=W)
 *   y = up
 *   z = depth (back z=0, front z=D)
 * Conveyor axis is at z = D/2, belt top y = CONV_Y.
 */

export const CONV_Y = 0.78;

export const PAL = {
  body: 0xbec1c1,
  roof: 0xc7caca,
  mid: 0xa3a6a7,
  dark: 0x3c4044,
  back: 0x8c9092,
  floor: 0x878b8d,
  black: 0x16181a,
  red: 0xd62828,
  green: 0x22b04b,
  blue: 0x2a5db8,
  yellow: 0xc9a227,
  belt: 0x484b50,
  rail: 0xcfd2d3,
  steel: 0x9ea2a4,
  feet: 0x7a7d7f,
  hmi: 0x8d9092,
  screen: 0x25282b,
  glass: 0xdfe7ec,
  beige: 0xd8cdb4,
  orange: 0xd9822b,
  tube: 0x8f9395,
  tubeDark: 0x6a6e70,
} as const;

/**
 * Section 4.1: Hide the models' own static green indicator pieces:
 * - LBF15: the two green boxes of size 0.036 x 0.036 x 0.012 at the top-left of the front housing
 * - LCM: the roof pole (cylinder radius 0.008, height 0.16) and green cube 0.05 x 0.05 x 0.05 with green palette color
 */
export function hideStatic(g: THREE.Object3D): void {
  g.traverse((o: THREE.Object3D) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geo = o.geometry as unknown as {
      parameters?: {
        width?: number;
        height?: number;
        depth?: number;
        radiusTop?: number;
      };
    };
    const p = geo.parameters || {};
    if (
      p.width &&
      Math.abs(p.width - 0.036) < 1e-6 &&
      p.height &&
      Math.abs(p.height - 0.036) < 1e-6
    ) {
      o.visible = false;
    }
    const mat = o.material as THREE.MeshLambertMaterial;
    if (
      p.width &&
      Math.abs(p.width - 0.05) < 1e-6 &&
      p.height &&
      Math.abs(p.height - 0.05) < 1e-6 &&
      p.depth &&
      Math.abs(p.depth - 0.05) < 1e-6 &&
      mat?.color &&
      mat.color.getHex() === PAL.green
    ) {
      o.visible = false;
    }
    if (
      p.radiusTop &&
      Math.abs(p.radiusTop - 0.008) < 1e-6 &&
      p.height &&
      Math.abs(p.height - 0.16) < 1e-6
    ) {
      o.visible = false;
    }
  });
}

const matCache = new Map<string, THREE.MeshLambertMaterial>();

export function mat(c: number, o?: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  const k = c + JSON.stringify(o || {});
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o || {}));
    matCache.set(k, m);
  }
  return m;
}

export function clearMatCache(): void {
  matCache.forEach((m) => m.dispose());
  matCache.clear();
}

/** Box positioned by MIN corner (x,y,z) and size (w,h,d) */
export function B(
  g: THREE.Group | THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  c: number,
  o?: THREE.MeshLambertMaterialParameters,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o));
  m.position.set(x + w / 2, y + h / 2, z + d / 2);
  g.add(m);
  return m;
}

/** Cylinder by CENTRE (cx,cy,cz), axis 'x' | 'y' | 'z' */
export function C(
  g: THREE.Group | THREE.Object3D,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  len: number,
  axis: "x" | "y" | "z",
  c: number,
  seg?: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 20), mat(c));
  if (axis === "x") m.rotation.z = Math.PI / 2;
  else if (axis === "z") m.rotation.x = Math.PI / 2;
  m.position.set(cx, cy, cz);
  g.add(m);
  return m;
}

export function glass(
  g: THREE.Group | THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): THREE.Mesh {
  return B(g, x, y, z, w, h, d, PAL.glass, { transparent: true, opacity: 0.16, depthWrite: false });
}

export interface ConveyorOptions {
  width?: number;
  legs?: boolean;
}

export function conveyor(
  g: THREE.Group | THREE.Object3D,
  x0: number,
  x1: number,
  zc: number,
  y: number,
  o?: ConveyorOptions,
): THREE.Group | THREE.Object3D {
  const opts = o || {};
  const w = opts.width || 0.26;
  const len = x1 - x0;
  B(g, x0, y - 0.05, zc - w / 2, len, 0.05, w, PAL.belt);
  B(g, x0, y - 0.13, zc - w / 2 - 0.02, len, 0.13, 0.02, PAL.steel);
  B(g, x0, y - 0.13, zc + w / 2, len, 0.13, 0.02, PAL.steel);

  // guide rails: posts + two rods each side
  const n = Math.max(2, Math.round(len / 0.4) + 1);
  [-1, 1].forEach((s) => {
    const zr = zc + s * (w / 2 + 0.03);
    for (let i = 0; i < n; i++) {
      const px = x0 + 0.03 + ((len - 0.06) * i) / (n - 1);
      B(g, px - 0.009, y - 0.01, zr - 0.009, 0.018, 0.13, 0.018, PAL.rail);
    }
    B(g, x0, y + 0.04, zr - 0.006, len, 0.012, 0.012, PAL.rail);
    B(g, x0, y + 0.11, zr - 0.006, len, 0.012, 0.012, PAL.rail);
  });

  if (opts.legs) {
    const nl = Math.max(2, Math.round(len / 0.9) + 1);
    for (let i = 0; i < nl; i++) {
      const px = x0 + 0.08 + ((len - 0.16) * i) / (nl - 1);
      [-1, 1].forEach((s) => {
        B(g, px - 0.02, 0.0, zc + s * (w / 2 + 0.05) - 0.02, 0.04, y - 0.13, 0.04, PAL.steel);
      });
      B(g, px - 0.02, 0.35, zc - (w / 2 + 0.05), 0.04, 0.025, w + 0.1, PAL.steel); // cross brace
      [-1, 1].forEach((s) => {
        B(g, px - 0.035, 0, zc + s * (w / 2 + 0.05) - 0.035, 0.07, 0.012, 0.07, PAL.feet);
      });
    }
  }
  return g;
}

export function hmi(
  g: THREE.Group | THREE.Object3D,
  x: number,
  y: number,
  z: number,
  s: number = 1,
) {
  B(g, x, y, z, 0.2 * s, 0.19 * s, 0.06 * s, PAL.hmi);
  B(g, x + 0.025 * s, y + 0.045 * s, z + 0.06 * s, 0.15 * s, 0.11 * s, 0.006, PAL.screen);
  const cols = [PAL.green, 0xe8e8e8, PAL.yellow, PAL.blue, PAL.red];
  cols.forEach((c, i) => {
    B(g, x + (0.03 + i * 0.03) * s, y + 0.012 * s, z + 0.06 * s, 0.014 * s, 0.014 * s, 0.006, c);
  });
  // blue cable
  B(g, x + 0.15 * s, y - 0.22 * s, z + 0.02 * s, 0.008, 0.22 * s, 0.008, PAL.blue);
}

export function hinges(g: THREE.Group | THREE.Object3D, x: number, zFront: number, ys: number[]) {
  ys.forEach((y) => {
    B(g, x, y, zFront, 0.032, 0.05, 0.02, PAL.black);
  });
}

export interface LBF15Options {
  rightWall?: boolean;
}

/**
 * LBF15 (ROBO-flex C80) W=1.10 D=0.85 H=1.40
 */
export function LBF15(o?: LBF15Options): THREE.Group {
  const opts = o || {};
  const W = 1.1;
  const D = 0.85;
  const H = 1.4;
  const g = new THREE.Group();
  g.userData = { W, D, H };

  // feet + base plinth
  [
    [0.06, 0.06],
    [W - 0.06, 0.06],
    [0.06, D - 0.06],
    [W - 0.06, D - 0.06],
  ].forEach((p) => {
    C(g, p[0], 0.02, p[1], 0.03, 0.04, "y", PAL.feet);
  });
  B(g, 0, 0.04, 0, W, 0.09, D, PAL.mid);
  B(g, 0.02, 0.13, 0.02, W - 0.04, 0.02, D - 0.04, PAL.floor);

  // back wall
  B(g, 0, 0.13, 0, W, 0.88, 0.03, PAL.back);

  // right wall (only at the last unit of a chain)
  if (opts.rightWall !== false) B(g, W - 0.03, 0.13, 0.02, 0.03, 0.49, D - 0.02, PAL.body);

  // posts
  B(g, W - 0.045, 0.13, D - 0.045, 0.045, 0.89, 0.045, PAL.body);
  B(g, 0, 0.13, D - 0.045, 0.045, 0.89, 0.045, PAL.body);

  // dark door strip, front-left
  B(g, 0.0, 0.17, D - 0.012, 0.06, 0.8, 0.014, PAL.dark);
  hinges(g, 0.006, D, [0.24, 0.52, 0.86]);
  hinges(g, W - 0.04, D, [0.3, 0.56, 0.86]);

  // glass front + rails
  glass(g, 0.06, 0.16, D - 0.012, W - 0.1, 0.84, 0.008);
  B(g, 0.06, 0.985, D - 0.035, W - 0.1, 0.03, 0.035, PAL.rail);
  B(g, 0.06, 0.13, D - 0.035, W - 0.1, 0.03, 0.035, PAL.rail);

  // inside: conveyor, legs, door rods, HMI
  conveyor(g, 0, W, D / 2, CONV_Y);
  B(g, 0.22, 0.15, D / 2 - 0.1, 0.035, CONV_Y - 0.28, 0.035, PAL.rail);
  B(g, W - 0.25, 0.15, D / 2 - 0.1, 0.035, CONV_Y - 0.28, 0.035, PAL.rail);
  C(g, 0.4, 0.58, D - 0.03, 0.008, 0.78, "y", PAL.rail, 10);
  C(g, 0.46, 0.58, D - 0.03, 0.008, 0.78, "y", PAL.rail, 10);
  hmi(g, W - 0.4, 0.46, D - 0.14);

  // housing + roof
  B(g, 0, 1.01, 0, W, 0.37, D, PAL.body);
  B(g, 0, 1.38, -0.02, W, 0.03, D + 0.04, PAL.roof);

  // front panel details
  B(g, 0.14, 1.09, D, 0.31, 0.22, 0.012, PAL.dark);
  B(g, 0.27, 1.12, D + 0.012, 0.11, 0.16, 0.006, PAL.black);
  C(g, 0.2, 1.26, D + 0.02, 0.018, 0.016, "z", PAL.red);
  C(g, 0.18, 1.17, D + 0.016, 0.012, 0.01, "z", PAL.black);
  B(g, 0.78, 1.19, D, 0.09, 0.055, 0.008, 0x2b3f66);
  B(g, 0.795, 1.2, D + 0.008, 0.06, 0.035, 0.004, PAL.blue);
  B(g, 0.02, 1.27, D, 0.036, 0.036, 0.012, PAL.green);
  B(g, 0.02, 1.21, D, 0.036, 0.036, 0.012, PAL.green);

  g.position.set(0, 0, 0);
  return g;
}

/**
 * LBC (Nexus C6) W=0.95 D=0.75 H=1.30
 */
export function LBC(): THREE.Group {
  const W = 0.95;
  const D = 0.75;
  const H = 1.3;
  const g = new THREE.Group();
  g.userData = { W, D, H };

  [
    [0.07, 0.07],
    [W - 0.07, 0.07],
    [0.07, D - 0.07],
    [W - 0.07, D - 0.07],
  ].forEach((p) => {
    C(g, p[0], 0.025, p[1], 0.03, 0.05, "y", PAL.orange);
  });

  // lower cabinet
  B(g, 0, 0.05, 0, W, 0.07, D, PAL.mid);
  B(g, 0.02, 0.12, 0.02, W - 0.04, 0.46, D - 0.04, PAL.body);

  // two dark doors + handle
  B(g, 0.05, 0.16, D - 0.03, 0.4, 0.38, 0.012, PAL.dark);
  B(g, 0.49, 0.16, D - 0.03, 0.4, 0.38, 0.012, PAL.dark);
  B(g, 0.455, 0.3, D - 0.026, 0.028, 0.08, 0.022, PAL.black);
  hinges(g, W - 0.035, D - 0.035, [0.22]);

  // working deck
  B(g, 0, 0.58, 0, W, 0.04, D, PAL.mid);

  // upper open area: back wall, left dark panel, posts
  B(g, 0, 0.62, 0, W, 0.62, 0.03, PAL.back);
  B(g, 0, 0.62, 0, 0.04, 0.62, D, PAL.body); // left wall
  B(g, 0.0, 0.64, D - 0.02, 0.07, 0.58, 0.018, PAL.dark); // dark left front panel
  hinges(g, 0.0, D - 0.005, [0.7, 0.92, 1.12]);
  B(g, W - 0.045, 0.62, D - 0.045, 0.045, 0.6, 0.045, PAL.body); // front-right post
  B(g, 0.45, 0.62, D - 0.045, 0.03, 0.6, 0.03, PAL.rail); // slim posts
  B(g, 0.51, 0.62, D - 0.045, 0.03, 0.6, 0.03, PAL.rail);
  hinges(g, W - 0.04, D - 0.005, [0.7, 1.12]);

  // roof
  B(g, 0, 1.22, 0, W, 0.08, D, PAL.body);
  B(g, -0.0, 1.29, -0.02, W, 0.02, D + 0.04, PAL.roof);

  // conveyor + guide markers
  conveyor(g, 0, W, D / 2, CONV_Y);
  B(g, 0.15, CONV_Y + 0.12, D / 2 + 0.17, 0.05, 0.03, 0.02, PAL.green);
  B(g, W - 0.3, CONV_Y + 0.12, D / 2 + 0.17, 0.05, 0.03, 0.02, PAL.green);

  // operator panel on front post (x ~0.63)
  B(g, 0.58, 0.64, D - 0.03, 0.14, 0.4, 0.05, PAL.hmi);
  B(g, 0.6, 0.88, D + 0.02, 0.1, 0.12, 0.006, PAL.screen);
  C(g, 0.625, 0.78, D + 0.02, 0.014, 0.01, "z", PAL.black);
  C(g, 0.675, 0.78, D + 0.02, 0.014, 0.01, "z", PAL.green);
  C(g, 0.625, 0.71, D + 0.02, 0.014, 0.01, "z", PAL.black);
  C(g, 0.675, 0.7, D + 0.024, 0.02, 0.014, "z", PAL.red);
  B(g, 0.74, 0.66, D + 0.02, 0.008, 0.2, 0.008, PAL.blue);

  return g;
}

/**
 * LCM (IWK) W=2.30 D=1.10 H=1.80
 */
export function LCM(): THREE.Group {
  const W = 2.3;
  const D = 1.1;
  const H = 1.8;
  const g = new THREE.Group();
  g.userData = { W, D, H };

  const LW = 1.0; // left cabinet width
  const CZ0 = 0.78;
  const CD = D - CZ0; // left cabinet sits at the FRONT; the in-line belt passes behind it

  // base frame under left cabinet (tubular)
  [
    [0.04, CZ0 + 0.03],
    [LW - 0.07, CZ0 + 0.03],
    [0.04, D - 0.07],
    [LW - 0.07, D - 0.07],
  ].forEach((p) => {
    B(g, p[0], 0.0, p[1], 0.04, 0.34, 0.04, PAL.steel);
  });
  B(g, 0.0, 0.0, CZ0 - 0.08, 0.05, 0.05, CD + 0.08, PAL.steel); // foot rail left
  B(g, LW - 0.05, 0.0, CZ0 - 0.08, 0.05, 0.05, CD + 0.08, PAL.steel);
  B(g, 0.0, 0.34, CZ0 - 0.02, LW, 0.04, CD + 0.02, PAL.steel);
  B(g, 0.0, 0.02, D - 0.07, LW, 0.04, 0.04, PAL.steel); // low front bar

  // left cabinet
  B(g, 0.0, 0.38, CZ0, LW, 0.62, CD, PAL.body);
  for (let i = 0; i < 4; i++) {
    B(g, 0.05 + i * 0.235, 0.46, D - 0.004, 0.19, 0.3, 0.012, PAL.dark);
  }

  // hanging black units under the cabinet
  B(g, 0.3, 0.16, CZ0 + 0.02, 0.42, 0.22, 0.26, PAL.tubeDark);
  B(g, 0.52, 0.1, CZ0 + 0.04, 0.24, 0.12, 0.2, PAL.black);

  // blue tray with two beige items
  B(g, 0.27, 1.0, CZ0 + 0.08, 0.48, 0.06, 0.2, PAL.blue);
  B(g, 0.34, 1.062, CZ0 + 0.13, 0.12, 0.014, 0.05, PAL.beige);
  B(g, 0.52, 1.062, CZ0 + 0.15, 0.12, 0.014, 0.05, PAL.beige);

  // long rails on top
  C(g, LW / 2 + 0.02, 1.12, D - 0.03, 0.014, LW + 0.1, "x", PAL.rail, 12);
  C(g, LW / 2, 1.09, CZ0 + 0.04, 0.01, LW, "x", PAL.rail, 10);

  // big tube on the back panel
  C(g, 0.95, 1.2, 0.09, 0.05, 0.9, "x", PAL.tube, 18);

  // yellow lamp plate
  B(g, -0.12, 0.55, D - 0.14, 0.06, 0.3, 0.03, PAL.yellow);

  // right section --------------------------------------
  const RX = LW;
  const RW = W - LW;

  // floor and back panel
  B(g, RX, 0.28, 0.03, RW, 0.03, D - 0.06, PAL.floor);
  B(g, RX, 0.04, 0.0, RW, 0.24, 0.03, PAL.back);
  B(g, 0.55, 0.28, 0.0, W - 0.55, 1.24, 0.03, PAL.back); // tall back panel

  // frame legs
  [
    [RX + 0.01, 0.03],
    [RX + 0.01, D - 0.06],
    [W - 0.05, 0.03],
    [W - 0.05, D - 0.06],
  ].forEach((p) => {
    B(g, p[0], 0.0, p[1], 0.04, 1.0, 0.04, PAL.steel);
  });
  B(g, RX, 0.28, D - 0.05, RW, 0.03, 0.05, PAL.rail); // front sill

  // right end wall (lower)
  B(g, W - 0.03, 0.28, 0.03, 0.03, 0.34, D - 0.06, PAL.body);

  // roof box
  B(g, RX, 0.98, 0.0, RW, 0.16, D, PAL.body);
  B(g, RX, 1.14, -0.0, RW, 0.03, D + 0.0, PAL.roof);

  // upper back conveyor tray
  B(g, RX + 0.02, 1.5, 0.0, RW - 0.04, 0.03, 0.22, PAL.rail);
  B(g, RX + 0.04, 1.53, 0.04, RW - 0.08, 0.012, 0.15, PAL.belt);
  B(g, RX + 0.02, 1.53, 0.0, RW - 0.04, 0.05, 0.02, PAL.rail);

  // pole + disc
  C(g, 0.72, 1.4, 0.1, 0.01, 0.3, "y", PAL.rail, 8);
  C(g, 0.72, 1.4, 0.14, 0.075, 0.02, "z", PAL.tube, 24);

  // green signal light on roof
  C(g, W - 0.12, 1.22, 0.14, 0.008, 0.16, "y", PAL.rail, 8);
  B(g, W - 0.14, 1.3, 0.12, 0.05, 0.05, 0.05, PAL.green);

  // black inner rail
  B(g, RX + 0.02, 0.5, D / 2 + 0.22, 0.88, 0.05, 0.05, PAL.black);

  // posts holding a glass-ish guard at the front
  B(g, RX + 0.62, 0.31, D - 0.05, 0.03, 0.67, 0.03, PAL.rail);

  // in-line conveyor through the machine, passing in front of left cabinet
  conveyor(g, 0, W, D / 2, CONV_Y);

  g.position.set(0, 0, 0);
  return g;
}

/** Place a machine on the line axis (world z = 0 at conveyor centre) */
export function place(root: THREE.Group | THREE.Object3D, m: THREE.Group, x: number): THREE.Group {
  m.position.set(x, 0, -m.userData.D / 2);
  root.add(m);
  return m;
}

/** Single machine + conveyor stubs on both sides */
export function single(m: THREE.Group, stub: number = 0.5): THREE.Group {
  const root = new THREE.Group();
  place(root, m, 0);
  const W = m.userData.W;
  conveyor(root, -stub, 0, 0, CONV_Y, { legs: true });
  conveyor(root, W, W + stub, 0, CONV_Y, { legs: true });
  return root;
}

/**
 * Helper to build the BOP15 chain for 3D map views (Static static, just lamps update).
 */
export function createBop15ChainGroup(getStatusFn: (key: string) => string): THREE.Group {
  const g = new THREE.Group();
  let x = 0;

  const machines = [
    { key: "BOP15-LBF15-3", type: "LBF", rightWall: false },
    { key: "BOP15-LBF15-2", type: "LBF", rightWall: false },
    { key: "BOP15-LBF15-1", type: "LBF", rightWall: true },
    { key: "BOP15-LBC", type: "LBC" },
    { key: "BOP15-LCM", type: "LCM" },
  ] as const;

  const registry: { key: string; group: THREE.Group; lamps: THREE.MeshBasicMaterial[] }[] = [];

  machines.forEach((m) => {
    const group =
      m.type === "LBF"
        ? LBF15({ rightWall: m.rightWall ?? true })
        : m.type === "LBC"
          ? LBC()
          : LCM();
    const u = group.userData;

    // Add stack light poles and lamps
    const sp = [
      m.type === "LBF" ? 0.15 : m.type === "LBC" ? u.W - 0.15 : u.W - 0.12,
      m.type === "LBF" ? 1.41 : m.type === "LBC" ? 1.31 : 1.17,
      m.type === "LBF" ? u.D - 0.22 : m.type === "LBC" ? u.D * 0.5 : 0.14,
    ];

    // Stack light lamp materials
    const lamps: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: [0xe24b4a, 0xf5a623, 0x2ecc71][i] });
      B(group, sp[0] - 0.0375, sp[1] + 0.2 - i * 0.075, sp[2] - 0.0375, 0.075, 0.075, 0.075, 0x0, {
        color: [0xe24b4a, 0xf5a623, 0x2ecc71][i],
      });
      lamps.push(mat);
    }

    // Hit proxy
    const proxy = B(group, 0, 0, 0, u.W, u.H, u.D, 0x0, {
      visible: false,
      transparent: true,
      opacity: 0,
    });
    proxy.userData = { lineCode: "BOP15", machineCode: m.key.replace("BOP15-", "") };

    place(g, group, x);
    x += m.type === "LBF" ? 1.1 : m.type === "LBC" ? 0.95 : 2.3;

    registry.push({ key: m.key, group, lamps });
  });

  // Conveyors
  conveyor(g, 2.2, 3.3, 0, CONV_Y, { legs: true });
  conveyor(g, 4.25, 5.65, 0, CONV_Y, { legs: true });

  g.position.x = -x / 2;
  g.userData = { registry };
  return g;
}
