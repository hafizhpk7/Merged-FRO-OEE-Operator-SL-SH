/**
 * Legacy (old FRO) dashboard run rates, pure functions (no clock, no store).
 *
 *  - actual run rate (PO)    = ROUNDUP(average FG output per minute since PO start), refreshed every minute
 *  - actual run rate (shift) = same, since shift start
 *  - target run rate         = ROUNDUP(max(MPQ - Output OEE, 0) / remaining planned minutes),
 *                              planned minutes = MPQ / line standard
 * A rate that cannot be computed (no full minute yet, no standard, no MPQ) is `null`, shown as "-".
 */

export type RrWindow = { startSec: number; output: number };

const WINDOW_SEC = 30;

/** ROUNDUP of a per-minute average over [fromSec, nowSec], using whole minutes only (refresh every minute). */
export function averagePerMinute(windows: readonly RrWindow[], fromSec: number, nowSec: number): number | null {
  const wholeMin = Math.floor((nowSec - fromSec) / 60);
  if (!(wholeMin >= 1)) return null;
  const endSec = fromSec + wholeMin * 60;
  let sum = 0;
  for (const w of windows) {
    if (w.startSec >= fromSec && w.startSec + WINDOW_SEC <= endSec) sum += w.output;
  }
  return Math.ceil(Math.round((sum / wholeMin) * 1e6) / 1e6);
}

export type LegacyRunRates = {
  actualPo: number | null;
  actualShift: number | null;
  /** Target run rate to still reach the MPQ in the planned time left; null when not computable. */
  targetRemaining: number | null;
  plannedMin: number | null;
  remainingPlannedMin: number | null;
};

export function computeLegacyRunRates(input: {
  windows: readonly RrWindow[];
  /** Seconds from shift start (same frame as the windows). */
  nowSec: number;
  poStartSec: number | null;
  shiftStartSec?: number;
  outputOee: number;
  mpq: number | null;
  lineStandard: number | null;
}): LegacyRunRates {
  const { windows, nowSec, poStartSec, outputOee, mpq, lineStandard } = input;
  const actualPo = poStartSec === null ? null : averagePerMinute(windows, Math.max(0, poStartSec), nowSec);
  const actualShift = averagePerMinute(windows, input.shiftStartSec ?? 0, nowSec);

  let plannedMin: number | null = null;
  let remainingPlannedMin: number | null = null;
  let targetRemaining: number | null = null;
  if (mpq && mpq > 0 && lineStandard && lineStandard > 0) {
    plannedMin = mpq / lineStandard;
    const elapsedMin = poStartSec === null ? 0 : Math.max(0, (nowSec - Math.max(0, poStartSec)) / 60);
    remainingPlannedMin = Math.max(plannedMin - elapsedMin, 0);
    if (remainingPlannedMin > 0) {
      targetRemaining = Math.ceil(Math.max(mpq - outputOee, 0) / remainingPlannedMin - 1e-9);
    }
  }
  return { actualPo, actualShift, targetRemaining, plannedMin, remainingPlannedMin };
}

/** ROUNDUP(pcs still to make / planned minutes left); null when there is no time left or no minutes. */
export function ceilRate(remainingPcs: number, remainingMin: number | null): number | null {
  if (remainingMin === null || !(remainingMin > 0)) return null;
  return Math.ceil(Math.max(remainingPcs, 0) / remainingMin - 1e-9);
}

/** "-" for null, otherwise the integer. */
export const fmtRate = (v: number | null): string => (v === null ? "-" : String(v));

/** Where a run rate sits against its standard (old UI bar, scale 0-200 %): red below 100 %, green 100-150 %, yellow above. */
export function rateZone(actual: number | null, standard: number | null): "red" | "green" | "yellow" | "none" {
  if (actual === null || standard === null || standard <= 0) return "none";
  const r = actual / standard;
  return r < 1 ? "red" : r < 1.5 ? "green" : "yellow";
}

// ---- self test -------------------------------------------------------------------------------------------
type Check = { name: string; ok: boolean; detail?: string };

export function runLegacyRunRateSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const t = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, ...(detail ? { detail } : {}) });
  // 10 minutes of 20 windows of 30 pcs each = 60 pcs/min
  const win = (n: number, out: number, from = 0): RrWindow[] => Array.from({ length: n }, (_, i) => ({ startSec: from + i * 30, output: out }));
  const w = win(20, 30);

  t("average 60/min", averagePerMinute(w, 0, 600) === 60);
  t("ROUNDUP 60.2 -> 61", averagePerMinute(win(2, 30.1), 0, 60) === 61);
  t("less than a minute -> null", averagePerMinute(w, 0, 59) === null);
  t("only whole minutes count (90 s = 1 min)", averagePerMinute(w, 0, 90) === 60);
  t("since PO start only", averagePerMinute([...win(10, 10), ...win(10, 40, 300)], 300, 600) === 80);
  t("no PO -> actualPo null", computeLegacyRunRates({ windows: w, nowSec: 600, poStartSec: null, outputOee: 600, mpq: 1000, lineStandard: 60 }).actualPo === null);

  const r = computeLegacyRunRates({ windows: w, nowSec: 600, poStartSec: 0, outputOee: 600, mpq: 1200, lineStandard: 60 });
  // planned 20 min, 10 elapsed, 10 left, 600 pcs left -> 60/min
  t("planned minutes = MPQ / standard", r.plannedMin === 20);
  t("remaining planned minutes", r.remainingPlannedMin === 10);
  t("target remaining 60", r.targetRemaining === 60, String(r.targetRemaining));
  t("target remaining ROUNDUP", computeLegacyRunRates({ windows: w, nowSec: 600, poStartSec: 0, outputOee: 601, mpq: 1200, lineStandard: 60 }).targetRemaining === 60);
  t("target 0 when MPQ reached", computeLegacyRunRates({ windows: w, nowSec: 600, poStartSec: 0, outputOee: 1300, mpq: 1200, lineStandard: 60 }).targetRemaining === 0);
  t("no standard -> null (no crash)", computeLegacyRunRates({ windows: w, nowSec: 600, poStartSec: 0, outputOee: 0, mpq: 1200, lineStandard: null }).targetRemaining === null);
  t("planned time over -> null", computeLegacyRunRates({ windows: w, nowSec: 3000, poStartSec: 0, outputOee: 0, mpq: 1200, lineStandard: 60 }).targetRemaining === null);
  t("fmtRate null -> '-'", fmtRate(null) === "-" && fmtRate(7) === "7");
  t("zones", rateZone(50, 60) === "red" && rateZone(60, 60) === "green" && rateZone(95, 60) === "yellow" && rateZone(70, 60) === "green" && rateZone(null, 60) === "none");
  return { passed: results.every((x) => x.ok), results };
}

declare global {
  interface Window {
    runLegacyRunRateSelfTest?: typeof runLegacyRunRateSelfTest;
  }
}
if (typeof window !== "undefined") window.runLegacyRunRateSelfTest = runLegacyRunRateSelfTest;
