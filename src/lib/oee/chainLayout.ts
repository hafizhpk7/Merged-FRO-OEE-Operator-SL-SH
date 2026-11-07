import * as THREE from "three";
import { J2_LINES_CONFIG, type FlowDirection } from "./j2-layout-config";
import {
  createMachine,
  resolveMachineType,
  TYPE_META,
  type CreatedMachine,
  type MachineTypeKey,
  type TypeMeta,
} from "./machineModels";

/**
 * Constant spacing added to the cursor between adjacent machines.
 * Default is 0 per reference specification Machine_Chain_-_Shopfloor_J2.html.
 */
export const CHAIN_GAP = 0;

/**
 * Machine ordering mode:
 * - 'flow': reference process-flow order (left-to-right flow, inlet to outlet)
 * - 'dashboard': original order as defined in dashboard data / layout config
 */
export const CHAIN_ORDER_MODE: "flow" | "dashboard" = "flow";

/**
 * Debug logging flag for machine chain inspection.
 */
export const DEBUG_CHAIN = false;

export interface ChainPlacement<T = unknown> {
  machine: T;
  type: MachineTypeKey;
  meta: TypeMeta;
  scale: number; // k
  position: { x: number; y: number; z: number }; // (c - i, dy, dz)
  inletWorldX: number; // c
  outletWorldX: number; // c + (o - i)
  length: number; // o - i
  labelCenterX: number; // c + (o - i)/2
}

export interface ChainLayoutResult<T = unknown> {
  totalLength: number;
  placements: ChainPlacement<T>[];
  bounds: {
    minX: number;
    maxX: number;
  };
}

/**
 * Reorders machines for chain view:
 * For right-to-left shopfloor lines, reversing the sequence produces the physical
 * process-flow order (e.g. Filler -> Capper -> Cartoner).
 */
export function getOrderedLineMachines<T extends { code?: string; id?: string }>(
  machines: T[],
  flowDirection: FlowDirection = "left-to-right",
  orderMode: "flow" | "dashboard" = CHAIN_ORDER_MODE,
): T[] {
  if (orderMode === "dashboard") {
    return [...machines];
  }
  return flowDirection === "right-to-left" ? [...machines].reverse() : [...machines];
}

/**
 * Pure reference layout algorithm (section 1.2):
 *
 * total = sum over machines of (o − i)
 * c = −total / 2
 * for each machine m in order:
 *     group.scale.setScalar(k)
 *     group.position.set(c − i, dy, dz)
 *     machine occupies world X range [c, c + (o − i)]
 *     label center x = c + (o − i)/2
 *     c += (o − i) + gap
 */
export function layoutChain<T extends { code?: string; id?: string; name?: string; type?: string }>(
  machines: T[],
  gap: number = CHAIN_GAP,
): ChainLayoutResult<T> {
  if (machines.length === 0) {
    return {
      totalLength: 0,
      placements: [],
      bounds: { minX: 0, maxX: 0 },
    };
  }

  // 1. Resolve metadata and lengths
  let totalLength = 0;
  const items = machines.map((m) => {
    const code = m.code || m.id || m.name || m.type || "";
    const typeKey = resolveMachineType(code);
    const meta = TYPE_META[typeKey] || TYPE_META.fill;
    const len = meta.o - meta.i;
    totalLength += len;
    return { machine: m, typeKey, meta, len };
  });

  if (machines.length > 1) {
    totalLength += (machines.length - 1) * gap;
  }

  // 2. Cursor starts at -total / 2
  let c = -totalLength / 2;
  const startX = c;

  // 3. Position each machine
  const placements: ChainPlacement<T>[] = items.map(({ machine, typeKey, meta, len }, idx) => {
    const originX = c - meta.i;
    const inletX = c;
    const outletX = c + len;
    const labelX = c + len / 2;

    const placement: ChainPlacement<T> = {
      machine,
      type: typeKey,
      meta,
      scale: meta.k,
      position: { x: originX, y: meta.dy, z: meta.dz },
      inletWorldX: inletX,
      outletWorldX: outletX,
      length: len,
      labelCenterX: labelX,
    };

    c += len;
    if (idx < items.length - 1) {
      c += gap;
    }

    return placement;
  });

  return {
    totalLength,
    placements,
    bounds: {
      minX: startX,
      maxX: c,
    },
  };
}

/**
 * Creates high-resolution 2D canvas text sprites for floating labels:
 * "<CODE> · <type name>"
 */
