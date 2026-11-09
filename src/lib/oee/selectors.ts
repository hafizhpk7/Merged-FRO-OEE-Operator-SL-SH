/**
 * Single Source of Truth Selectors and DOM Parity Audit Engine for OEE Dashboard.
 * All UI surfaces (KPI cards, map labels, hover cards, 3D views, tables) query this module.
 */

import {
  getMetrics,
  getActivePO,
  getBottleneck,
  getActualRunRate,
  getSkuStandardRunRate,
  getMachineMaxRunRate,
  getMachineStopsCount,
  type EntityMetrics,
  type EntityType,
} from "./metrics-engine";
import { resolvePeriod, type PeriodKey, type ResolvedPeriod } from "./period";
import { PLANTS, getPlant, getZone, getLine, getMachine, plantAlarms, lineAlarms } from "./data";
import type { Status } from "./config";
import { getShiftTimeline } from "./machineEvents";
import { OEE_ACTIVE_LINES_BY_PLANT, getLineDataSource } from "./config";
import { computeOeeFromTotals, aggregateTotals, getMachineWeight } from "./oeeTotals";
import { getMachineShiftTotals } from "./machineShiftTotals";
import { getShiftInfo, SHIFT_SECONDS } from "./shiftClock";
import { computeOperatorCardMetrics } from "./operatorCardEngine";
import { getEngineTrendSeries } from "./trendEngine";
import { getEngineLossTree } from "./lossTreeEngine";
import { getNowMs } from "./shiftClock";

export const DEBUG_PARITY = true;

/**
 * Main metric selector.
 */
export function selectMetrics(
  plantId: string,
  entityType: EntityType,
  entityId: string = "",
  period?: PeriodKey | ResolvedPeriod,
): EntityMetrics {
  return getMetrics(plantId, entityType, entityId, period);
}

/**
 * Status selector ensuring single source of truth across stack lights, hover badges, map colors.
 * A line is DOWN only if one of its machines is DOWN and a machine is DOWN only if it has an ongoing stop or OCCURRING alarm.
 */
export function selectStatus(plantId: string, lineId: string, machineId?: string): Status {
  const l =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);

  if (machineId) {
    const cleanId = machineId.replace(new RegExp(`^${lineId}-`), "");
    try {
      const timeline = getShiftTimeline(cleanId);
      const activeState = timeline.snapshot.status.state;
      if (activeState === "down") return "down";
      if (activeState === "slow") return "slow";
      if (activeState === "idle") return "idle";
    } catch {
      // fallback
    }

    const m =
      l?.machines.find(
        (mach) =>
          mach.id === machineId ||
          mach.code === machineId ||
          mach.key === machineId ||
          mach.id === cleanId ||
          mach.code === cleanId ||
          mach.key === `${lineId}-${cleanId}`,
      ) ||
      getMachine(plantId, "A", lineId, machineId) ||
      getMachine(plantId, "B", lineId, machineId) ||
      getMachine(plantId, "C", lineId, machineId);
    if (m) return m.status;
  }

  if (!l || !l.machines || l.machines.length === 0) return l?.status ?? "running";

  // Derive line status from machines (worst wins: down > slow > running > idle)
  const machineStatuses = l.machines.map((mach) =>
    selectStatus(plantId, lineId, mach.code || mach.id),
  );
  if (machineStatuses.includes("down")) return "down";
  if (machineStatuses.includes("slow")) return "slow";
  if (machineStatuses.every((s) => s === "idle")) return "idle";
  return "running";
}

/**
 * Active PO selector.
 */
export function selectPO(plantId: string, lineId: string) {
  return getActivePO(plantId, lineId);
}

/**
 * Bottleneck machine selector.
 */
export function selectBottleneck(plantId: string, lineId: string) {
  return getBottleneck(plantId, lineId);
}

/**
 * Lines down counts selector.
 */
export function selectLinesDown(plantId: string, zoneId?: string) {
  const plant = getPlant(plantId);
  const zones = zoneId && plant ? plant.zones.filter((z) => z.id === zoneId) : (plant?.zones ?? []);
  const lines = zones.flatMap((z) => z.lines);

  let running = 0;
  let slow = 0;
  let down = 0;
  let idle = 0;

  for (const l of lines) {
    if (l.status === "running") running++;
    else if (l.status === "slow") slow++;
    else if (l.status === "down") down++;
    else if (l.status === "idle") idle++;
  }

  return {
    total: lines.length,
    running,
    slow,
    down,
    idle,
    downAndSlow: down + slow,
  };
}

/**
 * Alarms count selector.
 */
