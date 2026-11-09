/**
 * Unified OEE Metrics Engine & Live Telemetry Store.
 * SINGLE SOURCE OF TRUTH for OEE / Availability / Performance / Quality hierarchy:
 * Machine -> Line (Bottleneck / SEQ / OR) -> Zone -> Plant -> Group.
 *
 * Implements TASK 5B:
 * - Single formula implementation via oeeTotals.ts
 * - Machine-shift totals from events and windows (machineShiftTotals.ts)
 * - Deterministic, reproducible metrics with no Math.random() or drift on closed periods
 * - Real signed deltas and previous-period comparisons
 * - High-performance caching per closed shift and 30s live bucket
 */

import { useSyncExternalStore } from "react";
import {
  PLANTS,
  getPlant,
  getZone,
  getLine,
  type Plant,
  type Zone,
  type Line,
  type Machine,
} from "./data";
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { resolvePeriod, type ResolvedPeriod, type PeriodKey } from "./period";
import { LINE_TOPOLOGY } from "./config";
import { getMachineProfile } from "./machineEvents";
import {
  computeOeeFromTotals,
  aggregateTotals,
  combineMachineTotals,
  getMachineWeight,
  type MachineTotals,
} from "./oeeTotals";
import {
  getMachineShiftTotals,
  clearCurrentShiftCache,
  resolveShiftInfoFromStartMs,
} from "./machineShiftTotals";
import { computeLineOeeFromTotals, type MachineTotalsInput } from "./lineOee";
import { rejectStore } from "./rejectStore";
import { SHIFT_SECONDS } from "./shiftClock";
import { getNowMs } from "./shiftClock";

/** Live tick interval in milliseconds for dashboard telemetry */
export const LIVE_TICK_MS = 5000;

/** Whether to show comparison row on Line Detail Output card */
export const SHOW_COMPARISON_ON_OUTPUT_CARD = true;

/** Placeholder string when a line is idle/off with no running PO */
export const PO_IDLE_PLACEHOLDER = "-";

/**
 * Deterministic Bottleneck configuration by line across all plants.
 */
export const BOTTLENECK_BY_LINE: Record<string, string> = (() => {
  const map: Record<string, string> = {};

  for (const lineCfg of J2_LINES_CONFIG) {
    const key = `J2:${lineCfg.code}`;
    const firstMachine = lineCfg.machines[0]?.code ?? "LTF01";
    const filler = lineCfg.machines.find(
      (m) => m.code.startsWith("LTF") || m.code.startsWith("LFL"),
    );
    map[key] = filler?.code ?? firstMachine;
  }

  for (const plant of PLANTS) {
    if (plant.id === "J2" || !plant.isOperational || !plant.zones) continue;
    for (const zone of plant.zones) {
      for (const line of zone.lines) {
        const key = `${plant.id}:${line.id}`;
        const first = line.machines[0]?.id ?? `${line.id}-M1`;
        map[key] = line.bottleneck && line.bottleneck !== "-" ? line.bottleneck : first;
      }
    }
  }

  return map;
})();

export function getBottleneck(plantId: string, lineId: string): string {
  const key = `${plantId}:${lineId}`;
  if (BOTTLENECK_BY_LINE[key]) {
    return BOTTLENECK_BY_LINE[key]!;
  }
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  return line?.machines[0]?.id ?? "M01";
}

export function getLineBottleneck(plantId: string, line: string | { id: string }): string {
  const lineId = typeof line === "string" ? line : line.id;
  return getBottleneck(plantId, lineId);
}

/**
 * Rated maximum run rate of a machine (in ppm).
 */
export function getMachineMaxRunRate(_plantId: string, machineCode: string): number {
  return getMachineProfile(machineCode).idealRatePpm;
}

/**
 * Standard run rate of a line (in ppm).
 */
export function getSkuStandardRunRate(plantId: string, lineId: string, sku?: string): number {
  const bottleneck = getBottleneck(plantId, lineId);
  const maxRate = getMachineMaxRunRate(plantId, bottleneck);
  return Math.round(maxRate * 0.88);
}

/**
 * Accessor for the active run rate of a line (in ppm).
 */
export function getActualRunRate(
  plantId: string,
  lineId: string,
  period: ResolvedPeriod | PeriodKey = "this-shift",
): number {
  const metrics = getMetrics(plantId, "line", lineId, period);
  return metrics.speed ?? 0;
}

