import { useEffect, useRef, useState } from "react";
import { AlertCircle, BarChart3, Box, Clock, FileText, ShieldCheck } from "lucide-react";
import { IdwBlock } from "./IdwBlock";
import { BigOutput, FroCard, MONTHS, MulaiRow, PoHeaderBox, QaCounters, RunRateRow, num } from "./froUi";
import { LegacyShiftReminderModal } from "./LegacyShiftReminderModal";
import { OeeCard } from "./OeeCard";
import { useTargetSnapshot } from "./useTargetSnapshot";
import { SHIFT_REMINDER_LEAD_MIN } from "@/lib/oee/config";
import { ceilRate, computeLegacyRunRates, averagePerMinute } from "@/lib/oee/legacyRunRate";
import { getNowMs, getShiftInfo, formatTimeWib } from "@/lib/oee/shiftClock";
import { useLineOperationalMode } from "@/lib/oee/assetMaster";
import { getPoForLine } from "@/lib/oee/poMaster";
import { viewShiftStore, useViewShift } from "@/lib/oee/viewShiftStore";
import { useSimWindowBucket } from "@/lib/oee/useSimTick";

/**
 * Old FRO Main Dashboard (pre-CR layout) reproduced from the saved production page: Inline Device
 * Weigher, Process Order Performance, Shift Performance. All numbers come from the same stores, clock
 * and windows as the new view (Output OEE, Output IDW, MPQ and reject are identical for a given moment).
 */
