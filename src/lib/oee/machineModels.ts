import * as THREE from "three";
import { buildCap, buildFill, buildLab, buildShr } from "./paragon-models/builders1";
import { buildCel, buildCrt, buildLas, buildRep } from "./paragon-models/builders2";
import { buildBlp, buildCas, buildFed, buildLpp } from "./paragon-models/builders3";

export type MachineTypeKey =
  "fill" | "cap" | "lab" | "shr" | "las" | "crt" | "cel" | "rep" | "cas" | "fed" | "blp" | "lpp";

export type MachineState = "running" | "idle" | "down";

export interface TypeMeta {
  name: string;
  k: number; // uniform scale
  dy: number; // Y offset
  dz: number; // Z offset
  i: number; // inlet X extent (world units after scale)
  o: number; // outlet X extent (world units after scale)
  beltTop?: number;
  laneZ?: number;
  flow?: string;
}

export const TYPE_META: Record<MachineTypeKey, TypeMeta> = {
  fill: { name: "Filling", k: 2, dy: -1, dz: 0, i: -8, o: 8, beltTop: 1, laneZ: 0, flow: "+x" },
  cap: { name: "Capping", k: 2, dy: -1, dz: 0, i: -8, o: 8, beltTop: 1, laneZ: 0, flow: "+x" },
  lab: { name: "Labelling", k: 2, dy: -1, dz: 0, i: -8, o: 8, beltTop: 1, laneZ: 0, flow: "+x" },
  shr: { name: "Shrink", k: 1, dy: -0.06, dz: 0, i: -10, o: 10, beltTop: 1, laneZ: 0, flow: "+x" },
  las: {
    name: "Auto Sealer",
    k: 1,
    dy: -0.02,
    dz: 0,
    i: -10,
    o: 10,
    beltTop: 1,
    laneZ: 0,
    flow: "+x",
  },
  crt: { name: "Cartoning", k: 2, dy: -1, dz: 0, i: -8, o: 8, beltTop: 1, laneZ: 0, flow: "+x" },
  cel: {
    name: "Cello Wrap",
    k: 1,
    dy: -0.02,
    dz: 0,
    i: -10,
    o: 12.5,
    beltTop: 1,
    laneZ: 0,
    flow: "+x",
  },
  rep: {
    name: "Tube Repack",
    k: 1,
    dy: 0,
    dz: 1.6,
    i: -12,
    o: 12,
    beltTop: 1,
    laneZ: 0,
    flow: "+x",
  },
  cas: {
    name: "Case Sealer",
    k: 1,
    dy: -0.02,
    dz: 0,
    i: -11,
    o: 11,
    beltTop: 1,
    laneZ: 0,
    flow: "+x",
  },
  fed: { name: "Feeder", k: 2, dy: -0.9, dz: 0, i: -6, o: 7.4, beltTop: 1, laneZ: 0, flow: "+x" },
  blp: {
    name: "Blister Pack",
    k: 1,
    dy: 0,
    dz: 0,
    i: -9.5,
    o: 13.6,
    beltTop: 1,
    laneZ: 0,
    flow: "+x",
  },
  lpp: { name: "Pouch Packing", k: 2, dy: 0, dz: 0, i: -3, o: 3, beltTop: 1, laneZ: 0, flow: "+x" },
};

export interface CreateMachineOptions {
  floor?: boolean;
}