/**
 * Accessor for the number of stops for a machine across the selected period.
 */
export function getMachineStopsCount(
  plantId: string,
  machineCode: string,
  period: ResolvedPeriod | PeriodKey = "this-shift",
): number {
  const metrics = getMetrics(plantId, "machine", machineCode, period);
  return metrics.stopsCount ?? 0;
}

export type ActivePOInfo = {
  poNumber: string;
  batch: string;
  totalMPQ: number;
  currentOutput: number;
};

const poProgressState: Record<string, { currentOutput: number; lastTick: number }> = {};

export function getActivePO(plantId: string, lineId: string): ActivePOInfo | null {
  const key = `${plantId}:${lineId}`;
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);

  if (line && line.status === "idle") {
    return null;
  }

  const totalMPQ = 22000;
  if (!poProgressState[key]) {
    poProgressState[key] = { currentOutput: 12450, lastTick: getNowMs() };
  }

  const state = poProgressState[key]!;
  return {
    poNumber: "PO-2811",
    batch: "B2204",
    totalMPQ,
    currentOutput: Math.min(totalMPQ, state.currentOutput),
  };
}

function advancePoProgress() {
  for (const key in poProgressState) {
    const state = poProgressState[key];
    if (state) {
      state.currentOutput += 3;
      state.lastTick = getNowMs();
    }
  }
}

/* ------------------------------------------------------------------ LIVE TICK BUS */

type TickListener = () => void;
const listeners = new Set<TickListener>();
let globalTickCount = 0;
let tickTimer: number | null = null;
let isTabVisible = true;

function notifyTick() {
  globalTickCount++;
  advancePoProgress();
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

function startTickTimer() {
  if (typeof window === "undefined") return;
  if (tickTimer) return;
  tickTimer = window.setInterval(() => {
    if (isTabVisible) {
      notifyTick();
    }
  }, LIVE_TICK_MS);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    isTabVisible = !document.hidden;
    if (isTabVisible) {
      notifyTick();
      startTickTimer();
    }
  });
  startTickTimer();
}

if (typeof window !== "undefined") {
  rejectStore.subscribe(() => {
    clearMetricsCache();
    notifyTick();
  });
}

export function useLiveTick(): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => globalTickCount,
    () => 0,
  );
}

/* ------------------------------------------------------------------ METRICS ENGINE */

export type EntityType = "plant" | "zone" | "line" | "machine" | "group";

export type EntityMetrics = {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  compareAvailability: number;
  comparePerformance: number;
  compareQuality: number;
  compareOee: number;
  deltaAvailability: number;
  deltaPerformance: number;
  deltaQuality: number;
  deltaOee: number;
  stopsCount?: number;
  speed?: number;
  runningMinutes?: number;
  outputActual?: number;
  outputTarget?: number;
  outputGood?: number;
  outputReject?: number;
  compareOutputActual?: number;
  deltaOutputActual?: number;
  deltas?: {
    availability: number;
    performance: number;
    quality: number;
    oee: number;
  };
  actualRunRate?: number;
  runRateSku?: number;
  activePo?: string;
};

// Caching layer for computed entity metrics
const metricsCache = new Map<string, { metrics: EntityMetrics; expiry: number }>();
// Caching layer for machine period totals
const machinePeriodTotalsCache = new Map<string, MachineTotals>();

export function clearMetricsCache() {
  metricsCache.clear();
  machinePeriodTotalsCache.clear();
  clearCurrentShiftCache();
}

/**
 * Finds the epoch timestamp in ms of the shift start on or immediately before `ms`.
 * Shifts in WIB: 07:00 (A), 15:00 (B), 23:00 (C).
 */
export function getShiftStartMsBefore(ms: number): number {
  const wibMs = ms + 7 * 3600000;
  const wib = new Date(wibMs);
  const h = wib.getUTCHours();

  let startH = 7;
  let dayOffset = 0;

  if (h >= 7 && h < 15) {
    startH = 7;
  } else if (h >= 15 && h < 23) {
    startH = 15;
  } else {
    startH = 23;
    if (h < 7) {
      dayOffset = -1;
    }
  }

  const d = new Date(wibMs);
  if (dayOffset !== 0) {
    d.setUTCDate(d.getUTCDate() + dayOffset);
  }
  d.setUTCHours(startH, 0, 0, 0);
  return d.getTime() - 7 * 3600000;
}

