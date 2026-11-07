import { PAL, CONV_Y, LBF15, LBC, LCM, conveyor, single, place, hideStatic } from "./bop15Models";

export { PAL, CONV_Y, LBF15, LBC, LCM, conveyor, single, place, hideStatic };

export type MachineType = "LBF" | "LBC" | "LCM";

export type IsoStatus = "running" | "slow" | "minor stop" | "down" | "off";

export interface BOP15MachineMeta {
  key: string;
  shortKey: string;
  name: string;
  type: MachineType;
  defaultOee: number;
}

export const BOP15_MACHINES: readonly BOP15MachineMeta[] = [
  { key: "BOP15-LBF15-3", shortKey: "LBF15-3", name: "LBF15-3", type: "LBF", defaultOee: 81 },
  { key: "BOP15-LBF15-2", shortKey: "LBF15-2", name: "LBF15-2", type: "LBF", defaultOee: 74 },
  { key: "BOP15-LBF15-1", shortKey: "LBF15-1", name: "LBF15-1", type: "LBF", defaultOee: 81 },
  { key: "BOP15-LBC", shortKey: "LBC", name: "LBC", type: "LBC", defaultOee: 59 },
  { key: "BOP15-LCM", shortKey: "LCM", name: "LCM", type: "LCM", defaultOee: 33 },
] as const;

export const LAMP_COLORS = [0xe24b4a, 0xf5a623, 0x2ecc71] as const; // red, amber, green

/**
 * Status mapping from section 4.3:
 * running: green lit [0, 0, 1]
 * slow (speed loss): green + amber lit [0, 1, 1]
 * minor stop: amber lit [0, 1, 0]
 * down: red lit [1, 0, 0]
 * off: none lit [0, 0, 0]
 */
export const STATUS_LAMP_MAP: Record<string, [number, number, number]> = {
  running: [0, 0, 1],
  slow: [0, 1, 1],
  "minor stop": [0, 1, 0],
  minor: [0, 1, 0],
  down: [1, 0, 0],
  off: [0, 0, 0],
  idle: [0, 0, 0],
};

export const STATUS_FACTOR_MAP: Record<string, number> = {
  running: 1.0,
  slow: 0.5,
  "minor stop": 0.0,
  minor: 0.0,
  down: 0.0,
  off: 0.0,
  idle: 0.0,
};

export const STATUS_DISPLAY_INFO: Record<
  IsoStatus,
  { label: string; color: string; lamps: [number, number, number] }
> = {
  running: { label: "RUNNING", color: "#1fa35c", lamps: [0, 0, 1] },
  slow: { label: "SLOW", color: "#e0a800", lamps: [0, 1, 1] },
  "minor stop": { label: "MINOR STOP", color: "#e0a800", lamps: [0, 1, 0] },
  down: { label: "DOWN", color: "#d93838", lamps: [1, 0, 0] },
  off: { label: "OFF", color: "#8a8f98", lamps: [0, 0, 0] },
};

export interface StackLightMesh {
  key: string;
  lamps: THREE.MeshBasicMaterial[];
}

/**
 * Constant guarding the dev demo route.
 * Default false in production builds, true in development.
 */
export const DEBUG_ISO =
  (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") ||
  (typeof import.meta !== "undefined" &&
    Boolean((import.meta as { env?: { DEV?: boolean } })?.env?.DEV)) ||
  (typeof window !== "undefined" && window.location.search.includes("debug=1"));

export interface IsoMachineOverrideMeta {
  key: string;
  shortKey: string;
  name: string;
  modelType: MachineType;
}

export interface IsoLineOverride {
  chainOrder: string[];
  machines: IsoMachineOverrideMeta[];
}

/**
 * Section 0: ISO_MODEL_OVERRIDES registry.
 * Checked before generic model lookup, ensuring only plant J2 / line BOP15
 * uses the faithful animated isometric library while all other lines keep their models.
 */
export const BOP15_OVERRIDE_KEY = "J2:BOP15";
export const BOP15_DEFAULT_STUB = 0.5;

export const ISO_MODEL_OVERRIDES: Record<string, IsoLineOverride> = {
  [BOP15_OVERRIDE_KEY]: {
    chainOrder: ["BOP15-LBF15-3", "BOP15-LBF15-2", "BOP15-LBF15-1", "BOP15-LBC", "BOP15-LCM"],
    machines: [
      { key: "BOP15-LBF15-3", shortKey: "LBF15-3", name: "Bottle Filler 15-3", modelType: "LBF" },
      { key: "BOP15-LBF15-2", shortKey: "LBF15-2", name: "Bottle Filler 15-2", modelType: "LBF" },
      { key: "BOP15-LBF15-1", shortKey: "LBF15-1", name: "Bottle Filler 15-1", modelType: "LBF" },
      { key: "BOP15-LBC", shortKey: "LBC", name: "Bottle Capper", modelType: "LBC" },
      { key: "BOP15-LCM", shortKey: "LCM", name: "Cartoner", modelType: "LCM" },
    ],
  },
};

export function isIsoModelOverridden(plantId: string = "J2", lineId: string = "BOP15"): boolean {
  const normKey = `${(plantId || "J2").toUpperCase()}:${(lineId || "BOP15").toUpperCase()}`;
  return Boolean(ISO_MODEL_OVERRIDES[normKey] || ISO_MODEL_OVERRIDES[`${plantId}:${lineId}`]);
}

export function getIsoModelOverride(
  plantId: string = "J2",
  lineId: string = "BOP15",
): IsoLineOverride | undefined {
  const normKey = `${(plantId || "J2").toUpperCase()}:${(lineId || "BOP15").toUpperCase()}`;
  return ISO_MODEL_OVERRIDES[normKey] || ISO_MODEL_OVERRIDES[`${plantId}:${lineId}`];
}

export function isIsoMachineOverridden(
  plantId: string = "J2",
  lineId: string = "BOP15",
  machineCode: string = "",
): boolean {
  if ((plantId || "").toUpperCase() !== "J2" || (lineId || "").toUpperCase() !== "BOP15")
    return false;
  const canonical = machineCode.startsWith("BOP15-") ? machineCode : `BOP15-${machineCode}`;
  const override = ISO_MODEL_OVERRIDES[BOP15_OVERRIDE_KEY];
  return override?.chainOrder.includes(canonical) ?? false;
}
