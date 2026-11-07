/**
 * Unified Machine Events & Shift Timeline Generator.
 * SINGLE SOURCE OF TRUTH for:
 * - Shift timeline windows (30s buckets, 960 total per 8h shift)
 * - Event log (run, speed_loss, minor_stop, downtime, planned)
 * - OEE, Availability, Performance, Quality KPIs
 * - MTTR, MTBF, Stops this shift
 * - Live active stop state & downstream impacts
 * - Loss classification persistence
 */

import { useSyncExternalStore } from "react";
import { J2_LINES_CONFIG } from "./j2-layout-config";
import {
  autoParent,
  componentOf,
  matchPlcAlarmCode,
  ALARM_L1_PARENTS,
  slugify,
  type LossComponent,
  type LossParent,
} from "./lossTree";
import {
  NOT_TAGGED_LABEL,
  resolveDowntimeClassification,
  resolveEventClassification,
} from "./plcAlarmMap";
import { makeRng } from "./rng";
import { formatTimeWib, getShiftInfo, SHIFT_SECONDS, type ShiftInfo } from "./shiftClock";
import type { PeriodKey } from "./period";
import { computeMachineOee, type WindowData, classifyWindow } from "./windowEngine";
import { rejectStore } from "./rejectStore";
import { getLineLossFactor } from "./calibration";
import { getLine } from "./data";

export type EventType = "run" | "speed_loss" | "minor_stop" | "downtime" | "planned";

export interface LossCause {
  id: string;
  durationSec: number;
  l0Component: LossComponent;
  l1Parent: LossParent;
  l2CategoryId: string;
  l2CategoryName: string;
  l3ReasonId: string;
  l3ReasonName: string;
  causeMachineCode?: string;
  note?: string;
  groupId?: string;
  groupSize?: number;
  groupedBy?: string;
  groupedAt?: number;
}

export interface MachineEvent {
  id: string;
  machineCode: string;
  startSec: number; // Seconds from shift start (0..28800)
  endSec: number; // Seconds from shift start (0..28800)
  durationSec: number;
  startAt: number; // Canonical absolute epoch milliseconds
  endAt: number; // Canonical absolute epoch milliseconds
  type: EventType;
  speedPct?: number; // For speed_loss (e.g. 78%)
  plcAlarm?: string;
  orderId: string;
  sku: string;
  productName: string;
  isOngoing?: boolean;
  source?: "PLC" | "Non-PLC" | "Operator" | "You";
  causes: LossCause[];
  note?: string;
  causeMachineCode?: string;
  isTagged?: boolean;
  l0Component?: LossComponent;
  l1Parent?: LossParent;
  l2CategoryName?: string;
  l3ReasonName?: string;
}

export interface ProductionOrder {
  id: string;
  sku: string;
  productName: string;
  planQty: number;
  startSec: number;
  endSec: number;
}

export interface TimelineWindow {
  index: number;
  startSec: number;
  endSec: number;
  output: number;
  targetOutput: number;
  speedPpm: number;
  type: EventType;
  eventId?: string;
  needsReason?: boolean;
}

export interface ShiftSnapshot {
  machineCode: string;
  shiftKey: string;
  shiftLabel: string;
  idealRatePpm: number;
  planUnits: number;
  oee: number | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  totalOutput: number;
  goodOutput: number;
  rejects: number;
  rejectRatePct: number;
  outputVsPlanPct: number;
  totalLossSec: number;
  totalLossMin: number;
  stopsThisShift: number;
  mttrMin: number | null;
  mtbfMin: number | null;
  unclassifiedCount: number;
  notTaggedCount: number;
  unclassifiedSec: number;
  status: {
    state: "running" | "slow" | "down" | "idle" | "off";
    tone: "good" | "warn" | "bad" | "info" | "off";
    label: string;
    detail: string;
    sinceSec: number;
  };
  activeStop?: {
    event: MachineEvent;
    severity: "CRITICAL" | "WARNING" | "INFO";
    fault: string;
    startedAtTime: string;
    elapsedSec: number;
    downstreamMachines: string[];
    isClassified: boolean;
    lossBreadcrumb?: string;
    source?: "PLC" | "Non-PLC";
    l2Category?: string;
    l3Reason?: string;
    isTagged?: boolean;
  };
}

