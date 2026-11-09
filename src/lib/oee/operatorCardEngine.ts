/**
 * Real Window-based Operator OEE Card calculation (§2.3 CR & URS §2.4).
 * Single source of truth for Operator Dashboard OEE Card & Parity Audit.
 */

import { getLine } from "./data";
import { getShiftInfo, SHIFT_SECONDS } from "./shiftClock";
import { getShiftTimeline, getMachineProfile } from "./machineEvents";
import { getLineOperation, getLineSrr, getMachineStandard, getRepresentativeAsset } from "./assetMaster";
import {
  classifyWindow,
  computeMachineOee,
  type WindowData,
  type WindowStatus,
  type OeeMetrics,
} from "./windowEngine";
import { computeLineOee } from "./lineOee";
import { rejectStore } from "./rejectStore";
import { getLineLossFactor } from "./calibration";
import { getNowMs } from "./shiftClock";

export function computeOperatorCardMetrics(
  plantId: string,
  lineId: string,
  skuOn: boolean,
  nowMs: number = getNowMs(),
): { lineMetrics: OeeMetrics; machineMetrics: Record<string, OeeMetrics>; bottleneck: string } {
  const lineObj =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const machines = lineObj?.machines || [];
  const shiftInfo = getShiftInfo();
  const shiftStartMs = shiftInfo.startSec * 1000;
  const nowFloor30s = Math.floor(nowMs / 30000) * 30000;
  const elapsedSec = Math.min(
    SHIFT_SECONDS,
    Math.max(0, Math.floor((nowFloor30s - shiftStartMs) / 1000)),
  );
  const revealedSec = Math.floor(elapsedSec / 30) * 30;
  const numWindows = Math.floor(revealedSec / 30);
  const bottleneck = getRepresentativeAsset(plantId, lineId);
  const topology = getLineOperation(plantId, lineId);

  const machineMetrics: Record<string, OeeMetrics> = {};

  const inputs = machines.map((m) => {
    const mCode = m.code || m.id;
    const timeline = getShiftTimeline(mCode, shiftInfo, revealedSec, plantId, "this-shift");

    const stdPpm = skuOn
      ? (getLineSrr(plantId, lineId) ?? getMachineStandard(plantId, lineId, mCode) ?? 0)
      : (getMachineStandard(plantId, lineId, mCode) ?? 0);
    const targetCount = (stdPpm * 30) / 60;

    const windows: WindowData[] = timeline.windows.slice(0, numWindows).map((w, i) => {
      let status: WindowStatus = "EF";
      if (w.type === "planned") status = "PD";
      else if (w.type === "downtime") status = "D";
      else if (w.type === "minor_stop") status = "MS";
      else if (w.type === "speed_loss") status = "SL";
      else if (w.type === "run" && w.eventId && classifyWindow(w.output, w.targetOutput) === "NSL")
        status = "NSL";
      else status = "EF";

      let positiveSpeedLossSec: number | undefined;
      if (w.type === "speed_loss" && targetCount > 0) {
        positiveSpeedLossSec = Math.max(0, ((targetCount - w.output) * 30) / targetCount);
      }
      const wObj: WindowData = {
        index: i,
        timestamp: "",
        actualCount: w.output,
        targetCount,
        status,
      };
      if (positiveSpeedLossSec !== undefined) {
        wObj.positiveSpeedLossSec = positiveSpeedLossSec;
      }
      return wObj;
    });

    const storeTotals = rejectStore.getTotals(plantId, lineId, shiftInfo.shiftKey, mCode);
    const units = windows.reduce(
      (acc, w) =>
        w.status === "PD" || w.status === "D" || w.status === "MS" ? acc : acc + w.actualCount,
      0,
    );

    let reject = 0;
    let rework = 0;
    if (storeTotals.totalReject > 0 || storeTotals.totalRework > 0) {
      reject = storeTotals.totalReject;
      rework = storeTotals.totalRework;
    } else {
      const lossFactor = getLineLossFactor(plantId, lineId);
      const calibratedRejectRate = Math.min(3.2, Math.max(0.7, 1.7 * Math.sqrt(lossFactor)));
      reject = Math.round((units * calibratedRejectRate) / 100);
      rework = 0;
    }

    const mM = computeMachineOee({
      windows,
      rejectCount: reject,
      reworkCount: rework,
    });
    machineMetrics[mCode] = mM;

    return {
      machineCode: mCode,
      windows,
      rejectCount: reject,
      reworkCount: rework,
      stdPpm,
      isParallel: Boolean((m as { isParallel?: boolean }).isParallel),
    };
  });

  const lineMetrics = computeLineOee(inputs, topology, bottleneck);

  return {
    lineMetrics,
    machineMetrics,
    bottleneck,
  };
}