export interface CreatedMachine {
  group: THREE.Group;
  setState: (state: MachineState, speedFactor?: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
  meta: TypeMeta;
}

export function resolveMachineType(codeOrName: string): MachineTypeKey {
  if (!codeOrName) return "fill";
  const raw = codeOrName.trim().toUpperCase();
  const cleaned = raw.replace(/-\d+$/, "").trim();

  if (cleaned.startsWith("FEEDER") || cleaned === "FED") return "fed";
  if (cleaned.startsWith("LBC")) return "cap";
  if (cleaned.startsWith("LLM")) return "lab";
  if (cleaned.startsWith("LSM") || cleaned.startsWith("SHR")) return "shr";
  if (cleaned.startsWith("LAS")) return "las";
  if (cleaned.startsWith("LCM")) return "crt";
  if (cleaned.startsWith("LCW")) return "cel";
  if (cleaned.startsWith("LRP") || cleaned.startsWith("LTR")) return "rep";
  if (cleaned.startsWith("CRT")) return "cas";
  if (cleaned.startsWith("LBP") || cleaned.startsWith("BLP")) return "blp";
  if (cleaned.startsWith("LPP") || cleaned.startsWith("POP")) return "lpp";
  if (
    cleaned.startsWith("LTF") ||
    cleaned.startsWith("LBF") ||
    cleaned.startsWith("LJF") ||
    cleaned.startsWith("LCF") ||
    cleaned.startsWith("LEF")
  ) {
    return "fill";
  }

  if (cleaned.includes("CAP")) return "cap";
  if (cleaned.includes("LABEL")) return "lab";
  if (cleaned.includes("SHRINK")) return "shr";
  if (cleaned.includes("SEAL")) return "las";
  if (cleaned.includes("CARTON")) return "crt";
  if (cleaned.includes("CELLO") || cleaned.includes("WRAP")) return "cel";
  if (cleaned.includes("REPACK") || cleaned.includes("TUBE")) return "rep";
  if (cleaned.includes("BLISTER")) return "blp";
  if (cleaned.includes("POUCH")) return "lpp";
  if (cleaned.includes("FEEDER")) return "fed";
  if (cleaned.includes("FILL")) return "fill";

  console.warn(`[resolveMachineType] Unrecognized code "${codeOrName}", fallback to fill`);
  return "fill";
}

const BUILDER_FNS: Record<
  MachineTypeKey,
  (ctx: { group: THREE.Group; floor: boolean; disposables: { dispose: () => void }[] }) => {
    setState: (s: MachineState, sf?: number) => void;
    update: (dt: number) => void;
  }
> = {
  fill: buildFill,
  cap: buildCap,
  lab: buildLab,
  shr: buildShr,
  las: buildLas,
  crt: buildCrt,
  cel: buildCel,
  rep: buildRep,
  cas: buildCas,
  fed: buildFed,
  blp: buildBlp,
  lpp: buildLpp,
};

export function createMachine(
  type: MachineTypeKey,
  opts: CreateMachineOptions = {},
): CreatedMachine {
  const meta = TYPE_META[type] || TYPE_META.fill;
  const group = new THREE.Group();
  group.name = `Machine_${type}_${meta.name}`;

  const disposables: { dispose: () => void }[] = [];
  const floor = opts.floor ?? true;

  const builder = BUILDER_FNS[type] || BUILDER_FNS.fill;
  const api = builder({ group, floor, disposables });

  // Apply default scaling and local offsets from TYPE_META
  group.scale.setScalar(meta.k);
  group.position.set(0, meta.dy, meta.dz);

  // Dev-time contract assertion (warn only)
  if (process.env.NODE_ENV !== "production") {
    try {
      group.updateMatrixWorld(true);
      const b3 = new THREE.Box3().setFromObject(group);
      if (b3.isEmpty()) {
        console.warn(`[createMachine] Bounding box empty for machine ${type}`);
      }
    } catch {
      // ignore
    }
  }

  const dispose = () => {
    disposables.forEach((d) => {
      try {
        d.dispose();
      } catch {
        // ignore
      }
    });
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) {
          try {
            obj.geometry.dispose();
          } catch {
            // ignore
          }
        }
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => {
            try {
              m.dispose();
            } catch {
              // ignore
            }
          });
        } else if (obj.material) {
          try {
            obj.material.dispose();
          } catch {
            // ignore
          }
        }
      }
    });
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  };

  return {
    group,
    setState: api.setState,
    update: api.update,
    dispose,
    meta,
  };
}
