/**
 * Asset Management mock master (URS 1.4 "Master Data Run Rate Mesin").
 * Per line: representative asset (bottleneck), operation (SEQ or OR), SRR Line (= standard run rate
 * of the representative asset, may be null), per-machine standard run rate (may be null) and
 * weightage. This is the single source for the line SRR, machine standards and topology.
 *
 * Mock values: standards come from the machine profile (rated rate) and the SRR Line keeps the
 * previous 88% factor so existing numbers do not move; the real values come from Asset Management.
 *
 * Override layer (simulation): `simOverrides.srrLine` in sessionStorage, keyed "<plant>:<line>".
 * A number replaces the master value, `null` forces "SRR Line missing". Dev helper:
 * `window.setSrrLine(plantId, lineId, valueOrNull)`; `undefined` clears the override.
 */
import { useSyncExternalStore } from "react";
import { getLine, PLANTS } from "./data";
import { isOeeActiveLine, LINE_TOPOLOGY } from "./config";
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { getMachineProfile } from "./machineEvents";
import { simStore } from "./simStore";

export type LineOperation = "SEQ" | "OR";

export type AssetMachine = {
  code: string;
  /** Standard run rate in ppm; null = not configured in the master. */
  standardRunRate: number | null;
  /** Weightage in the line aggregation (default 100). */
  weightage: number;
};

export type LineAssetMaster = {
  plantId: string;
  lineId: string;
  /** Representative asset = bottleneck machine code. */
  representativeAsset: string;
  operation: LineOperation;
  /** SRR Line in ppm (standard run rate of the representative asset); null = not configured. */
  srrLine: number | null;
  machines: AssetMachine[];
};

/** Demo case: the SRR Line of these lines is not set in the master. */
const SRR_LINE_NOT_SET: ReadonlySet<string> = new Set(["J2:TUP14"]);
/** The SRR Line is this share of the representative asset's rated run rate (mock). */
const SRR_LINE_FACTOR = 0.88;

/** Representative asset (bottleneck) per line across plants. */
export const REPRESENTATIVE_BY_LINE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const lineCfg of J2_LINES_CONFIG) {
    const firstMachine = lineCfg.machines[0]?.code ?? "LTF01";
    const filler = lineCfg.machines.find((m) => m.code.startsWith("LTF") || m.code.startsWith("LFL"));
    map[`J2:${lineCfg.code}`] = filler?.code ?? firstMachine;
  }
  for (const plant of PLANTS) {
    if (plant.id === "J2" || !plant.isOperational || !plant.zones) continue;
    for (const zone of plant.zones) {
      for (const line of zone.lines) {
        const first = line.machines[0]?.id ?? `${line.id}-M1`;
        map[`${plant.id}:${line.id}`] = line.bottleneck && line.bottleneck !== "-" ? line.bottleneck : first;
      }
    }
  }
  return map;
})();

const masterCache = new Map<string, LineAssetMaster>();

function lineMachineCodes(plantId: string, lineId: string): string[] {
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  return (line?.machines ?? []).map((m) => m.code || m.id);
}

export function getLineAssetMaster(plantId: string, lineId: string): LineAssetMaster {
  const key = `${plantId}:${lineId}`;
  const hit = masterCache.get(key);
  if (hit) return hit;
  const codes = lineMachineCodes(plantId, lineId);
  const rep =
    REPRESENTATIVE_BY_LINE[key] ?? codes[0] ?? "M01";
  const standardOf = (code: string) => Math.max(1, getMachineProfile(code).idealRatePpm);
  const machines: AssetMachine[] = (codes.length ? codes : [rep]).map((code) => ({
    code,
    standardRunRate: standardOf(code),
    weightage: 100,
  }));
  const master: LineAssetMaster = {
    plantId,
    lineId,
    representativeAsset: rep,
    operation: LINE_TOPOLOGY[lineId] ?? "SEQ",
    srrLine: SRR_LINE_NOT_SET.has(key) ? null : Math.round(standardOf(rep) * SRR_LINE_FACTOR),
    machines,
  };
  masterCache.set(key, master);
  return master;
}

// ---- override layer (simulation) ---------------------------------------------------------------
// The overrides live in simStore (srrOverrides, also persisted under sessionStorage "simOverrides.srrLine").

/** Sets (number / null) or clears (undefined) the SRR Line override of a line. */
export function setSrrLine(plantId: string, lineId: string, value: number | null | undefined): void {
  const key = `${plantId}:${lineId}`;
  if (value === undefined) simStore.setSrrOverride(key, undefined);
  else simStore.setSrrOverride(key, value === null ? null : Number.isFinite(value) && value > 0 ? value : null);
}

export function subscribeAssetMaster(l: () => void) {
  return simStore.subscribe(l);
}
export const assetMasterVersion = () => simStore.version();

// ---- accessors -----------------------------------------------------------------------------------
/** SRR Line in ppm after the override layer; null when not configured. */
export function getLineSrr(plantId: string, lineId: string): number | null {
  const o = simStore.get().srrOverrides;
  const key = `${plantId}:${lineId}`;
  if (key in o) return o[key] ?? null;
  return getLineAssetMaster(plantId, lineId).srrLine;
}

export function getRepresentativeAsset(plantId: string, lineId: string): string {
  return getLineAssetMaster(plantId, lineId).representativeAsset;
}

export function getLineOperation(plantId: string, lineId: string): LineOperation {
  return getLineAssetMaster(plantId, lineId).operation;
}

/** Standard run rate (ppm) of a machine; null when the master has none. */
export function getMachineStandard(plantId: string, lineId: string, machineCode: string): number | null {
  const m = getLineAssetMaster(plantId, lineId).machines.find((x) => x.code === machineCode);
  return m ? m.standardRunRate : getMachineProfile(machineCode).idealRatePpm;
}

export function getMachineWeightage(plantId: string, lineId: string, machineCode: string): number {
  return getLineAssetMaster(plantId, lineId).machines.find((x) => x.code === machineCode)?.weightage ?? 100;
}

export type LineOperationalMode = {
  mode: "full" | "idw-only";
  reason?: "not-pilot" | "srr-line-missing";
};

/** A line is "full" only if it is a SCADA pilot line AND its SRR Line is configured. */
export function getLineOperationalMode(plantId: string, lineId: string): LineOperationalMode {
  if (!isOeeActiveLine(plantId, lineId)) return { mode: "idw-only", reason: "not-pilot" };
  if (getLineSrr(plantId, lineId) === null) return { mode: "idw-only", reason: "srr-line-missing" };
  return { mode: "full" };
}

/** Live operational mode of a line (re-renders when the SRR Line override changes). */
export function useLineOperationalMode(plantId: string, lineId: string): LineOperationalMode {
  useSyncExternalStore(subscribeAssetMaster, assetMasterVersion, () => 0);
  return getLineOperationalMode(plantId, lineId);
}

declare global {
  interface Window {
    setSrrLine?: typeof setSrrLine;
  }
}
if (typeof window !== "undefined") window.setSrrLine = setSrrLine;
