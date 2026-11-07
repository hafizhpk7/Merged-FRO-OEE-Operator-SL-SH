import * as THREE from "three";
import type { MachineState } from "../machineModels";

export interface BuilderContext {
  group: THREE.Group;
  floor: boolean;
  disposables: { dispose: () => void }[];
}

export function createHelpers(ctx: BuilderContext) {
  const { group, disposables } = ctx;

  const M = (color: number, opts: Record<string, unknown> = {}) => {
    const rawMetalness = typeof opts.metalness === "number" ? opts.metalness : 0.35;
    const rawRoughness = typeof opts.roughness === "number" ? opts.roughness : 0.45;
    const mat = new THREE.MeshStandardMaterial({
      color,
      ...opts,
      metalness: Math.min(rawMetalness, 0.6),
      roughness: Math.max(rawRoughness, 0.25),
    });
    disposables.push(mat);
    return mat;
  };

  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: THREE.Material,
    p?: THREE.Object3D,
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    disposables.push(geo);
    const s = new THREE.Mesh(geo, m);
    s.position.set(x, y, z);
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
    seg = 24,
  ) => {
    const geo = new THREE.CylinderGeometry(r, r, h, seg);
    disposables.push(geo);
    const s = new THREE.Mesh(geo, m);
    s.position.set(x, y, z);
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
    seg = 24,
  ) => {
    const geo = new THREE.CylinderGeometry(r, r, h, seg);
    geo.rotateX(Math.PI / 2);
    disposables.push(geo);
    const s = new THREE.Mesh(geo, m);
    s.position.set(x, y, z);
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
    seg = 32,
  ) => {
    const geo = new THREE.CylinderGeometry(r, r, h, seg);
    geo.rotateZ(Math.PI / 2);
    disposables.push(geo);
    const s = new THREE.Mesh(geo, m);
    s.position.set(x, y, z);
    (p || group).add(s);
    return s;
  };

  return { M, box, cylY, cylZ, cylX };
}

export const ss = (a: number, b: number, p: number) => {
  const k = Math.min(1, Math.max(0, (p - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export interface StandardStatusControls {
  scrMesh?: THREE.Mesh;
  // lamps: [green, amber, red] or [red, amber, green]
  lamps: { mat: THREE.MeshStandardMaterial; role: "green" | "amber" | "red" }[];
}

export function updateStandardVisuals(
  controls: StandardStatusControls,
  state: MachineState,
  elapsedSec: number,
) {
  const isRunning = state === "running";
  const isIdle = state === "idle";
  const isDown = state === "down";

  // Screen color
  if (controls.scrMesh && controls.scrMesh.material instanceof THREE.MeshBasicMaterial) {
    const scrColor = isRunning ? 0x2ecc71 : isIdle ? 0xf5a623 : 0xe24b4a;
    controls.scrMesh.material.color.setHex(scrColor);
  }

  // 1 Hz blink for red lamp when down
  const blinkRedOn = isDown && Math.floor(elapsedSec * 2) % 2 === 0;

  for (const lamp of controls.lamps) {
    if (lamp.role === "green") {
      lamp.mat.emissiveIntensity = isRunning ? 1.2 : 0.08;
    } else if (lamp.role === "amber") {
      lamp.mat.emissiveIntensity = isIdle ? 1.2 : 0.08;
    } else if (lamp.role === "red") {
      lamp.mat.emissiveIntensity = blinkRedOn ? 1.2 : 0.08;
    }
  }
}