export function selectAlarmCounts(plantId: string, zoneId?: string) {
  const plant = getPlant(plantId);
  if (!plant) return { total: 0, occurring: 0, resolved: 0 };
  const alarms = plantAlarms(plant);
  const filtered = zoneId ? alarms.filter((a) => a.zoneId === zoneId) : alarms;

  const occurring = filtered.filter((a) => a.status === "OCCURRING").length;
  const resolved = filtered.length - occurring;

  return {
    total: filtered.length,
    occurring,
    resolved,
  };
}

/* ------------------------------------------------------------------ FORMATTERS */

export function formatPct(val: number, compact: boolean = false): string {
  if (val === undefined || isNaN(val)) return "-";
  if (compact) return `${Math.round(val)}%`;
  return `${val.toFixed(1)}%`;
}

export function formatCount(val: number): string {
  if (val === undefined || isNaN(val)) return "-";
  return val.toLocaleString();
}

export function formatRate(val: number): string {
  if (val === undefined || isNaN(val)) return "-";
  return `${val.toLocaleString()} ppm`;
}

/* ------------------------------------------------------------------ DOM PARITY AUDIT */

export type ParityMismatch = {
  key: string;
  expected: number;
  actualValues: number[];
  elementsCount: number;
  message: string;
};

declare global {
  interface Window {
    runParityAudit: () => ParityMismatch[];
  }
}

export interface MachineNotTaggedState {
  notTaggedCount: number;
  taggedCount: number;
  allCount: number;
  notTaggedDurationSec: number;
  taggedDurationSec: number;
  totalDurationSec: number;
  activeStopNotTagged: boolean;
}

/**
 * Single source of truth selector for Machine Loss Tagging counts.
 * Used by Loss Clarification header, Not Tagged tab, Machine Events counter, and Active Stop banner.
 */
export function selectMachineNotTaggedState(
  events: {
    type: string;
    durationSec: number;
    isTagged?: boolean;
    causes?: { l2CategoryName?: string }[];
    isOngoing?: boolean;
  }[],
  activeStopEvent?: { isTagged?: boolean; causes?: { l2CategoryName?: string }[] },
): MachineNotTaggedState {
  // NSL (negative speed loss) is classifiable in the Operator tab but is not a loss.
  const lossEvents = events.filter((e) => e.type !== "run" && e.type !== "negative_speed_loss");

  let notTaggedCount = 0;
  let taggedCount = 0;
  let notTaggedDurationSec = 0;
  let taggedDurationSec = 0;

  for (const e of lossEvents) {
    const isTagged = Boolean(
      e.isTagged &&
      e.causes &&
      e.causes.length > 0 &&
      e.causes[0]?.l2CategoryName !== "Not Tagged Yet",
    );
    if (isTagged) {
      taggedCount++;
      taggedDurationSec += e.durationSec;
    } else {
      notTaggedCount++;
      notTaggedDurationSec += e.durationSec;
    }
  }

  const activeStopNotTagged = activeStopEvent
    ? !(
        activeStopEvent.isTagged &&
        activeStopEvent.causes &&
        activeStopEvent.causes.length > 0 &&
        activeStopEvent.causes[0]?.l2CategoryName !== "Not Tagged Yet"
      )
    : false;

  return {
    notTaggedCount,
    taggedCount,
    allCount: lossEvents.length,
    notTaggedDurationSec,
    taggedDurationSec,
    totalDurationSec: notTaggedDurationSec + taggedDurationSec,
    activeStopNotTagged,
  };
}

