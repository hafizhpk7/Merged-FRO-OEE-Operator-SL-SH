/**
 * CR 5: TOTAL TARGET OUTPUT, GAP OUTPUT and GAP WAKTU.
 * Pure functions over 30 s windows so the document examples can be tested exactly.
 *
 * - A shift is split into PO/SKU segments by PO start/stop (to the second); a window belongs to the
 *   segment that contains its midpoint (OI-5.5 default).
 * - Scheduled minutes = windows inside a segment that are not Planned Downtime (engine status or a
 *   break of the plan). Time between two POs (changeover) belongs to no segment = Unscheduled.
 *   Downtime, Minor Stop, Speed Loss and Pause stay in scheduled time.
 * - Segment TARGET = SRR x scheduled minutes. PO TARGET = min(MPQ, S + SRR x scheduled minutes).
 * - GAP OUTPUT = actual - target (integer pcs). GAP WAKTU = sum over segments of gap / segment SRR.
 */
import type { PoSegment, ShiftPoPlan } from "./poMaster";

export type SrrMode = "LINE" | "SKU";

export const TARGET_WINDOW_SEC = 30;

/** One 30 s window: seconds from the shift start, output in pcs, and whether the engine marked it PD. */
export type TargetWindow = { startSec: number; output: number; pd: boolean };

export type SegmentResult = {
  key: string;
  skuLabel: string;
  poNumber: string;
  skuName: string;
  mpq: number;
  startSec: number;
  stopSec: number;
  /** SRR of the chosen standard for this segment (pcs/min); null = no standard (TG-09). */
  srr: number | null;
  skuSrr: number | null;
  started: boolean;
  running: boolean;
  scheduledMin: number;
  target: number;
  actual: number;
  gap: number;
  gapMin: number | null;
  noStandard: boolean;
  carryActual: number;
};

export type TargetResult = {
  mode: SrrMode;
  segments: SegmentResult[];
  /** Segment the shift is in (or last started); null before the first PO starts. */
  current: SegmentResult | null;
  po: {
    target: number;
    actual: number;
    gap: number;
    gapMin: number | null;
    mpq: number;
    /** S: starting point of the PO (0 for a new PO). */
    startPoint: number;
    scheduledMin: number;
    noStandard: boolean;
  };
  shift: {
    target: number;
    actual: number;
    gap: number;
    gapMin: number | null;
    scheduledMin: number;
    /** Bar denominator: target so far + running SRR x remaining scheduled minutes (SR-09). */
    projected: number;
    remainingScheduledMin: number;
    runningSrr: number | null;
    noStandard: boolean;
    /** Output produced outside any PO segment (counts in the shift total, not in a segment). */
    unscheduledActual: number;
  };
};

const validSrr = (v: number | null | undefined): v is number => typeof v === "number" && v > 0;

/** Standard (pcs/min) of a segment for the switch position; null = no standard (TG-09). */
export function standardOf(seg: PoSegment, mode: SrrMode, srrLine: number | null): number | null {
  const v = mode === "LINE" ? srrLine : seg.srr;
  return validSrr(v) ? v : null;
}
const mid = (startSec: number) => startSec + TARGET_WINDOW_SEC / 2;

function segmentIndex(plan: ShiftPoPlan, wMid: number): number {
  return plan.segments.findIndex((s) => wMid >= s.startSec && wMid < s.stopSec);
}
const inBreak = (plan: ShiftPoPlan, wMid: number) =>
  plan.plannedBreaks.some((b) => wMid >= b.startSec && wMid < b.endSec);