export function LegacyDashboardContent({
  plantId,
  lineId,
  outputOee,
  totalReject,
  qaStats,
}: {
  plantId: string;
  lineId: string;
  outputOee: number;
  totalReject: number;
  qaStats: { sample: number; released: number; reject: number };
}) {
  const opMode = useLineOperationalMode(plantId, lineId);
  const isActiveLine = opMode.mode === "full";
  const poInfo = getPoForLine(lineId);
  const snap = useTargetSnapshot(plantId, lineId);
  const view = useViewShift();
  const cur = snap.result.current;
  const mpq = snap.result.po.mpq || poInfo.mpq;

  // operator select (same storage as the new view)
  const [operator, setOperator] = useState(() => {
    try {
      return localStorage.getItem(`fro_op_${lineId}`) || poInfo.activeOperator;
    } catch {
      return poInfo.activeOperator;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`fro_op_${lineId}`, operator);
    } catch {
      // ignore
    }
  }, [lineId, operator]);

  // ---- run rates (pure module). SRR may be null: shows "-".
  const skuStd = cur?.skuSrr ?? null;
  const lineStd = snap.srrLine;
  const poStart = cur ? cur.startSec : null;
  const base = { windows: snap.windows, nowSec: snap.nowSec, poStartSec: poStart, outputOee, mpq };
  const skuRates = computeLegacyRunRates({ ...base, lineStandard: skuStd });
  const lineRates = computeLegacyRunRates({ ...base, lineStandard: lineStd });
  const shiftActual = averagePerMinute(snap.windows, 0, snap.nowSec);
  const shiftProjected = snap.result.shift.projected;
  const shiftTarget = ceilRate(shiftProjected - outputOee, snap.result.shift.remainingScheduledMin);

  // Sisa: remaining planned minutes of the PO at the line standard (falls back to the SKU standard)
  const remMin = lineRates.remainingPlannedMin ?? skuRates.remainingPlannedMin;
  const remTotal = remMin === null ? null : Math.ceil(remMin);
  const sisaStr = remTotal === null ? "-" : `${Math.floor(remTotal / 1440) > 0 ? `${Math.floor(remTotal / 1440)}h ` : ""}${Math.floor((remTotal % 1440) / 60)}j ${remTotal % 60}m`;
  const startMs = cur ? (snap.shift.startSec + cur.startSec) * 1000 : poInfo.startTimeSec * 1000;
  const sd = new Date(startMs + 7 * 3600 * 1000);
  const startStr = `${sd.getUTCDate()} ${MONTHS[sd.getUTCMonth()]} ${sd.getUTCFullYear()}, ${String(sd.getUTCHours()).padStart(2, "0")}:${String(sd.getUTCMinutes()).padStart(2, "0")}`;
  const poPct = mpq > 0 ? (outputOee / mpq) * 100 : 0;
  const shiftPct = shiftProjected > 0 ? (outputOee / shiftProjected) * 100 : 0;

  // ---- legacy end-of-shift reminder: 10 minutes before the end, change shift
  useSimWindowBucket(5);
  const [reminderOpen, setReminderOpen] = useState(false);
  const shown = useRef<string>("");
  const realShift = getShiftInfo();
  const leftSec = realShift.endSec - Math.floor(getNowMs() / 1000);
  useEffect(() => {
    if (view.isPast || !isActiveLine) return;
    if (leftSec > 0 && leftSec <= SHIFT_REMINDER_LEAD_MIN * 60 && shown.current !== realShift.shiftKey) {
      shown.current = realShift.shiftKey;
      setReminderOpen(true);
    }
  }, [leftSec, realShift.shiftKey, view.isPast, isActiveLine]);

  if (!isActiveLine) {
    return (
      <div className="flex w-full flex-1 flex-col gap-2" data-testid="legacy-dashboard">
        <div className="flex items-center gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-bold" data-testid="idw-banner" data-reason={opMode.reason}>
            {opMode.reason === "srr-line-missing"
              ? "SRR Line belum ditentukan di master data Asset Management untuk line/mesin bottleneck ini"
              : `OEE is not active for this line yet (${lineId}). Only Inline Device Weigher monitoring is available.`}
          </p>
        </div>
        <div className="grid w-full flex-1 grid-cols-1 items-stretch md:max-w-xl">
          <IdwBlock plantId={plantId} lineId={lineId} outputOee={outputOee} totalMpq={poInfo.mpq} />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="legacy-dashboard" className="fro-grid">
      <IdwBlock plantId={plantId} lineId={lineId} outputOee={outputOee} totalMpq={mpq} />

      <FroCard testId="legacy-po" tone="po" icon={<FileText />} title="Process Order Performance">
        <PoHeaderBox
          sku={cur ? cur.skuName : poInfo.skuName}
          po={cur ? cur.poNumber : poInfo.poNumber}
          material={poInfo.materialNumber}
          sediaan={poInfo.sediaan}
          operator={operator}
          operators={poInfo.operators}
          lineId={lineId}
          onOperator={setOperator}
          icon={<Box />}
        />
        <div className="flex flex-col gap-4">
          <RunRateRow testId="legacy-rr-sku" title="Run rate SKU" target={skuRates.targetRemaining} actual={skuRates.actualPo} standard={skuStd} />
          <RunRateRow testId="legacy-rr-line" title="Run rate line" target={lineRates.targetRemaining} actual={lineRates.actualPo} standard={lineStd} />
        </div>
        <BigOutput
          title="Total output"
          value={outputOee}
          reject={totalReject}
          note={`${num(outputOee)} / ${num(mpq)} (${poPct.toFixed(1)}%) total MPQ`}
          scale={mpq}
          testId="legacy-po-total"
          valueTestId="legacy-po-output"
          rejectTestId="legacy-po-reject"
          barTestId="legacy-po-bar"
        />
        <QaCounters testId="legacy-qa" qaStats={qaStats} icon={<ShieldCheck className="size-3.5" />} />
        <div className="flex flex-col gap-4">
          <MulaiRow start={startStr} sisa={sisaStr} icon={<Clock />} testId="legacy-sisa" />
        </div>
      </FroCard>

      <FroCard testId="legacy-shift" tone="shift" icon={<BarChart3 />} title="Shift Performance" gap="gap-6">
        <BigOutput
          title="Actual output"
          value={outputOee}
          reject={totalReject}
          note={`${num(outputOee)} / ${num(shiftProjected)} (${shiftPct.toFixed(1)}%)`}
          scale={shiftProjected}
          testId="legacy-shift-total"
          valueTestId="legacy-shift-output"
          rejectTestId="legacy-shift-reject"
          barTestId="legacy-shift-bar"
        />
        <RunRateRow testId="legacy-rr-shift" title="Shift run rate line" target={shiftTarget} actual={shiftActual} standard={lineStd} />
        <div className="flex flex-1 flex-col">
          <OeeCard plantId={plantId} lineId={lineId} rejectCount={totalReject} ownToggle />
        </div>
      </FroCard>

      <LegacyShiftReminderModal
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        currentShiftLabel={`Shift ${realShift.code} (${formatTimeWib(realShift.startSec)} - ${formatTimeWib(realShift.endSec)})`}
        endTime={formatTimeWib(realShift.endSec)}
        onChangeShift={(id) => {
          const sec = Number(id.replace("shift-", ""));
          if (Number.isFinite(sec)) viewShiftStore.set(sec === realShift.startSec ? null : sec);
        }}
      />
    </div>
  );
}
