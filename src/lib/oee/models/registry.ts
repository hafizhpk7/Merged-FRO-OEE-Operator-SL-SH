import { J2_LINES_CONFIG } from "../j2-layout-config";
import type { ModelKey } from "./types";

export type ModelMetadata = {
  key: ModelKey;
  label: string;
  prefixes: string[];
};

export const MODEL_REGISTRY: Record<ModelKey, ModelMetadata> = {
  filling: {
    key: "filling",
    label: "Filling Machine",
    prefixes: ["LTF", "LBF", "LJF", "LCF", "LEF"],
  },
  capping: {
    key: "capping",
    label: "Capping Machine",
    prefixes: ["LBC"],
  },
  labelling: {
    key: "labelling",
    label: "Labelling Machine",
    prefixes: ["LLM"],
  },
  shrink: {
    key: "shrink",
    label: "Shrink Machine",
    prefixes: ["LSM", "SHR"],
  },
  autoSealer: {
    key: "autoSealer",
    label: "Auto Sealing Machine",
    prefixes: ["LAS"],
  },
  cartoning: {
    key: "cartoning",
    label: "Cartoning Machine",
    prefixes: ["LCM"],
  },
  celloWrap: {
    key: "celloWrap",
    label: "Cello Wrapping Machine",
    prefixes: ["LCW"],
  },
  tubeRepack: {
    key: "tubeRepack",
    label: "Tube Repack Machine",
    prefixes: ["LRP", "LTR"],
  },
  caseSealer: {
    key: "caseSealer",
    label: "Case Sealer / Carton Taping Machine",
    prefixes: ["CRT"],
  },
  blister: {
    key: "blister",
    label: "Blister Pack Machine",
    prefixes: ["LBP"],
  },
  pouch: {
    key: "pouch",
    label: "Pouch Packing Machine",
    prefixes: ["LPP"],
  },
  feeder: {
    key: "feeder",
    label: "Feeder Machine",
    prefixes: ["FEEDER"],
  },
};

/**
 * Resolves the ModelKey from the letter prefix of a machine code.
 * Handles patterns like "LBF15-1" -> "LBF", "SHR01" -> "SHR", "LTR01" -> "LTR", "FEEDER" -> "FEEDER"
 */
export function resolveModelKey(machineCode: string): ModelKey {
  const cleaned = machineCode.trim().toUpperCase();

  if (cleaned.startsWith("FEEDER")) return "feeder";

  // Match letters before digits or dashes
  const match = cleaned.match(/^([A-Z]+)/);
  const prefix = match ? match[1] : cleaned;

  for (const meta of Object.values(MODEL_REGISTRY)) {
    if (meta.prefixes.includes(prefix)) {
      return meta.key;
    }
  }

  // Fallback check if prefix starts with any registered prefix
  for (const meta of Object.values(MODEL_REGISTRY)) {
    for (const p of meta.prefixes) {
      if (prefix.startsWith(p)) {
        return meta.key;
      }
    }
  }

  console.warn(
    `[3D Model Registry] Unknown machine code: "${machineCode}". Defaulting to "filling".`,
  );
  return "filling";
}

/**
 * Startup self-check to resolve all 106 machines in J2.
 */
export function selfCheckJ2Models(): { total: number; resolved: number; unknown: string[] } {
  const unknown: string[] = [];
  let total = 0;

  for (const line of J2_LINES_CONFIG) {
    for (const machine of line.machines) {
      total++;
      const resolvedKey = resolveModelKey(machine.code);
      if (!resolvedKey) {
        unknown.push(`${line.code}/${machine.code}`);
      }
    }
  }

  if (unknown.length > 0) {
    console.error(
      `[3D Model Registry Self-Check] Found ${unknown.length} unknown machine codes:`,
      unknown,
    );
  } else if (process.env.NODE_ENV !== "production") {
    // console.info(`[3D Model Registry Self-Check] Successfully resolved all ${total} machines across 40 lines in J2.`);
  }

  return { total, resolved: total - unknown.length, unknown };
}
