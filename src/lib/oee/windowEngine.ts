/**
 * OEE Calculation Engine (§2.3 CR, URS pages 24-32)
 */

export type WindowStatus = "NA" | "US" | "EF" | "SL" | "NSL" | "MS" | "D" | "PD" | "NS";

export type WindowData = {
  index: number;
  timestamp: string;
  actualCount: number;
  targetCount: number; // Standard output per 30 s window
  status: WindowStatus;
  positiveSpeedLossSec?: number;
  negativeSpeedLossSec?: number;
};

export type OeeMetrics = {
  calendarTimeMin: number;
  scheduledTimeMin: number;
  grossOperatingTimeMin: number;
  netOperatingTimeMin: number;
  slNetMin: number;
  availabilityPct: number;
  performancePct: number;
  qualityPct: number;
  oeePct: number;
};

export const SAMPLING_WINDOW_SEC = 30;
export const TOLERANCE_PCT = 120;
export const MINOR_STOP_MAX_WINDOWS = 20;

export type MachineOeeInput = {
  windows: WindowData[];
  totalUnits?: number;
  rejectCount: number;
  reworkCount: number;
};

export function classifyWindow(
  actual: number,
  stdPerWindow: number,
  tolerancePct: number = TOLERANCE_PCT,
): WindowStatus {
  if (actual === 0) return "D"; // Or "MS" depending on context, but EF usually requires >0
  if (actual < stdPerWindow) return "SL";
  if (actual > Math.ceil((stdPerWindow * tolerancePct) / 100)) return "NSL";
  return "EF";
}

import { computeOeeFromTotals, type MachineTotals } from "./oeeTotals";

export function computeMachineOee({
  windows,
  totalUnits,
  rejectCount,
  reworkCount,
}: MachineOeeInput): OeeMetrics {
  let naSec = 0;
  let usSec = 0;
  let pdSec = 0;
  let dSec = 0;
  let msSec = 0;
  let positiveSlSec = 0;
  let negativeSlSec = 0;
  let totalUnitsActual = 0;
  let runningSec = 0;
  let stops = 0;
  let inStop = false;

  for (const w of windows) {
    if (w.status === "NA") {
      naSec += SAMPLING_WINDOW_SEC;
      inStop = false;
    } else if (w.status === "US") {
      usSec += SAMPLING_WINDOW_SEC;
      inStop = false;
    } else if (w.status === "PD") {
      pdSec += SAMPLING_WINDOW_SEC;
      inStop = false;
    } else if (w.status === "D") {
      dSec += SAMPLING_WINDOW_SEC;
      if (!inStop) {
        stops++;
        inStop = true;
      }
    } else if (w.status === "MS") {
      msSec += SAMPLING_WINDOW_SEC;
      if (!inStop) {
        stops++;
        inStop = true;
      }
    } else {
      inStop = false;
      runningSec += SAMPLING_WINDOW_SEC;
      if (w.status === "EF") {
        totalUnitsActual += w.actualCount;
      } else if (w.status === "SL") {
        const sl =
          w.positiveSpeedLossSec ??
          ((w.targetCount - w.actualCount) * SAMPLING_WINDOW_SEC) / w.targetCount;
        positiveSlSec += sl;
        totalUnitsActual += w.actualCount;
      } else if (w.status === "NSL") {
        const nsl =
          w.negativeSpeedLossSec ??
          ((w.actualCount - w.targetCount) * SAMPLING_WINDOW_SEC) / w.targetCount;
        negativeSlSec += nsl;
        totalUnitsActual += w.actualCount;
      }
    }
  }

  const totals: MachineTotals = {
    calendarMin: (windows.length * SAMPLING_WINDOW_SEC) / 60,
    naMin: naSec / 60,
    usMin: usSec / 60,
    pdMin: pdSec / 60,
    dMin: dSec / 60,
    msMin: msSec / 60,
    slPosMin: positiveSlSec / 60,
    slNegMin: negativeSlSec / 60,
    units: totalUnits !== undefined ? totalUnits : totalUnitsActual,
    reject: rejectCount,
    rework: reworkCount,
    runningMin: runningSec / 60,
    stops,
  };

  return computeOeeFromTotals(totals);
}