export function computeTargets(input: {
  plan: ShiftPoPlan;
  windows: TargetWindow[];
  mode: SrrMode;
  srrLine: number | null;
  /** Seconds from shift start up to which windows are revealed (the "now" of the calculation). */
  nowSec: number;
  shiftSeconds?: number;
}): TargetResult {
  const { plan, windows, mode, srrLine, nowSec } = input;
  const shiftSeconds = input.shiftSeconds ?? 28800;

  const stdOf = (seg: PoSegment): number | null => standardOf(seg, mode, srrLine);

  const sched = plan.segments.map(() => ({ windows: 0, output: 0 }));
  let unscheduledActual = 0;
  for (const w of windows) {
    const m = mid(w.startSec);
    const i = segmentIndex(plan, m);
    if (i < 0) {
      unscheduledActual += w.output;
      continue;
    }
    const slot = sched[i];
    if (!slot) continue;
    slot.output += w.output;
    if (!w.pd && !inBreak(plan, m)) slot.windows += 1;
  }

  const segments: SegmentResult[] = plan.segments.map((seg, i) => {
    const std = stdOf(seg);
    const slot = sched[i] ?? { windows: 0, output: 0 };
    const scheduledMin = slot.windows * (TARGET_WINDOW_SEC / 60);
    const target = std ? Math.round(std * scheduledMin) : 0;
    const actual = Math.round(slot.output);
    const gap = actual - target;
    const started = seg.startSec < nowSec;
    return {
      key: seg.key,
      skuLabel: seg.skuLabel,
      poNumber: seg.poNumber,
      skuName: seg.skuName,
      mpq: seg.mpq,
      startSec: seg.startSec,
      stopSec: seg.stopSec,
      srr: std,
      skuSrr: validSrr(seg.srr) ? seg.srr : null,
      started,
      running: started && nowSec < seg.stopSec,
      scheduledMin,
      target,
      actual,
      gap,
      gapMin: std ? gap / std : null,
      noStandard: !std,
      carryActual: seg.carryActual,
    };
  });

  // segment the PO card shows: the last one that has started
  const startedSegs = segments.filter((s) => s.started);
  const current = startedSegs[startedSegs.length - 1] ?? null;
  const firstSeg = plan.segments[0];

  // ---- Process Order (one PO = one SKU): min(MPQ, S + SRR x scheduled minutes) ------------------
  const poSeg = current ?? null;
  const S = poSeg ? poSeg.carryActual : (firstSeg?.carryActual ?? 0);
  const poStd = poSeg ? poSeg.srr : firstSeg ? stdOf(firstSeg) : null;
  const poMpq = poSeg ? poSeg.mpq : (firstSeg?.mpq ?? 0);
  const poSched = poSeg ? poSeg.scheduledMin : 0;
  const poTarget = poStd ? Math.min(poMpq, Math.round(S + poStd * poSched)) : 0;
  const poActual = S + (poSeg ? poSeg.actual : 0);
  const poGap = poStd ? poActual - poTarget : 0;
  const po = {
    target: poTarget,
    actual: poActual,
    gap: poGap,
    gapMin: poStd ? poGap / poStd : null,
    mpq: poMpq,
    startPoint: S,
    scheduledMin: poSched,
    noStandard: !poStd,
  };

  // ---- Shift: sum over segments (S = 0 at shift start) ----------------------------------------------
  const startedForSums = segments.filter((s) => s.started || s.actual > 0 || s.scheduledMin > 0);
  const shiftNoStandard = startedForSums.length
    ? startedForSums.some((s) => s.noStandard)
    : !(firstSeg && stdOf(firstSeg));
  const target = segments.reduce((a, s) => a + s.target, 0);
  const actual = segments.reduce((a, s) => a + s.actual, 0) + Math.round(unscheduledActual);
  const gap = shiftNoStandard ? 0 : actual - target;
  const gapMinParts = segments.filter((s) => s.gapMin !== null);
  const gapMin = shiftNoStandard ? null : gapMinParts.reduce((a, s) => a + (s.gapMin ?? 0), 0);
  const scheduledMin = segments.reduce((a, s) => a + s.scheduledMin, 0);

  // Remaining scheduled minutes of the shift: future windows inside a PO segment and not in a break
  let remainingWindows = 0;
  for (let t = windows.length * TARGET_WINDOW_SEC; t < shiftSeconds; t += TARGET_WINDOW_SEC) {
    const m = mid(t);
    if (segmentIndex(plan, m) >= 0 && !inBreak(plan, m)) remainingWindows += 1;
  }
  const remainingScheduledMin = remainingWindows * (TARGET_WINDOW_SEC / 60);
  // running SRR: the segment in progress (last started); before the first PO, the first one
  const runSeg = current ?? (firstSeg ? segments[0] : null) ?? null;
  const runningSrr = mode === "LINE" ? (validSrr(srrLine) ? srrLine : null) : (runSeg?.srr ?? null);
  const projected = runningSrr ? Math.round(target + runningSrr * remainingScheduledMin) : target;

  return {
    mode,
    segments,
    current,
    po,
    shift: {
      target: shiftNoStandard ? 0 : target,
      actual,
      gap,
      gapMin,
      scheduledMin,
      projected: shiftNoStandard ? 0 : projected,
      remainingScheduledMin,
      runningSrr,
      noStandard: shiftNoStandard,
      unscheduledActual: Math.round(unscheduledActual),
    },
  };
}

// ---- formatting shared by the cards and the tests ---------------------------------------------------

/** GAP OUTPUT text: signed integer pcs; zero reads "Sesuai target" (TG-05). */
export function formatGapPcs(gap: number): string {
  if (gap === 0) return "Sesuai target";
  return `${gap > 0 ? "+" : "-"}${Math.abs(gap).toLocaleString("en-US")}`;
}

/** GAP WAKTU text: signed minutes, one decimal at most (TG-06). */
export function formatGapMin(min: number): string {
  const r = Math.round(min * 10) / 10;
  if (r === 0) return "0";
  const a = Math.abs(r);
  return `${r > 0 ? "+" : "-"}${a % 1 === 0 ? String(a) : a.toFixed(1)}`;
}

// ---- Hourly realisation (CR 5 part B, RH-01..RH-08) ---------------------------------------------------