export interface ShiftTimelineResult {
  shift: ShiftInfo;
  machineCode: string;
  idealRatePpm: number;
  orders: ProductionOrder[];
  events: MachineEvent[];
  windows: TimelineWindow[];
  snapshot: ShiftSnapshot;
}

export const WINDOW_SEC = 30;
export const DOWNTIME_THRESHOLD_SEC = 600; // > 10 minutes (strictly greater than 600s)

// In-memory fallback for saved classifications if localStorage fails
const memoryClassificationStore = new Map<string, LossCause[]>();
let classificationVersion = 0;
const classificationListeners = new Set<() => void>();

export function useClassificationVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      classificationListeners.add(cb);
      return () => classificationListeners.delete(cb);
    },
    () => classificationVersion,
    () => 0,
  );
}

export function notifyClassificationChanged() {
  classificationVersion++;
  classificationListeners.forEach((l) => l());
}

export function getSavedClassifications(
  shiftKey: string,
  machineCode: string,
): Record<string, LossCause[]> {
  const key = `fro-oee-loss:${shiftKey}:${machineCode}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  const result: Record<string, LossCause[]> = {};
  memoryClassificationStore.forEach((causes, k) => {
    if (k.startsWith(`${shiftKey}:${machineCode}:`)) {
      const parts = k.split(":");
      const eventId = parts[2];
      if (eventId) {
        result[eventId] = causes;
      }
    }
  });
  return result;
}

/**
 * Normalizes event timestamps to ensure canonical absolute epoch milliseconds.
 * If startAt is non-finite, derives a deterministic fallback.
 */
export function normalizeEventTimestamps(event: MachineEvent, windowStartMs: number): MachineEvent {
  let startAt = event.startAt;
  let endAt = event.endAt;

  if (typeof startAt !== "number" || !Number.isFinite(startAt)) {
    startAt = windowStartMs + (Number.isFinite(event.startSec) ? event.startSec * 1000 : 0);
  }

  if (typeof endAt !== "number" || !Number.isFinite(endAt)) {
    const durationMs = Number.isFinite(event.durationSec) ? event.durationSec * 1000 : 0;
    endAt = startAt + durationMs;
  }

  return {
    ...event,
    startAt,
    endAt,
  };
}

/**
 * Gets downstream machines on the same line that could be affected
 */
export function getLineSiblingMachines(machineCode: string): { code: string; name: string }[] {
  for (const line of J2_LINES_CONFIG) {
    const found = line.machines.find((m) => m.code === machineCode);
    if (found) {
      return line.machines.map((m) => ({
        code: m.code || "",
        name: m.name || m.code || "",
      }));
    }
  }
  return [{ code: machineCode, name: machineCode }];
}

/**
 * Machine profiles specifying ideal production rates and default parameters
 */
export interface MachineProfile {
  idealRatePpm: number;
  planUnits: number;
  rejectRatePct: number;
  sku: string;
  productName: string;
}

export function getMachineProfile(machineCode: string): MachineProfile {
  // Tube Fillers (LTF / LTR)
  if (machineCode.startsWith("LTF") || machineCode.startsWith("LTR")) {
    return {
      idealRatePpm: 190,
      planUnits: 32000,
      rejectRatePct: 0.8,
      sku: "PO-2811 · 4000081204",
      productName: "Wardah Hydra Rose Gel Foam 100ML",
    };
  }
  // Bottle Fillers (LBF / LJF / Robofiller)
  if (
    machineCode.startsWith("LBF") ||
    machineCode.startsWith("LJF") ||
    machineCode.includes("RFL")
  ) {
    return {
      idealRatePpm: 120,
      planUnits: 22000,
      rejectRatePct: 0.9,
      sku: "PO-2811 · 4000081204",
      productName: "Wardah Hydra Rose Micellar Water 100ML",
    };
  }
  // Cappers
  if (machineCode.startsWith("LBC")) {
    return {
      idealRatePpm: 130,
      planUnits: 23000,
      rejectRatePct: 0.4,
      sku: "PO-2811 · 4000081204",
      productName: "Wardah Hydra Rose Micellar Water 100ML",
    };
  }
  // Carton / Case / Shrink
  return {
    idealRatePpm: 140,
    planUnits: 25000,
    rejectRatePct: 0.5,
    sku: "PO-2811 · 4000081204",
    productName: "Wardah Hydra Rose Micellar Water 100ML",
  };
}

/**
 * Sample pre-classification library for seeding 25% of items
 */
const SAMPLE_PRECLASSIFIED_REASONS = [
  {
    l0: "Availability" as LossComponent,
    l1: "Breakdown" as LossParent,
    catId: "availability.breakdown.pneumatic-system",
    catName: "Pneumatic System",
    reasonId: "availability.breakdown.pneumatic-system.air-hose-leakage",
    reasonName: "Air Hose Leakage",
  },
  {
    l0: "Performance" as LossComponent,
    l1: "Minor Stop" as LossParent,
    catId: "performance.minor-stop.sensor-detection",
    catName: "Sensor / Detection",
    reasonId: "performance.minor-stop.sensor-detection.product-sensing-error",
    reasonName: "Product Sensing Error",
  },
  {
    l0: "Availability" as LossComponent,
    l1: "Breakdown" as LossParent,
    catId: "availability.breakdown.filling-system",
    catName: "Filling System",
    reasonId: "availability.breakdown.filling-system.filler-error",
    reasonName: "Filler Error",
  },
  {
    l0: "Performance" as LossComponent,
    l1: "Speed Loss" as LossParent,
    catId: "performance.speed-loss.reduced-speed-for-quality",
    catName: "Reduced Speed for Quality",
    reasonId: "performance.speed-loss.reduced-speed-for-quality.slow-run-to-prevent-foaming",
    reasonName: "Slow run to prevent foaming",
  },
  {
    l0: "Loading" as LossComponent,
    l1: "Planned Downtime" as LossParent,
    catId: "loading.planned-downtime.breaks-meetings",
    catName: "Breaks & Meetings",
    reasonId: "loading.planned-downtime.breaks-meetings.pre-shift-talk-hello-time",
    reasonName: "Pre-Shift Talk (Hello Time)",
  },
];

/**
 * Generates the unified timeline and events, deterministic per (shiftKey + machineCode + period)
 */
export function getShiftTimeline(
  machineCode: string,
  shift: ShiftInfo = getShiftInfo(),
  liveNowSec?: number,
  plantId: string = "J2",
  periodKey: PeriodKey = "this-shift",
): ShiftTimelineResult {
  const profile = getMachineProfile(machineCode);
  const shiftKey = shift.shiftKey;
  const seed = `${plantId}:${shiftKey}:${machineCode}:${periodKey}`;
  const rng = makeRng(seed);

  // Time reveal boundary
  const revealSec =
    liveNowSec !== undefined ? Math.min(SHIFT_SECONDS, Math.max(0, liveNowSec)) : shift.elapsedSec;

  // Orders definition
  const orders: ProductionOrder[] = [
    {
      id: "PO-2811",
      sku: profile.sku,
      productName: profile.productName,
      planQty: Math.round(profile.planUnits * 0.65),
      startSec: 0,
      endSec: 18000,
    },
    {
      id: "PO-2810",
      sku: profile.sku.replace("2811", "2810"),
      productName: "Wardah Nature Daily Aloe Toner 150ML",
      planQty: Math.round(profile.planUnits * 0.35),
      startSec: 18000,
      endSec: 28800,
    },
  ];

  // Saved user classifications from persistent store
  const savedClassifications = getSavedClassifications(shiftKey, machineCode);

  // Determine target event count based on period guideline
  let targetEventCount = 8;
  if (periodKey === "today") targetEventCount = 18;
  else if (periodKey === "this-week") targetEventCount = 30;
  else if (periodKey === "this-month") targetEventCount = 50;
  else if (periodKey === "custom") targetEventCount = 25;

  const windowStartMs = shift.startSec * 1000;
  const rawEvents: MachineEvent[] = [];

  // 1. First event: Planned briefing
  const firstEvId = `${plantId}-${machineCode}-EV-01`;
  rawEvents.push(
    normalizeEventTimestamps(
      {
        id: firstEvId,
        machineCode,
        startSec: 0,
        endSec: 900,
        durationSec: 900,
        startAt: windowStartMs,
        endAt: windowStartMs + 900 * 1000,
        type: "planned",
        orderId: "PO-2811",
        sku: orders[0]?.sku || "",
        productName: orders[0]?.productName || "",
        source: "Operator",
        causes: [
          {
            id: `C-${firstEvId}-0`,
            durationSec: 900,
            l0Component: "Loading",
            l1Parent: "Planned Downtime",
            l2CategoryId: "loading.planned-downtime.breaks-meetings",
            l2CategoryName: "Breaks & Meetings",
            l3ReasonId: "loading.planned-downtime.breaks-meetings.briefing",
            l3ReasonName: "Briefing",
          },
        ],
      },
      windowStartMs,
    ),
  );

  const lineId =
    J2_LINES_CONFIG.find((l) => l.machines.some((m) => m.code === machineCode))?.code || "";
  const lossFactor = getLineLossFactor(plantId, lineId);

  const staticLine =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const staticMachine = staticLine?.machines.find(
    (m) => m.code === machineCode || m.id === machineCode,
  );
  const isMachineDown =
    staticMachine?.status === "down" ||
    (staticLine?.status === "down" && staticLine.machines[0]?.code === machineCode);

  targetEventCount = 11;
  const intervalSpacing = Math.floor((SHIFT_SECONDS - 1800) / targetEventCount);

  for (let i = 1; i < targetEventCount; i++) {
    const evId = `${plantId}-${machineCode}-EV-${String(i + 1).padStart(2, "0")}`;
    const startSec = 1000 + i * intervalSpacing + Math.floor(rng() * 100);
    if (startSec >= SHIFT_SECONDS - 60) break;

    const rType = rng();
    let type: EventType = "minor_stop";
    let durationSec = 30;
    let speedPct: number | undefined;
    let plcAlarm: string | undefined;

    if (rType < 0.28) {
      type = "downtime";
      durationSec = Math.max(660, Math.round((700 + Math.floor(rng() * 1000)) * lossFactor * 0.72));
      const downtimeFaults = [
        "Filler Error",
        "Piston Pump Sensor Error",
        "Carton Magazine Error",
        "Air Hose Leakage",
        "Pusher Error",
        "Conveyor jam at infeed",
        "Mechanical drive failure",
        undefined,
      ];
      plcAlarm = downtimeFaults[i % downtimeFaults.length];
    } else if (rType < 0.6) {
      type = "speed_loss";
      durationSec = Math.round((900 + Math.floor(rng() * 1000)) * lossFactor * 0.82);
      speedPct = Math.max(
        52,
        Math.min(86, Math.round((72 + Math.floor(rng() * 16)) / Math.sqrt(lossFactor))),
      );
    } else if (rType < 0.9) {
      type = "minor_stop";
      durationSec = Math.round((45 + Math.floor(rng() * 180)) * lossFactor * 0.75);
      plcAlarm = rng() > 0.5 ? "Product Sensing Error" : undefined;
    } else {
      type = "planned";
      durationSec = 600 + Math.floor(rng() * 600);
    }

    const endSec = Math.min(SHIFT_SECONDS, startSec + durationSec);
    const order = startSec >= 18000 ? orders[1] : orders[0];

    const resolved = resolveEventClassification(type, plcAlarm, evId, i);
    const causes = resolved.causes.map((c) => ({
      ...c,
      durationSec,
      causeMachineCode: machineCode,
    }));

    rawEvents.push(
      normalizeEventTimestamps(
        {
          id: evId,
          machineCode,
          startSec,
          endSec,
          durationSec,
          startAt: windowStartMs + startSec * 1000,
          endAt: windowStartMs + endSec * 1000,
          type,
          ...(speedPct !== undefined ? { speedPct } : {}),
          ...(plcAlarm !== undefined ? { plcAlarm } : {}),
          orderId: order?.id || "",
          sku: order?.sku || "",
          productName: order?.productName || "",
          source: resolved.source,
          isTagged: resolved.isTagged,
          l0Component: resolved.l0Component,
          l1Parent: resolved.l1Parent,
          l2CategoryName: resolved.l2CategoryName,
          l3ReasonName: resolved.l3ReasonName,
          causes,
        },
        windowStartMs,
      ),
    );
  }

  // Ongoing stop if currently near active time in live mode
  if (revealSec < SHIFT_SECONDS && revealSec > 1800) {
    const ongoingStart = isMachineDown
      ? Math.min(900, Math.floor(revealSec * 0.25))
      : Math.max(1200, revealSec - 600);
    const ongoingId = `${plantId}-${machineCode}-EV-ONGOING`;
    const ongoingDur = Math.max(30, revealSec - ongoingStart);
    const ongoingType: EventType = ongoingDur > DOWNTIME_THRESHOLD_SEC ? "downtime" : "minor_stop";
    const ongoingAlarm = "Conveyor jam at infeed";
    const resolved = resolveEventClassification(ongoingType, ongoingAlarm, ongoingId, 99);
    const causes = resolved.causes.map((c) => ({
      ...c,
      durationSec: ongoingDur,
      causeMachineCode: machineCode,
    }));

    // Remove any raw events starting at or after ongoingStart
    const priorEvents = rawEvents.filter((e) => e.startSec < ongoingStart);
    rawEvents.length = 0;
    rawEvents.push(
      ...priorEvents,
      normalizeEventTimestamps(
        {
          id: ongoingId,
          machineCode,
          startSec: ongoingStart,
          endSec: revealSec,
          durationSec: ongoingDur,
          startAt: windowStartMs + ongoingStart * 1000,
          endAt: windowStartMs + revealSec * 1000,
          type: ongoingType,
          orderId: ongoingStart >= 18000 ? "PO-2810" : "PO-2811",
          sku: ongoingStart >= 18000 ? orders[1]?.sku || "" : orders[0]?.sku || "",
          productName:
            ongoingStart >= 18000 ? orders[1]?.productName || "" : orders[0]?.productName || "",
          plcAlarm: ongoingAlarm,
          isOngoing: true,
          source: resolved.source,
          isTagged: resolved.isTagged,
          l0Component: resolved.l0Component,
          l1Parent: resolved.l1Parent,
          l2CategoryName: resolved.l2CategoryName,
          l3ReasonName: resolved.l3ReasonName,
          causes,
        },
        windowStartMs,
      ),
    );
  }

  // 3. Filter active events for current timeline
  const activeEvents = rawEvents
    .filter((e) => e.startSec < revealSec || periodKey !== "this-shift")
    .map((e) => {
      const isOngoing = Boolean(e.isOngoing && revealSec < SHIFT_SECONDS);
      const effEnd = isOngoing ? revealSec : e.endSec;
      const effDur = Math.max(30, effEnd - e.startSec);
      let effType = e.type;
      if (effType === "minor_stop" && effDur > DOWNTIME_THRESHOLD_SEC) {
        effType = "downtime";
      }

      const baseEvent: MachineEvent = {
        ...e,
        endSec: effEnd,
        durationSec: effDur,
        endAt: windowStartMs + effEnd * 1000,
        type: effType,
        isOngoing,
      };

      return normalizeEventTimestamps(baseEvent, windowStartMs);
    });

  // 4. Generate 30s Timeline Windows (0..960)
  const totalWindows = Math.floor(SHIFT_SECONDS / WINDOW_SEC);
  const windows: TimelineWindow[] = [];

  let producedCount = 0;
  let rejectsCount = 0;
  let plannedSec = 0;
  let downSec = 0;
  let minorSec = 0;
  let speedLossSec = 0;

  let evIdx = 0;
  for (let wIdx = 0; wIdx < totalWindows; wIdx++) {
    const wStart = wIdx * WINDOW_SEC;
    const wEnd = wStart + WINDOW_SEC;
    const isFuture = wStart >= revealSec;

    // Find active event overlapping window center
    const wMid = wStart + WINDOW_SEC / 2;
    while (evIdx < activeEvents.length && (activeEvents[evIdx]?.endSec ?? 0) <= wMid) {
      evIdx++;
    }
    const currentEv = activeEvents[evIdx];
    const activeEv =
      currentEv && currentEv.startSec <= wMid && wMid < currentEv.endSec ? currentEv : undefined;

    let type: EventType = "run";
    let speedPpm = profile.idealRatePpm;
    let unitsInWindow = (profile.idealRatePpm * WINDOW_SEC) / 60;
    const targetUnitsInWindow = (profile.idealRatePpm * WINDOW_SEC) / 60;
    let needsReason = false;

    if (isFuture) {
      windows.push({
        index: wIdx,
        startSec: wStart,
        endSec: wEnd,
        output: 0,
        targetOutput: targetUnitsInWindow,
        speedPpm: 0,
        type: "run",
      });
      continue;
    }

    if (activeEv) {
      type = activeEv.type;
      needsReason = type !== "run" && !activeEv.isTagged;

      if (type === "planned") {
        speedPpm = 0;
        unitsInWindow = 0;
        plannedSec += WINDOW_SEC;
      } else if (type === "downtime") {
        speedPpm = 0;
        unitsInWindow = 0;
        downSec += WINDOW_SEC;
      } else if (type === "minor_stop") {
        speedPpm = 0;
        unitsInWindow = 0;
        minorSec += WINDOW_SEC;
      } else if (type === "speed_loss") {
        const pct = activeEv.speedPct ?? 78;
        speedPpm = Math.round((profile.idealRatePpm * pct) / 100);
        unitsInWindow = Math.round((targetUnitsInWindow * pct) / 100);
        speedLossSec += WINDOW_SEC * (1 - pct / 100);
      }
    }

    // Accumulate production & rejects
    producedCount += unitsInWindow;
    if (unitsInWindow > 0) {
      rejectsCount += (unitsInWindow * profile.rejectRatePct) / 100;
    }

    const status =
      type === "run"
        ? classifyWindow(unitsInWindow, targetUnitsInWindow)
        : type === "downtime"
          ? "D"
          : type === "minor_stop"
            ? "MS"
            : type === "speed_loss"
              ? "SL"
              : "EF";

    windows.push({
      index: wIdx,
      startSec: wStart,
      endSec: wEnd,
      output: Math.round(unitsInWindow),
      targetOutput: Math.round(targetUnitsInWindow),
      speedPpm: Math.round(speedPpm),
      type,
      ...(activeEv?.id !== undefined ? { eventId: activeEv.id } : {}),
      needsReason,
    });
  }

  // 5. Calculate Standard OEE Metrics (Shift-to-date)
  const numRevealed = Math.floor(revealSec / WINDOW_SEC);
  const revealedWindows = windows.slice(0, numRevealed);
  const revealedProduced = revealedWindows.reduce((acc, w) => acc + w.output, 0);

  let reject = 0;
  let rework = 0;
  const storeTotals = rejectStore.getTotals(plantId, lineId, shiftKey, machineCode);
  if (storeTotals.totalReject > 0 || storeTotals.totalRework > 0) {
    reject = storeTotals.totalReject;
    rework = storeTotals.totalRework;
  } else {
    const calibratedRejectRate = Math.min(3.2, Math.max(0.7, 1.7 * Math.sqrt(lossFactor)));
    reject = Math.round((revealedProduced * calibratedRejectRate) / 100);
    rework = 0;
  }

  const metrics = computeMachineOee({
    windows: revealedWindows.map((w, i) => ({
      index: i,
      timestamp: "",
      actualCount: w.output,
      targetCount: w.targetOutput,
      status:
        w.type === "planned"
          ? "PD"
          : w.type === "downtime"
            ? "D"
            : w.type === "minor_stop"
              ? "MS"
              : w.type === "speed_loss"
                ? "SL"
                : "EF",
      ...(w.type === "speed_loss" && w.targetOutput > 0
        ? {
            positiveSpeedLossSec: Math.max(
              0,
              ((w.targetOutput - w.output) * WINDOW_SEC) / w.targetOutput,
            ),
          }
        : {}),
    })),
    rejectCount: reject,
    reworkCount: rework,
  });

  const availability = metrics.availabilityPct;
  const performance = metrics.performancePct;
  const quality = metrics.qualityPct;
  const oee = metrics.oeePct;

  const stopEvents = activeEvents.filter((e) => e.type === "downtime" || e.type === "minor_stop");
  const stopsThisShift = stopEvents.length;
  const totalStopSec = downSec + minorSec;

  const mttrMin = stopsThisShift > 0 ? Math.round(totalStopSec / stopsThisShift / 60) : null;
  const mtbfMin =
    stopsThisShift > 0
      ? Math.round((metrics.scheduledTimeMin * 60 - totalStopSec) / stopsThisShift / 60)
      : null;

  const notTaggedEvents = activeEvents.filter((e) => e.type !== "run" && !e.isTagged);
  const notTaggedCount = notTaggedEvents.length;
  const unclassifiedCount = notTaggedCount;
  const unclassifiedSec = notTaggedEvents.reduce((sum, e) => sum + e.durationSec, 0);

  // Active stop banner state
  const ongoingEvent = activeEvents.find((e) => e.isOngoing);
  let activeStop: ShiftSnapshot["activeStop"] = undefined;

  if (ongoingEvent) {
    const isClassified = Boolean(
      ongoingEvent.isTagged &&
      ongoingEvent.l2CategoryName &&
      ongoingEvent.l2CategoryName !== NOT_TAGGED_LABEL,
    );

    const lossBreadcrumb =
      isClassified && ongoingEvent.l2CategoryName
        ? `${ongoingEvent.l1Parent} › ${ongoingEvent.l2CategoryName} › ${ongoingEvent.l3ReasonName}`
        : undefined;

    activeStop = {
      event: ongoingEvent,
      severity: ongoingEvent.durationSec > DOWNTIME_THRESHOLD_SEC ? "CRITICAL" : "WARNING",
      fault: ongoingEvent.plcAlarm || "Stop Occurring",
      startedAtTime: formatTimeWib(ongoingEvent.startSec),
      elapsedSec: ongoingEvent.durationSec,
      downstreamMachines: ["LBC01", "LCF01", "LSW01"],
      isClassified,
      ...(lossBreadcrumb !== undefined ? { lossBreadcrumb } : {}),
      source: (ongoingEvent.source as "PLC" | "Non-PLC") || "Non-PLC",
      l2Category: ongoingEvent.l2CategoryName || NOT_TAGGED_LABEL,
      l3Reason: ongoingEvent.l3ReasonName || NOT_TAGGED_LABEL,
      ...(ongoingEvent.isTagged !== undefined ? { isTagged: ongoingEvent.isTagged } : {}),
    };
  }

  // Machine status
  let statusState: ShiftSnapshot["status"]["state"] = "running";
  let statusTone: ShiftSnapshot["status"]["tone"] = "good";
  let statusLabel = "RUNNING";
  let statusDetail = "Production Nominal";
  let sinceSec = Math.max(0, revealSec - 3600);

  if (ongoingEvent) {
    if (ongoingEvent.type === "downtime") {
      statusState = "down";
      statusTone = "bad";
      statusLabel = "DOWN";
      statusDetail = ongoingEvent.plcAlarm || "Downtime Breakdown";
      sinceSec = ongoingEvent.startSec;
    } else if (ongoingEvent.type === "minor_stop") {
      statusState = "down";
      statusTone = "bad";
      statusLabel = "STOPPED";
      statusDetail = ongoingEvent.plcAlarm || "Minor Stop";
      sinceSec = ongoingEvent.startSec;
    } else if (ongoingEvent.type === "speed_loss") {
      statusState = "slow";
      statusTone = "warn";
      statusLabel = "SLOW";
      statusDetail = `Speed derated (${ongoingEvent.speedPct || 78}%)`;
      sinceSec = ongoingEvent.startSec;
    }
  }

  const roundedProduced = Math.round(revealedProduced);
  const roundedGood = Math.max(0, roundedProduced - reject);

  const snapshot: ShiftSnapshot = {
    machineCode,
    shiftKey,
    shiftLabel: shift.label,
    idealRatePpm: profile.idealRatePpm,
    planUnits: profile.planUnits,
    oee: oee ?? null,
    availability: availability ?? null,
    performance: performance ?? null,
    quality: quality ?? null,
    totalOutput: roundedProduced,
    goodOutput: roundedGood,
    rejects: reject,
    rejectRatePct: profile.rejectRatePct,
    outputVsPlanPct: profile.planUnits > 0 ? (roundedProduced / profile.planUnits) * 100 : 0,
    totalLossSec: Math.round(downSec + minorSec + speedLossSec),
    totalLossMin: Math.round((downSec + minorSec + speedLossSec) / 60),
    stopsThisShift,
    mttrMin,
    mtbfMin,
    unclassifiedCount,
    notTaggedCount,
    unclassifiedSec,
    status: {
      state: statusState,
      tone: statusTone,
      label: statusLabel,
      detail: statusDetail,
      sinceSec,
    },
    ...(activeStop !== undefined ? { activeStop } : {}),
  };

  return {
    shift,
    machineCode,
    idealRatePpm: profile.idealRatePpm,
    orders,
    events: activeEvents,
    windows,
    snapshot,
  };
}
