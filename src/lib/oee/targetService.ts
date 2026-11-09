/**
 * CR 5: TOTAL TARGET / ACTUAL OUTPUT of a line from the same 30 s windows the OEE engine uses.
 *
 * Reference machine = the line's bottleneck. Its window output is turned into line output in pcs by
 * its efficiency (output / what the machine would do at its rated speed) times the running SKU's
 * SRR, so the actual follows the running SKU and never depends on the SRR switch (SR-03).
 * Planned Downtime windows of the engine are excluded from scheduled time; D, MS, SL stay in.
 */
import { getShiftTimeline, getMachineProfile } from "./machineEvents";
import { getBottleneck, getSkuStandardRunRate } from "./metrics-engine";
import { getShiftPoPlan, type ShiftPoPlan } from "./poMaster";
import { getNowMs, getShiftInfo, SHIFT_SECONDS, type ShiftInfo } from "./shiftClock";
import {
  computeHourly,
  computeTargets,
  TARGET_WINDOW_SEC,
  type HourRow,
  type SrrMode,
  type TargetResult,
  type TargetWindow,
} from "./targetEngine";
import { workOrderStore } from "./workOrderStore";

export type TargetSnapshot = {
  mode: SrrMode;
  shift: ShiftInfo;
  plan: ShiftPoPlan;
  machine: string;
  srrLine: number | null;
  result: TargetResult;
  /** The 30 s windows the result was computed from (shared by the hourly page). */
  windows: TargetWindow[];
  /** Total output of the shift so far in pcs (sum of all windows), independent of the SRR switch. */
  grossOutput: number;
  /** Seconds from shift start the values are computed for (frozen at Finish Work Order). */
  nowSec: number;
  frozen: boolean;
};

const cache = new Map<string, TargetSnapshot>();

export function getTargetSnapshot(
  plantId: string,
  lineId: string,
  mode: SrrMode,
  nowMs: number = getNowMs(),
): TargetSnapshot {
  const shift = getShiftInfo(new Date(nowMs));
  const wo = workOrderStore.get(lineId, shift.shiftKey);
  const finishedMs = wo.status === "finished" && wo.finishedAtSec ? wo.finishedAtSec * 1000 : null;
  const effectiveMs = finishedMs !== null ? Math.min(nowMs, finishedMs) : nowMs;
  const bucket = Math.floor(effectiveMs / (TARGET_WINDOW_SEC * 1000)); // refresh every 30 s window (TG-07)
  const cacheKey = `${plantId}:${lineId}:${mode}:${shift.shiftKey}:${bucket}:${shift.startSec}:${finishedMs !== null}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const plan = getShiftPoPlan(lineId, shift);
  const machine = getBottleneck(plantId, lineId);
  const ideal = Math.max(1, getMachineProfile(machine).idealRatePpm);
  const srrLine = plan.srrLine ?? getSkuStandardRunRate(plantId, lineId);

  const elapsed = Math.min(SHIFT_SECONDS, Math.max(0, Math.floor(effectiveMs / 1000) - shift.startSec));
  const revealedSec = Math.floor(elapsed / TARGET_WINDOW_SEC) * TARGET_WINDOW_SEC;
  const timeline = getShiftTimeline(machine, shift, revealedSec, plantId, "this-shift", lineId);

  const windows: TargetWindow[] = timeline.windows
    .slice(0, revealedSec / TARGET_WINDOW_SEC)
    .map((w) => {
      const mid = w.startSec + TARGET_WINDOW_SEC / 2;
      const seg = plan.segments.find((s) => mid >= s.startSec && mid < s.stopSec);
      // the running SKU's own rate scales the machine efficiency into line output; outside a PO there is none
      const skuRate = seg ? (seg.srr ?? plan.srrLine ?? ideal) : 0;
      return {
        startSec: w.startSec,
        output: (w.output / (ideal * (TARGET_WINDOW_SEC / 60))) * skuRate * (TARGET_WINDOW_SEC / 60),
        pd: w.type === "planned",
      };
    });

  const result = computeTargets({ plan, windows, mode, srrLine, nowSec: revealedSec });
  const snap: TargetSnapshot = {
    mode,
    shift,
    plan,
    machine,
    srrLine,
    result,
    windows,
    grossOutput: result.shift.actual,
    nowSec: revealedSec,
    frozen: finishedMs !== null,
  };
  cache.set(cacheKey, snap);
  if (cache.size > 12) cache.delete(cache.keys().next().value as string);
  return snap;
}

/** Hourly realisation rows (CR 5 part B) from the same snapshot and the same engine functions. */
export function getHourlyRows(snap: TargetSnapshot): HourRow[] {
  return computeHourly({
    plan: snap.plan,
    windows: snap.windows,
    mode: snap.mode,
    srrLine: snap.srrLine,
    nowSec: snap.nowSec,
    startMinute: (snap.shift.startMinuteOfDay ?? 0) % 60,
  });
}