/**
 * Gathers and combines MachineTotals for a machine across all shifts overlapping [startMs, endMs].
 */
export function getMachinePeriodTotals(
  plantId: string,
  lineId: string,
  machineCode: string,
  startMs: number,
  endMs: number,
): MachineTotals {
  const nowMs = getNowMs();
  const nowFloor30s = Math.floor(nowMs / 30000) * 30000;
  const effectiveEndMs = Math.min(endMs, nowFloor30s);

  if (effectiveEndMs <= startMs) {
    return {
      calendarMin: 0,
      naMin: 0,
      usMin: 0,
      pdMin: 0,
      dMin: 0,
      msMin: 0,
      slPosMin: 0,
      slNegMin: 0,
      units: 0,
      reject: 0,
      rework: 0,
      runningMin: 0,
      stops: 0,
    };
  }

  const isClosed = effectiveEndMs < nowFloor30s;
  const cacheKey = `${plantId}:${lineId}:${machineCode}:${startMs}:${effectiveEndMs}`;

  if (isClosed && machinePeriodTotalsCache.has(cacheKey)) {
    return machinePeriodTotalsCache.get(cacheKey)!;
  }

  const shiftTotalsList: MachineTotals[] = [];
  let curShiftStart = getShiftStartMsBefore(startMs);

  while (curShiftStart < effectiveEndMs) {
    const curShiftEnd = curShiftStart + SHIFT_SECONDS * 1000;
    const shiftOverlapEnd = Math.min(curShiftEnd, effectiveEndMs);

    if (shiftOverlapEnd > curShiftStart) {
      const shiftTotals = getMachineShiftTotals(
        plantId,
        lineId,
        machineCode,
        curShiftStart,
        shiftOverlapEnd,
      );

      // If startMs falls inside this shift, scale proportionally by the revealed slice
      if (startMs > curShiftStart) {
        const fullShiftDuration = shiftOverlapEnd - curShiftStart;
        const subDuration = shiftOverlapEnd - startMs;
        if (fullShiftDuration > 0 && subDuration < fullShiftDuration) {
          const ratio = Math.max(0, subDuration / fullShiftDuration);
          shiftTotalsList.push({
            calendarMin: Math.round(shiftTotals.calendarMin * ratio * 100) / 100,
            naMin: Math.round(shiftTotals.naMin * ratio * 100) / 100,
            usMin: Math.round(shiftTotals.usMin * ratio * 100) / 100,
            pdMin: Math.round(shiftTotals.pdMin * ratio * 100) / 100,
            dMin: Math.round(shiftTotals.dMin * ratio * 100) / 100,
            msMin: Math.round(shiftTotals.msMin * ratio * 100) / 100,
            slPosMin: Math.round(shiftTotals.slPosMin * ratio * 100) / 100,
            slNegMin: Math.round(shiftTotals.slNegMin * ratio * 100) / 100,
            units: Math.round(shiftTotals.units * ratio),
            reject: Math.round(shiftTotals.reject * ratio),
            rework: Math.round(shiftTotals.rework * ratio),
            runningMin: Math.round(shiftTotals.runningMin * ratio * 100) / 100,
            stops: Math.max(1, Math.round(shiftTotals.stops * ratio)),
          });
        } else {
          shiftTotalsList.push(shiftTotals);
        }
      } else {
        shiftTotalsList.push(shiftTotals);
      }
    }

    curShiftStart = curShiftEnd;
  }

  const result = combineMachineTotals(shiftTotalsList);
  if (isClosed) {
    machinePeriodTotalsCache.set(cacheKey, result);
  }
  return result;
}

/**
 * Computes raw entity metrics and totals for any entity and time window.
 */