export type HourRow = {
  startSec: number; // from shift start
  endSec: number;
  /** First or last hour of a :30 shift: target is proportional to the minutes it covers (RH-01). */
  partial: boolean;
  status: "done" | "cur" | "fut";
  /** Segments that have scheduled minutes in this hour, in time order (SKU 1 > SKU 2, RH-03). */
  segments: { key: string; skuLabel: string; srr: number | null }[];
  scheduledMin: number;
  /** TOTAL TARGET OUTPUT of the hour: sum of SRR x scheduled minutes per segment (RH-02). */
  target: number;
  /** TOTAL ACTUAL OUTPUT so far in the hour; null for future hours. */
  actual: number | null;
  /** Gap per hour; null until the hour has ended (RH-06). */
  gap: number | null;
  gapMin: number | null;
  /** Cumulative gap = shift GAP OUTPUT at the end of this hour (RH-05); null until the hour has ended. */
  cumGap: number | null;
  cumGapMin: number | null;
  noStandard: boolean;
};

/**
 * One row per calendar hour of the shift. Uses the same window -> segment mapping, scheduled-time
 * rule and standards as computeTargets: the cumulative gap of an hour IS the shift GAP OUTPUT
 * computed at that hour's end, and the per-hour gap is the difference of two cumulative gaps.
 */
export function computeHourly(input: {
  plan: ShiftPoPlan;
  windows: TargetWindow[];
  mode: SrrMode;
  srrLine: number | null;
  nowSec: number;
  /** Minute of the hour the shift starts at (0 for 07:00, 30 for 06:30). */
  startMinute: number;
  shiftSeconds?: number;
}): HourRow[] {
  const { plan, windows, mode, srrLine, nowSec, startMinute } = input;
  const shiftSeconds = input.shiftSeconds ?? 28800;
  const revealedEnd = windows.length * TARGET_WINDOW_SEC;

  // calendar hour boundaries in seconds from shift start
  const bounds: number[] = [0];
  let b = ((60 - (startMinute % 60)) % 60) * 60;
  if (b === 0) b = 3600;
  while (b < shiftSeconds) {
    bounds.push(b);
    b += 3600;
  }
  bounds.push(shiftSeconds);

  const rows: HourRow[] = [];
  let prevCum = 0;
  let cumMin = 0;
  for (let k = 0; k + 1 < bounds.length; k++) {
    const startSec = bounds[k] as number;
    const endSec = bounds[k + 1] as number;
    const status: HourRow["status"] = endSec <= nowSec ? "done" : startSec < nowSec ? "cur" : "fut";

    // per-segment exact sums for this hour
    const per = plan.segments.map(() => ({ windows: 0, output: 0 }));
    let actualRaw = 0;
    for (let t = startSec; t < endSec; t += TARGET_WINDOW_SEC) {
      const m = mid(t);
      const i = segmentIndex(plan, m);
      const real = t < revealedEnd ? windows[t / TARGET_WINDOW_SEC] : undefined;
      if (real) actualRaw += real.output;
      if (i < 0) continue;
      const slot = per[i];
      if (!slot) continue;
      if (real) slot.output += real.output;
      // unrevealed windows (rest of the running hour, future hours) follow the plan: scheduled unless a break
      const pd = real ? real.pd : false;
      if (!pd && !inBreak(plan, m)) slot.windows += 1;
    }

    let target = 0;
    let scheduledMin = 0;
    let noStandard = false;
    let gapMinHour = 0;
    const segs: HourRow["segments"] = [];
    plan.segments.forEach((seg, i) => {
      const slot = per[i];
      if (!slot || slot.windows === 0) return;
      const std = standardOf(seg, mode, srrLine);
      const min = slot.windows * (TARGET_WINDOW_SEC / 60);
      scheduledMin += min;
      segs.push({ key: seg.key, skuLabel: seg.skuLabel, srr: std });
      if (!std) {
        noStandard = true;
        return;
      }
      const segTarget = std * min;
      target += segTarget;
      gapMinHour += (slot.output - segTarget) / std;
    });

    let gap: number | null = null;
    let gapMin: number | null = null;
    let cumGap: number | null = null;
    let cumGapMin: number | null = null;
    if (status === "done" && !noStandard) {
      // cumulative gap = shift GAP OUTPUT at the end of this hour (same function as the Dashboard)
      const upTo = windows.slice(0, endSec / TARGET_WINDOW_SEC);
      cumGap = computeTargets({ plan, windows: upTo, mode, srrLine, nowSec: endSec, shiftSeconds }).shift.gap;
      gap = cumGap - prevCum;
      prevCum = cumGap;
      gapMin = gapMinHour;
      cumMin += gapMinHour;
      cumGapMin = cumMin;
    }

    rows.push({
      startSec,
      endSec,
      partial: endSec - startSec < 3600,
      status,
      segments: segs,
      scheduledMin,
      target: Math.round(target),
      actual: status === "fut" ? null : Math.round(actualRaw),
      gap,
      gapMin,
      cumGap,
      cumGapMin,
      noStandard,
    });
  }
  return rows;
}

/** "1 jam terakhir" (RH-09): the last FULL hour that has ended; null when there is none (RH-13). */
export function lastFullHour(rows: HourRow[]): HourRow | null {
  const done = rows.filter((r) => r.status === "done" && !r.partial);
  return done[done.length - 1] ?? null;
}