export function runParityAudit(): ParityMismatch[] {
  const mismatches: ParityMismatch[] = [];

  // 1. Audit pilot lines in J2 (TUP01, TUP13, TUP14, BOP15, BOP16)
  const pilotLines = OEE_ACTIVE_LINES_BY_PLANT["J2"] ?? [];
  const shiftInfo = getShiftInfo();

  for (const lineId of pilotLines) {
    const line =
      getLine("J2", "A", lineId) || getLine("J2", "B", lineId) || getLine("J2", "C", lineId);
    if (!line) continue;

    // Check each machine
    for (const machine of line.machines) {
      const mCode = machine.code || machine.id;
      const slshMetrics = getMetrics("J2", "machine", mCode, "this-shift");

      // Operator page computation from machine windows
      const nowMs = getNowMs();
      const nowFloor30s = Math.floor(nowMs / 30000) * 30000;
      const shiftStartMs = shiftInfo.startSec * 1000;
      const elapsedSec = Math.min(
        SHIFT_SECONDS,
        Math.max(0, Math.floor((nowFloor30s - shiftStartMs) / 1000)),
      );
      const revealedSec = Math.floor(elapsedSec / 30) * 30;

      const timeline = getShiftTimeline(mCode, shiftInfo, revealedSec, "J2", "this-shift");
      const operatorSnapshot = timeline.snapshot;

      if (
        operatorSnapshot.oee !== null &&
        Math.abs(slshMetrics.oee - operatorSnapshot.oee) > 0.05
      ) {
        mismatches.push({
          key: `pilot-machine-oee-parity:${mCode}`,
          expected: operatorSnapshot.oee,
          actualValues: [slshMetrics.oee, operatorSnapshot.oee],
          elementsCount: 2,
          message: `SL/SH machine ${mCode} OEE (${slshMetrics.oee}%) differs from Operator page (${operatorSnapshot.oee}%)`,
        });
      }

      // Mathematical invariant: units - reject - rework = good output
      const expectedGood = Math.max(
        0,
        (slshMetrics.outputActual ?? 0) - (slshMetrics.outputReject ?? 0),
      );
      if (
        slshMetrics.outputGood !== undefined &&
        Math.abs(slshMetrics.outputGood - expectedGood) > 1
      ) {
        mismatches.push({
          key: `good-output-invariant:${mCode}`,
          expected: expectedGood,
          actualValues: [slshMetrics.outputGood, expectedGood],
          elementsCount: 2,
          message: `Machine ${mCode} good output invariant failed: ${slshMetrics.outputGood} !== ${expectedGood}`,
        });
      }

      // Mathematical invariant: delta = current - compare
      const expectedDeltaOee = Math.round((slshMetrics.oee - slshMetrics.compareOee) * 10) / 10;
      if (Math.abs(slshMetrics.deltaOee - expectedDeltaOee) > 0.05) {
        mismatches.push({
          key: `delta-oee-invariant:${mCode}`,
          expected: expectedDeltaOee,
          actualValues: [slshMetrics.deltaOee, expectedDeltaOee],
          elementsCount: 2,
          message: `Machine ${mCode} delta OEE invariant failed: ${slshMetrics.deltaOee} !== ${expectedDeltaOee}`,
        });
      }
    }

    // Operator Card (SKU-OFF) vs SL/SH Line Parity
    const cardMetricsOff = computeOperatorCardMetrics("J2", lineId, false);
    const lineMetrics = getMetrics("J2", "line", lineId, "this-shift");
    if (Math.abs(cardMetricsOff.lineMetrics.oeePct - lineMetrics.oee) > 0.05) {
      mismatches.push({
        key: `operator-card-parity:${lineId}`,
        expected: cardMetricsOff.lineMetrics.oeePct,
        actualValues: [lineMetrics.oee, cardMetricsOff.lineMetrics.oeePct],
        elementsCount: 2,
        message: `Operator Card (SKU-OFF) line OEE (${cardMetricsOff.lineMetrics.oeePct}%) differs from SL/SH engine (${lineMetrics.oee}%)`,
      });
    }

    // Line Detail vs Bottleneck Parity for SEQ lines
    const bottleneckCode = getBottleneck("J2", lineId);
    const bnMetrics = getMetrics("J2", "machine", bottleneckCode, "this-shift");
    if (Math.abs(lineMetrics.oee - bnMetrics.oee) > 0.05) {
      mismatches.push({
        key: `line-vs-bottleneck-parity:${lineId}`,
        expected: bnMetrics.oee,
        actualValues: [lineMetrics.oee, bnMetrics.oee],
        elementsCount: 2,
        message: `Line ${lineId} OEE (${lineMetrics.oee}%) differs from bottleneck machine ${bottleneckCode} (${bnMetrics.oee}%)`,
      });
    }

    // TASK 5C Parity Checks: Chart last point = KPI card for all periods
    for (const periodKey of ["this-shift", "today", "this-week", "this-month"] as const) {
      const pMetrics = getMetrics("J2", "line", lineId, periodKey);
      const trendPoints = getEngineTrendSeries("J2", "line", lineId, periodKey);
      const lastPoint = trendPoints[trendPoints.length - 1];

      if (lastPoint && Math.abs(pMetrics.oee - lastPoint.OEE) > 0.05) {
        mismatches.push({
          key: `trend-last-point-parity:${lineId}:${periodKey}`,
          expected: pMetrics.oee,
          actualValues: [pMetrics.oee, lastPoint.OEE],
          elementsCount: 2,
          message: `Trend last point (${lastPoint.OEE}%) differs from KPI card (${pMetrics.oee}%) for ${lineId} ${periodKey}`,
        });
      }
    }
  }

  // TASK 5C Parity Checks: Loss Tree totals equal engine totals within 0.5 min
  const lossTreeNodes = getEngineLossTree("J2", "line", "BOP15", "this-shift");
  const bop15ShiftMetrics = getMetrics("J2", "line", "BOP15", "this-shift");

  for (const node of lossTreeNodes) {
    if (node.label === "Breakdown") {
      const expectedDMin = ((bop15ShiftMetrics as Record<string, unknown>).dMin as number) ?? 0;
      if (expectedDMin > 0 && Math.abs(node.minutes - expectedDMin) > 0.5) {
        mismatches.push({
          key: "loss-tree-breakdown-parity:BOP15",
          expected: expectedDMin,
          actualValues: [node.minutes, expectedDMin],
          elementsCount: 2,
          message: `Loss tree breakdown minutes (${node.minutes}) differs from engine dMin (${expectedDMin})`,
        });
      }
    }
  }

  // TASK 5C Parity Checks: Data Source Marker Chip
  for (const pilotId of pilotLines) {
    const ds = getLineDataSource("J2", pilotId);
    if (ds !== "SCADA") {
      mismatches.push({
        key: `data-source-chip:J2:${pilotId}`,
        expected: 1,
        actualValues: [0],
        elementsCount: 1,
        message: `Pilot line ${pilotId} data source should be SCADA, got ${ds}`,
      });
    }
  }

  const aukSource = getLineDataSource("J1", "TUP01");
  if (aukSource !== "AUK") {
    mismatches.push({
      key: "data-source-chip:J1:TUP01",
      expected: 1,
      actualValues: [0],
      elementsCount: 1,
      message: `Non-pilot line J1/TUP01 data source should be AUK, got ${aukSource}`,
    });
  }

  // 2. Zone and Plant aggregation verification
  const zoneAMetrics = getMetrics("J2", "zone", "A", "this-shift");
  const zoneA = getZone("J2", "A");
  if (zoneA) {
    const items = zoneA.lines.flatMap((l) =>
      l.machines.map((m) => {
        const mCode = m.code || m.id;
        const nowMs = getNowMs();
        const nowFloor30s = Math.floor(nowMs / 30000) * 30000;
        const totals = getMachineShiftTotals(
          "J2",
          l.id,
          mCode,
          shiftInfo.startSec * 1000,
          nowFloor30s,
        );
        return { totals, weight: getMachineWeight(mCode) };
      }),
    );
    const recomputed = aggregateTotals(items);
    if (Math.abs(zoneAMetrics.oee - recomputed.oeePct) > 0.05) {
      mismatches.push({
        key: "zone-recomputation-parity:J2:A",
        expected: recomputed.oeePct,
        actualValues: [zoneAMetrics.oee, recomputed.oeePct],
        elementsCount: 2,
        message: `Zone A OEE (${zoneAMetrics.oee}%) differs from aggregate totals recomputation (${recomputed.oeePct}%)`,
      });
    }
  }

  // 3. DOM-level checks (if browser document exists)
  if (typeof document !== "undefined") {
    const metricGroups = new Map<string, { rawValues: number[]; elements: Element[] }>();
    const elements = Array.from(document.querySelectorAll("[data-metric]"));
    for (const el of elements) {
      const key = el.getAttribute("data-metric");
      const rawStr = el.getAttribute("data-raw");
      if (!key || rawStr === null) continue;
      const rawVal = parseFloat(rawStr);
      if (isNaN(rawVal)) continue;

      if (!metricGroups.has(key)) {
        metricGroups.set(key, { rawValues: [], elements: [] });
      }
      const group = metricGroups.get(key)!;
      group.rawValues.push(rawVal);
      group.elements.push(el);
    }

    for (const [key, group] of metricGroups.entries()) {
      if (group.rawValues.length > 1) {
        const first = group.rawValues[0]!;
        const diff = group.rawValues.some((v) => Math.abs(v - first) > 0.05);
        if (diff) {
          mismatches.push({
            key,
            expected: first,
            actualValues: group.rawValues,
            elementsCount: group.elements.length,
            message: `Mismatch on ${key}: values [${group.rawValues.join(", ")}] differ in DOM`,
          });
        }
      }
    }
  }

  if (mismatches.length > 0) {
    console.warn("[OEE Parity Audit] Found mismatches:", mismatches);
  } else {
    console.info("[OEE Parity Audit] PASS — 0 mismatches found across engine & DOM hierarchy.");
  }

  return mismatches;
}

if (typeof window !== "undefined") {
  window.runParityAudit = runParityAudit;
}