function computeEntityMetricsForWindow(
  plantId: string,
  entityType: EntityType,
  entityId: string,
  startMs: number,
  endMs: number,
): { metrics: ReturnType<typeof computeOeeFromTotals>; totals: MachineTotals; stdPpm: number } {
  if (entityType === "machine") {
    let lineId = "";
    let machineCode = entityId;

    if (entityId.includes(":")) {
      const parts = entityId.split(":");
      lineId = parts[0] || "";
      machineCode = parts[1] || "";
    } else {
      const plant = getPlant(plantId);
      if (plant?.zones) {
        for (const z of plant.zones) {
          for (const l of z.lines) {
            const cleanId = entityId.replace(new RegExp(`^${l.id}-`), "");
            const found = l.machines.find(
              (m) =>
                m.id === entityId || m.code === entityId || m.id === cleanId || m.code === cleanId,
            );
            if (found) {
              lineId = l.id;
              machineCode = found.code || found.id;
              break;
            }
          }
          if (lineId) break;
        }
      }
    }

    const totals = getMachinePeriodTotals(plantId, lineId, machineCode, startMs, endMs);
    const metrics = computeOeeFromTotals(totals);
    const stdPpm = getMachineMaxRunRate(plantId, machineCode);
    return { metrics, totals, stdPpm };
  }

  if (entityType === "line") {
    const lineId = entityId;
    const topology = LINE_TOPOLOGY[lineId] ?? "SEQ";
    const bottleneck = getBottleneck(plantId, lineId);

    const line =
      getLine(plantId, "A", lineId) ||
      getLine(plantId, "B", lineId) ||
      getLine(plantId, "C", lineId);

    const machines = line?.machines || [{ id: bottleneck, code: bottleneck, name: bottleneck }];

    const inputs: MachineTotalsInput[] = machines.map((m) => {
      const mCode = m.code || m.id;
      const totals = getMachinePeriodTotals(plantId, lineId, mCode, startMs, endMs);
      const stdPpm = getMachineMaxRunRate(plantId, mCode);
      const isParallel = Boolean((m as { isParallel?: boolean }).isParallel);
      return {
        machineCode: mCode,
        totals,
        stdPpm,
        isParallel,
        weight: getMachineWeight(mCode),
      };
    });

    const { metrics, totals } = computeLineOeeFromTotals(inputs, topology, bottleneck);
    const stdPpm = getSkuStandardRunRate(plantId, lineId);
    return { metrics, totals, stdPpm };
  }

  if (entityType === "zone") {
    const zoneId = entityId;
    const zone = getZone(plantId, zoneId);
    const lines = zone?.lines ?? [];

    const items: { totals: MachineTotals; weight: number }[] = [];
    const totalsList: MachineTotals[] = [];

    for (const l of lines) {
      for (const m of l.machines) {
        const mCode = m.code || m.id;
        const mTotals = getMachinePeriodTotals(plantId, l.id, mCode, startMs, endMs);
        items.push({ totals: mTotals, weight: getMachineWeight(mCode) });
        totalsList.push(mTotals);
      }
    }

    const metrics = aggregateTotals(items);
    const totals = combineMachineTotals(totalsList);
    return { metrics, totals, stdPpm: 150 };
  }

  if (entityType === "plant") {
    const plant = getPlant(plantId);
    const zones = plant?.zones ?? [];

    const items: { totals: MachineTotals; weight: number }[] = [];
    const totalsList: MachineTotals[] = [];

    for (const z of zones) {
      for (const l of z.lines) {
        for (const m of l.machines) {
          const mCode = m.code || m.id;
          const mTotals = getMachinePeriodTotals(plantId, l.id, mCode, startMs, endMs);
          items.push({ totals: mTotals, weight: getMachineWeight(mCode) });
          totalsList.push(mTotals);
        }
      }
    }

    const metrics = aggregateTotals(items);
    const totals = combineMachineTotals(totalsList);
    return { metrics, totals, stdPpm: 150 };
  }

  // Group
  const items: { totals: MachineTotals; weight: number }[] = [];
  const totalsList: MachineTotals[] = [];
  const operationalPlants = PLANTS.filter((p) => p.isOperational);

  for (const p of operationalPlants) {
    for (const z of p.zones ?? []) {
      for (const l of z.lines) {
        for (const m of l.machines) {
          const mCode = m.code || m.id;
          const mTotals = getMachinePeriodTotals(p.id, l.id, mCode, startMs, endMs);
          items.push({ totals: mTotals, weight: getMachineWeight(mCode) });
          totalsList.push(mTotals);
        }
      }
    }
  }

  const metrics = aggregateTotals(items);
  const totals = combineMachineTotals(totalsList);
  return { metrics, totals, stdPpm: 150 };
}