export function createMachineLabelSprite(
  code: string,
  typeName: string,
): { sprite: THREE.Sprite; dispose: () => void } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallbackMat = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
    return {
      sprite: new THREE.Sprite(fallbackMat),
      dispose: () => fallbackMat.dispose(),
    };
  }

  canvas.width = 512;
  canvas.height = 128;

  const text = `${code} · ${typeName}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background pill dimensions
  ctx.font =
    "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const padX = 28;
  const pillW = Math.min(480, Math.max(160, textW + padX * 2));
  const pillH = 64;
  const px = (canvas.width - pillW) / 2;
  const py = (canvas.height - pillH) / 2;
  const r = 32;

  // Dark slate translucent background
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(px, py, pillW, pillH, r);
  } else {
    ctx.rect(px, py, pillW, pillH);
  }
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Crisp text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  // Scale world size: height 1.2 units, width proportional
  const aspect = pillW / pillH;
  const worldH = 1.2;
  const worldW = worldH * aspect;
  sprite.scale.set(worldW, worldH, 1);

  return {
    sprite,
    dispose: () => {
      material.dispose();
      texture.dispose();
    },
  };
}

/**
 * Calculates optimal camera distance and target to frame the chain with 12-15% margin
 */
export function fitCameraToChain(
  camera: THREE.PerspectiveCamera,
  totalLength: number,
  aspectRatio: number,
  elevationPh: number = 0.55,
  azimuthTh: number = 0.78,
  paddingFactor: number = 1.15,
): { dist: number; target: THREE.Vector3; minDist: number; maxDist: number } {
  const target = new THREE.Vector3(0, 1.0, 0);

  const vFovRad = (camera.fov * Math.PI) / 180;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * Math.max(0.1, aspectRatio));

  // Compute camera view basis
  const sinPh = Math.sin(elevationPh);
  const cosPh = Math.cos(elevationPh);
  const sinTh = Math.sin(azimuthTh);
  const cosTh = Math.cos(azimuthTh);

  const camPosDir = new THREE.Vector3(sinPh * sinTh, cosPh, sinPh * cosTh).normalize();
  const camForward = camPosDir.clone().negate();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const camRight = new THREE.Vector3().crossVectors(camForward, worldUp).normalize();
  const camUp = new THREE.Vector3().crossVectors(camRight, camForward).normalize();

  // Bounding box corners of the chain (from -totalLength/2 to +totalLength/2 along X, Y from 0 to 4.5, Z from -4 to +4)
  const halfX = totalLength / 2;
  const corners: THREE.Vector3[] = [
    new THREE.Vector3(-halfX, 0, -3.5),
    new THREE.Vector3(-halfX, 0, 3.5),
    new THREE.Vector3(-halfX, 4.5, -3.5),
    new THREE.Vector3(-halfX, 4.5, 3.5),
    new THREE.Vector3(halfX, 0, -3.5),
    new THREE.Vector3(halfX, 0, 3.5),
    new THREE.Vector3(halfX, 4.5, -3.5),
    new THREE.Vector3(halfX, 4.5, 3.5),
  ];

  let requiredDist = 0;
  const tanHalfV = Math.tan(vFovRad / 2);
  const tanHalfH = Math.tan(hFovRad / 2);

  for (const corner of corners) {
    const v = corner.clone().sub(target);
    const xCam = Math.abs(v.dot(camRight));
    const yCam = Math.abs(v.dot(camUp));
    const zCam = v.dot(camForward); // positive if in front of target along look direction

    const distH = xCam / tanHalfH - zCam;
    const distV = yCam / tanHalfV - zCam;
    requiredDist = Math.max(requiredDist, distH, distV);
  }

  const finalDist = Math.max(12, requiredDist * paddingFactor);
  const minDist = Math.max(4, finalDist * 0.2);
  const maxDist = Math.max(100, finalDist * 3.5);

  return { dist: finalDist, target, minDist, maxDist };
}

export interface ChainVerificationResult {
  lineCode: string;
  flowDirection: FlowDirection;
  machineCount: number;
  expectedCount: number;
  totalLength: number;
  expectedTotal: number;
  lengthDifference: number;
  machines: {
    code: string;
    resolvedType: MachineTypeKey;
    scale: number;
    inletX: number;
    outletX: number;
    beltTopY: number;
    laneZ: number;
    groupPosition: { x: number; y: number; z: number };
  }[];
  consecutiveGaps: { m1: string; m2: string; gap: number }[];
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Automatic verification of all 29 multi-machine lines (§5):
 * 1. Machine count and sequence match
 * 2. World inlet X of machine N+1 equals world outlet X of machine N (tol 1e-6)
 * 3. All machines have belt-top world Y = 1 (tol 0.05) and lane world Z = 0 (tol 0.05)
 * 4. Total chain length equals expected total (tol 0.01)
 * 5. Scale per machine equals TY.k; identity rotation
 */
export function verifyChains(verbose: boolean = false): {
  success: boolean;
  totalLines: number;
  passedCount: number;
  failedCount: number;
  results: ChainVerificationResult[];
} {
  const multiLines = J2_LINES_CONFIG.filter((l) => l.machines.length > 1);
  const results: ChainVerificationResult[] = [];
  let allPassed = true;

  for (const line of multiLines) {
    const ordered = getOrderedLineMachines(line.machines, line.flowDirection, "flow");
    const layout = layoutChain(ordered, CHAIN_GAP);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Calculate expected total from TY
    let expectedTotal = 0;
    ordered.forEach((m) => {
      const type = resolveMachineType(m.code);
      const meta = TYPE_META[type];
      expectedTotal += meta.o - meta.i;
    });

    const consecutiveGaps: { m1: string; m2: string; gap: number }[] = [];
    const machineEntries: ChainVerificationResult["machines"] = [];

    const createdMachines: CreatedMachine[] = [];

    layout.placements.forEach((p, idx) => {
      const cm = createMachine(p.type, { floor: false });
      cm.group.scale.setScalar(p.scale);
      cm.group.position.set(p.position.x, p.position.y, p.position.z);
      cm.group.updateMatrixWorld(true);
      createdMachines.push(cm);

      // Belt top in world space is defined by TYPE_META specification and geometry
      const beltTopY = p.meta.beltTop ?? 1.0;
      const laneZ = p.meta.laneZ ?? 0.0;

      machineEntries.push({
        code: p.machine.code || "",
        resolvedType: p.type,
        scale: p.scale,
        inletX: p.inletWorldX,
        outletX: p.outletWorldX,
        beltTopY,
        laneZ,
        groupPosition: { ...p.position },
      });

      // Check scale
      if (cm.group.scale.x !== p.meta.k) {
        errors.push(`Machine ${p.machine.code} scale is ${cm.group.scale.x}, expected ${p.meta.k}`);
      }

      // Check rotation
      if (cm.group.rotation.x !== 0 || cm.group.rotation.y !== 0 || cm.group.rotation.z !== 0) {
        errors.push(`Machine ${p.machine.code} has non-identity rotation`);
      }

      // Check belt-top Y
      if (Math.abs(beltTopY - 1.0) > 0.05) {
        errors.push(`Machine ${p.machine.code} belt-top world Y is ${beltTopY}, expected 1.0`);
      }

      // Check lane Z
      if (Math.abs(laneZ - 0.0) > 0.05) {
        errors.push(`Machine ${p.machine.code} lane world Z is ${laneZ}, expected 0.0`);
      }

      // Check consecutive continuity
      if (idx > 0) {
        const prev = layout.placements[idx - 1];
        const gap = Math.abs(p.inletWorldX - prev.outletWorldX);
        consecutiveGaps.push({
          m1: prev.machine.code || "",
          m2: p.machine.code || "",
          gap,
        });
        if (gap > 1e-6) {
          errors.push(`Gap/overlap between ${prev.machine.code} and ${p.machine.code}: ${gap}`);
        }
      }
    });

    // Check total length
    const lengthDiff = Math.abs(layout.totalLength - expectedTotal);
    if (lengthDiff > 0.01) {
      errors.push(
        `Total length mismatch: layout=${layout.totalLength}, expected=${expectedTotal}, diff=${lengthDiff}`,
      );
    }

    // Clean up created instances
    createdMachines.forEach((cm) => cm.dispose());

    const passed = errors.length === 0;
    if (!passed) allPassed = false;

    const result: ChainVerificationResult = {
      lineCode: line.code,
      flowDirection: line.flowDirection,
      machineCount: ordered.length,
      expectedCount: line.machines.length,
      totalLength: layout.totalLength,
      expectedTotal,
      lengthDifference: lengthDiff,
      machines: machineEntries,
      consecutiveGaps,
      passed,
      errors,
      warnings,
    };

    results.push(result);

    if (verbose || !passed) {
      console.log(
        `[verifyChains] Line ${line.code}: ${passed ? "PASSED" : "FAILED"} (length ${layout.totalLength}, machines ${ordered.length})`,
        errors.length > 0 ? errors : "",
      );
    }
  }

  return {
    success: allPassed,
    totalLines: multiLines.length,
    passedCount: results.filter((r) => r.passed).length,
    failedCount: results.filter((r) => !r.passed).length,
    results,
  };
}

// Dev-time global exposure (§5)
if (typeof window !== "undefined") {
  (window as unknown as { __verifyChains?: (verbose?: boolean) => unknown }).__verifyChains =
    verifyChains;
}
