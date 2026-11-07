import * as THREE from "three";
import type { MachineStatus, ModelPartType } from "./types";

/**
 * Seeded Random Number Generator to ensure deterministic visuals across renders
 */
export function makeSeededRng(seed = 12345) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function tagPart(obj: THREE.Object3D, part: ModelPartType) {
  obj.userData.part = part;
  obj.traverse((child) => {
    child.userData.part = part;
  });
  return obj;
}

export type LampGroup = {
  group: THREE.Group;
  red: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  amber: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  green: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
};

/**
 * Creates a standard 3-tier andon stack light (green, amber, red)
 */
export function createStackLight(poleHeight = 0.5, radius = 0.08, lampHeight = 0.12): LampGroup {
  const group = new THREE.Group();
  tagPart(group, "lamps");

  // Pole
  const poleGeo = new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, poleHeight, 12);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: 0.6,
    roughness: 0.3,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = poleHeight / 2;
  group.add(pole);

  // 3 Lamps: Green (bottom), Amber (middle), Red (top)
  const lampGeo = new THREE.CylinderGeometry(radius, radius, lampHeight, 16);

  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x2ecc71,
    emissive: 0x2ecc71,
    emissiveIntensity: 0.1,
  });
  const green = new THREE.Mesh(lampGeo, greenMat);
  green.position.y = poleHeight + lampHeight / 2;
  group.add(green);

  const amberMat = new THREE.MeshStandardMaterial({
    color: 0xf5a623,
    emissive: 0xf5a623,
    emissiveIntensity: 0.1,
  });
  const amber = new THREE.Mesh(lampGeo, amberMat);
  amber.position.y = poleHeight + lampHeight * 1.5 + 0.01;
  group.add(amber);

  const redMat = new THREE.MeshStandardMaterial({
    color: 0xe24b4a,
    emissive: 0xe24b4a,
    emissiveIntensity: 0.1,
  });
  const red = new THREE.Mesh(lampGeo, redMat);
  red.position.y = poleHeight + lampHeight * 2.5 + 0.02;
  group.add(red);

  return { group, red, amber, green };
}

/**
 * Updates stack lights and HMI screen according to status
 */
export function updateStatusVisuals({
  status,
  t,
  lamps,
  hmiScreen,
}: {
  status: MachineStatus;
  t: number;
  lamps?: LampGroup;
  hmiScreen?: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  >;
}): number {
  let timeScale = 1.0;
  let screenColor = 0x2ecc71; // green

  let greenOn = false;
  let amberOn = false;
  let redOn = false;

  switch (status) {
    case "running":
      timeScale = 1.0;
      greenOn = true;
      screenColor = 0x2ecc71;
      break;
    case "slow":
      timeScale = 0.5;
      greenOn = true;
      amberOn = true;
      screenColor = 0xf5a623;
      break;
    case "idle":
      timeScale = 0.0;
      amberOn = true;
      screenColor = 0xf5a623;
      break;
    case "down":
      timeScale = 0.0;
      redOn = Math.floor(t * 4) % 2 === 0; // 2 Hz blink
      screenColor = 0xe24b4a;
      break;
    case "off":
    default:
      timeScale = 0.0;
      screenColor = 0x333840;
      break;
  }

  if (lamps) {
    lamps.green.material.emissiveIntensity = greenOn ? 1.2 : 0.08;
    lamps.amber.material.emissiveIntensity = amberOn ? 1.2 : 0.08;
    lamps.red.material.emissiveIntensity = redOn ? 1.4 : 0.08;
  }

  if (hmiScreen) {
    hmiScreen.material.color.setHex(screenColor);
    if ("emissive" in hmiScreen.material) {
      hmiScreen.material.emissive.setHex(screenColor);
      hmiScreen.material.emissiveIntensity = status === "off" ? 0.05 : 0.6;
    }
  }

  return timeScale;
}

/**
 * Filter visibility based on LOD
 */
export function applyLOD(root: THREE.Object3D, lod: number) {
  root.traverse((obj) => {
    const part = obj.userData.part as ModelPartType | undefined;
    if (!part) return;

    if (lod === 0) {
      // LOD 0 (Plant View): only body & basic parts
      if (part === "body") {
        obj.visible = true;
      } else if (part === "lamps" || part === "hmi") {
        obj.visible = false;
      } else {
        obj.visible = false;
      }
    } else if (lod === 1) {
      // LOD 1 (Zone View / Line Chain): body, guard, hmi, lamps, static products
      if (part === "floor") {
        obj.visible = false;
      } else {
        obj.visible = true;
      }
    } else {
      // LOD 2 (Machine Detail): everything
      obj.visible = true;
    }
  });
}