/**
 * Universal metrics engine function used across ALL pages and plants.
 * SINGLE SOURCE OF TRUTH for OEE hierarchy.
 *
 * @param plantId - e.g. "J2", "J1", "J4"
 * @param entityType - 'plant' | 'zone' | 'line' | 'machine' | 'group'
 * @param entityId - ID of entity (e.g. "A", "TUP01", "LTF01")
 * @param period - ResolvedPeriod object or PeriodKey
 */
export function getMetrics(
  plantId: string,
  entityType: EntityType,
  entityId: string = "",
  period: ResolvedPeriod | PeriodKey = "this-shift",
): EntityMetrics {
  const resolved = typeof period === "string" ? resolvePeriod(period) : period;
  const isPastClosed = resolved.isPastClosed;
  const nowMs = getNowMs();
  const nowFloor30s = Math.floor(nowMs / 30000) * 30000;

  const startMs = resolved.start.getTime();
  const endMs = Math.min(resolved.end.getTime(), nowFloor30s);

  const cacheKey = isPastClosed
    ? `${plantId}:${entityType}:${entityId}:${startMs}:${resolved.end.getTime()}`
    : `${plantId}:${entityType}:${entityId}:${startMs}:${endMs}:${nowFloor30s}`;

  const cached = metricsCache.get(cacheKey);
  if (cached && (isPastClosed || cached.expiry > nowMs)) {
    return cached.metrics;
  }

  // 1. Current Window Metrics
  const { metrics, totals, stdPpm } = computeEntityMetricsForWindow(
    plantId,
    entityType,
    entityId,
    startMs,
    endMs,
  );

  // 2. Comparison Window Metrics (like-for-like equivalent period)
  const cmpStartMs = resolved.compareStart.getTime();
  const cmpEndMs = resolved.compareEnd.getTime();
  const { metrics: cmpMetrics, totals: cmpTotals } = computeEntityMetricsForWindow(
    plantId,
    entityType,
    entityId,
    cmpStartMs,
    cmpEndMs,
  );

  // 3. Deltas (real differences, signed, not clamped)
  const deltaAvailability =
    Math.round((metrics.availabilityPct - cmpMetrics.availabilityPct) * 10) / 10;
  const deltaPerformance =
    Math.round((metrics.performancePct - cmpMetrics.performancePct) * 10) / 10;
  const deltaQuality = Math.round((metrics.qualityPct - cmpMetrics.qualityPct) * 10) / 10;
  const deltaOee = Math.round((metrics.oeePct - cmpMetrics.oeePct) * 10) / 10;

  // 4. Output Fields (consistent physical numbers)
  const outputActual = totals.units;
  const outputReject = totals.reject;
  const outputGood = Math.max(0, totals.units - totals.reject - totals.rework);

  const sptMin = Math.max(0, totals.calendarMin - totals.naMin - totals.usMin - totals.pdMin);
  const outputTarget = Math.round(stdPpm * sptMin);

  const runningMinutes = Math.round(totals.runningMin * 10) / 10;
  const speed = totals.runningMin > 0 ? Math.round(totals.units / totals.runningMin) : 0;
  const stopsCount = totals.stops;

  const compareOutputActual = cmpTotals.units;
  const deltaOutputActual = outputActual - compareOutputActual;

  const poInfo = entityType === "line" ? getActivePO(plantId, entityId) : null;

  const result: EntityMetrics = {
    availability: metrics.availabilityPct,
    performance: metrics.performancePct,
    quality: metrics.qualityPct,
    oee: metrics.oeePct,
    compareAvailability: cmpMetrics.availabilityPct,
    comparePerformance: cmpMetrics.performancePct,
    compareQuality: cmpMetrics.qualityPct,
    compareOee: cmpMetrics.oeePct,
    deltaAvailability,
    deltaPerformance,
    deltaQuality,
    deltaOee,
    deltas: {
      availability: deltaAvailability,
      performance: deltaPerformance,
      quality: deltaQuality,
      oee: deltaOee,
    },
    actualRunRate: speed,
    runRateSku: stdPpm,
    activePo: poInfo?.poNumber ?? "-",
    stopsCount,
    speed,
    runningMinutes,
    outputActual,
    outputTarget,
    outputGood,
    outputReject,
    compareOutputActual,
    deltaOutputActual,
  };

  const ttl = isPastClosed ? 600000 : 4000;
  metricsCache.set(cacheKey, { metrics: result, expiry: nowMs + ttl });

  return result;
}
