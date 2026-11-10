import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, Clock, FileText, BarChart3, Package, Printer, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CounterDetailModal, type CountLogItem } from "./CounterDetailModal";
import { LegacyShiftReminderModal } from "./LegacyShiftReminderModal";
import { OeeCard } from "./OeeCard";
import { useTargetSnapshot } from "./useTargetSnapshot";
import { RUN_RATE_THRESHOLDS, SHIFT_REMINDER_LEAD_MIN } from "@/lib/oee/config";
import { ceilRate, computeLegacyRunRates, fmtRate, rateZone, averagePerMinute } from "@/lib/oee/legacyRunRate";
import { getNow, getNowMs, getShiftInfo, formatTimeWib } from "@/lib/oee/shiftClock";
import { useLineOperationalMode } from "@/lib/oee/assetMaster";
import { getPoForLine } from "@/lib/oee/poMaster";
import { viewShiftStore, useViewShift } from "@/lib/oee/viewShiftStore";
import { useSimWindowBucket } from "@/lib/oee/useSimTick";

/**
 * Old FRO Main Dashboard (pre-CR layout) reproduced from the saved production page: Inline Device
 * Weigher, Process Order Performance, Shift Performance. All numbers come from the same stores, clock
 * and windows as the new view (Output OEE, Output IDW, MPQ and reject are identical for a given moment).
 */

const num = (v: number) => v.toLocaleString("en-US");
const label = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Segmented run-rate bar: red below 98 % of the standard, green 98-102 %, yellow above; markers for actual and target. */
export function RunRateBar({ actual, standard, target, testId }: { actual: number | null; standard: number | null; target: number | null; testId: string }) {
  const hasStd = standard !== null && standard > 0;
  const max = hasStd ? Math.max(standard * 1.25, (actual ?? 0) * 1.05, (target ?? 0) * 1.05) : 1;
  const pos = (v: number | null) => (v === null || !hasStd ? null : Math.min(100, Math.max(0, (v / max) * 100)));
  const redEnd = hasStd ? ((standard * RUN_RATE_THRESHOLDS.redMax) / 100 / max) * 100 : 0;
  const greenEnd = hasStd ? ((standard * RUN_RATE_THRESHOLDS.yellowMin) / 100 / max) * 100 : 0;
  const a = pos(actual);
  const t = pos(target);
  return (
    <div className="relative h-2.5 w-full rounded-full bg-muted" data-testid={testId} data-zone={rateZone(actual, standard)}>
      {hasStd && (
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <div style={{ width: `${Math.min(100, redEnd)}%`, background: "var(--fro-rr-low)" }} />
          <div style={{ width: `${Math.max(0, Math.min(100, greenEnd) - redEnd)}%`, background: "var(--fro-rr-ok)" }} />
          <div className="flex-1" style={{ background: "var(--fro-rr-high)" }} />
        </div>
      )}
      {t !== null && <span data-testid={`${testId}-target`} className="absolute -top-0.5 h-3.5 w-0.5 -translate-x-1/2 rounded bg-foreground/60" style={{ left: `${t}%` }} />}
      {a !== null && <span data-testid={`${testId}-actual`} className="absolute -top-1 h-4.5 w-1 -translate-x-1/2 rounded bg-foreground ring-1 ring-card" style={{ left: `${a}%`, height: 18 }} />}
    </div>
  );
}

function RunRateRow({ title, target, actual, standard, testId }: { title: string; target: number | null; actual: number | null; standard: number | null; testId: string }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <p className={label}>{title}</p>
        <p className="text-[11px] text-muted-foreground">
          Target <span className="font-mono text-sm font-bold text-foreground" data-testid={`${testId}-target-value`}>{fmtRate(target)}</span>
        </p>
      </div>
      <RunRateBar actual={actual} standard={standard} target={target} testId={`${testId}-bar`} />
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] text-muted-foreground">Actual / Standard</p>
        <p className="font-mono">
          <span className="text-base font-bold" data-testid={`${testId}-actual-value`}>{fmtRate(actual)}</span>{" "}
          <span className="text-xs text-muted-foreground" data-testid={`${testId}-standard-value`}>/ {fmtRate(standard)}</span>
        </p>
      </div>
    </div>
  );
}

function ProgressBar({ value, scale, tone = "bg-primary", testId }: { value: number; scale: number; tone?: string; testId?: string }) {
  const pct = scale > 0 ? Math.min(100, (value / scale) * 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" {...(testId ? { "data-testid": testId } : {})}>
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded bg-primary/10 text-primary">{icon}</span>
      <p className="text-sm font-bold text-foreground">{children}</p>
    </div>
  );
}

/** FG Release button: asks for the QC name first ("Nama QC", "Jalankan" disabled until filled). */
function FgReleaseButton({ name }: { name: "A" | "B" }) {
  const [open, setOpen] = useState(false);
  const [qc, setQc] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs" data-testid={`fg-release-${name}`}>FG Release {name}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        <label className="block space-y-1">
          <span className={label}>Nama QC</span>
          <input
            value={qc}
            onChange={(e) => setQc(e.target.value)}
            placeholder="Masukkan nama QC..."
            data-testid={`fg-release-${name}-qc`}
            className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
          />
        </label>
        <Button
          size="sm"
          className="h-8 w-full text-xs"
          disabled={qc.trim() === ""}
          data-testid={`fg-release-${name}-run`}
          onClick={() => {
            toast.success(`AMR FG Release ${name} dijalankan oleh ${qc.trim()} (mock).`);
            setQc("");
            setOpen(false);
          }}
        >
          Jalankan
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function InlineDeviceWeigher({ plantId, lineId, outputOee, totalMpq }: { plantId: string; lineId: string; outputOee: number; totalMpq: number }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [opKarbox, setOpKarbox] = useState("ABCD");
  const [opInnerbox, setOpInnerbox] = useState("EFGH");
  const outputIdw = Math.floor(outputOee * 0.985); // same rule as the new view
  const gapPct = outputOee > 0 ? (((outputOee - outputIdw) / outputOee) * 100).toFixed(2) : "0.00";
  const innerMaster = 12;
  const cartonMaster = 220;
  const palletMaster = 13;
  const currentInner = outputIdw % innerMaster;
  const totalCartons = Math.floor(outputIdw / innerMaster);
  const currentCarton = totalCartons % cartonMaster;
  const currentPallet = Math.floor(totalCartons / cartonMaster);
  const [logs, setLogs] = useState<CountLogItem[]>([]);
  const print = (name: string) => {
    toast.success(`Printed (mock): ${name}`);
    setLogs((p) => [{ id: `log-${getNowMs()}`, type: "KARBOX", count: currentCarton, at: getNow().toLocaleTimeString() }, ...p]);
  };
  const isJ2 = plantId.toLowerCase() === "j2" || plantId.toLowerCase() === "jatake-2";
  const sel = "w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium";

  const counter = (name: string, cur: number, master: number) => (
    <div className="space-y-1.5" data-testid={`legacy-counter-${name.toLowerCase()}`}>
      <div className="flex justify-between text-[11px] font-medium">
        <p>{name}</p>
        <p className="font-mono font-bold">{cur} / {master}</p>
      </div>
      <ProgressBar value={cur} scale={master} />
    </div>
  );

  return (
    <Card className="h-full min-w-0 border border-border bg-card shadow-sm" data-testid="legacy-idw">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
        <CardTitle icon={<Package className="size-4" />}>Inline Device Weigher</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 text-xs">
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <p className={label}>Counter</p>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setDetailOpen(true)}>Counter Detail</Button>
          </div>
          {counter("Innerbox", currentInner, innerMaster)}
          {counter("Karbox", currentCarton, cartonMaster)}
          {counter("Pallet", currentPallet, palletMaster)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={label}>OP Karbox</span>
            <select value={opKarbox} onChange={(e) => setOpKarbox(e.target.value)} className={sel}>
              <option value="ABCD">ABCD</option>
              <option value="WXYZ">WXYZ</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className={label}>OP Innerbox</span>
            <select value={opInnerbox} onChange={(e) => setOpInnerbox(e.target.value)} className={sel}>
              <option value="EFGH">EFGH</option>
              <option value="IJKL">IJKL</option>
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <p className={label}>Print Label</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => print("Test Print")} className="h-8 border-blue-500/30 bg-blue-500/10 text-[11px] font-semibold text-blue-600 hover:bg-blue-500/20">
              <Printer className="mr-1.5 size-3.5" /> Test Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => print("Broken Inner Box")} className="h-8 border-amber-500/30 bg-amber-500/10 text-[11px] font-semibold text-amber-600 hover:bg-amber-500/20">
              Broken Inner Box
            </Button>
            <Button variant="outline" size="sm" onClick={() => print("Broken Cart Box")} className="col-span-2 h-8 border-red-500/30 bg-red-500/10 text-[11px] font-semibold text-red-600 hover:bg-red-500/20">
              Broken Cart Box
            </Button>
          </div>
        </div>

        {isJ2 && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3" data-testid="legacy-amr">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-primary" />
              <p className="text-[11px] font-bold uppercase tracking-wide">Autonomous Mobile Robot</p>
            </div>
            <p className="text-[10px] font-medium text-destructive">
              Request Material belum dapat dilakukan dikarenakan Unboxing belum dimulai. Silahkan refresh status untuk sinkronkan status terbaru apabila Unboxing sudah berjalan.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" size="sm" disabled className="h-8 text-xs opacity-60">Request Material</Button>
              <FgReleaseButton name="A" />
              <FgReleaseButton name="B" />
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast.info("Not simulated in prototype.")}>Refresh</Button>
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between"><p className="font-medium text-muted-foreground">Output IDW</p><p className="font-mono font-bold" data-testid="legacy-output-idw">{num(outputIdw)}</p></div>
          <div className="flex items-center justify-between"><p className="font-medium text-muted-foreground">Output OEE</p><p className="font-mono font-bold" data-testid="legacy-output-oee">{num(outputOee)}</p></div>
          <div className="flex items-center justify-between"><p className="font-medium text-muted-foreground">Gap</p><p className="font-mono font-bold text-amber-600">{gapPct}%</p></div>
          <div className="flex items-center justify-between"><p className="font-medium text-muted-foreground">Total MPQ</p><p className="font-mono font-bold" data-testid="legacy-mpq">{num(totalMpq)} pcs</p></div>
        </div>
      </CardContent>
      <CounterDetailModal open={detailOpen} onOpenChange={setDetailOpen} logs={logs} onDeleteLast={() => setLogs((p) => p.slice(1))} />
    </Card>
  );
}

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

  // Sisa: remaining planned minutes of the PO at the line standard (falls back to the shift standard)
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
      <div className="flex w-full flex-1 flex-col gap-4 py-2" data-testid="legacy-dashboard">
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 shadow-xs dark:text-amber-300">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-bold" data-testid="idw-banner" data-reason={opMode.reason}>
            {opMode.reason === "srr-line-missing"
              ? "SRR Line belum ditentukan di master data Asset Management untuk line/mesin bottleneck ini"
              : `OEE is not active for this line yet (${lineId}). Only Inline Device Weigher monitoring is available.`}
          </p>
        </div>
        <div className="grid w-full flex-1 grid-cols-1 items-stretch md:max-w-xl">
          <InlineDeviceWeigher plantId={plantId} lineId={lineId} outputOee={outputOee} totalMpq={poInfo.mpq} />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="legacy-dashboard"
      className="grid w-full flex-1 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] [&>*:nth-child(3)]:md:col-span-2 [&>*:nth-child(3)]:xl:col-span-1"
    >
      <InlineDeviceWeigher plantId={plantId} lineId={lineId} outputOee={outputOee} totalMpq={mpq} />

      <Card className="h-full min-w-0 border border-border bg-card shadow-sm" data-testid="legacy-po">
        <CardHeader className="space-y-3 border-b border-border pb-3">
          <CardTitle icon={<FileText className="size-4" />}>Process Order Performance</CardTitle>
          <div className="space-y-3 rounded-lg border border-border bg-card p-3.5">
            <h3 className="text-sm font-bold leading-snug" data-testid="po-sku-name">{cur ? cur.skuName : poInfo.skuName}</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><p className={label}>Process Order</p><p className="font-mono font-bold" data-testid="po-number">{cur ? cur.poNumber : poInfo.poNumber}</p></div>
              <div><p className={label}>Material</p><p className="font-mono font-bold">{poInfo.materialNumber}</p></div>
              <div><p className={label}>Sediaan</p><p className="font-mono font-bold">{poInfo.sediaan}</p></div>
            </div>
            <label className="block space-y-1">
              <span className={label}>Operator</span>
              <select value={operator} onChange={(e) => setOperator(e.target.value)} className="w-full rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium">
                {poInfo.operators.map((op) => (<option key={op} value={op}>{op} ({lineId})</option>))}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 text-xs">
          <RunRateRow testId="legacy-rr-sku" title="Run rate SKU" target={skuRates.targetRemaining} actual={skuRates.actualPo} standard={skuStd} />
          <RunRateRow testId="legacy-rr-line" title="Run rate line" target={lineRates.targetRemaining} actual={lineRates.actualPo} standard={lineStd} />

          <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className={label}>Total output</p>
            <div className="flex items-baseline gap-2">
              <p className={`font-mono text-3xl font-extrabold tracking-tight ${outputOee >= mpq ? "text-emerald-600" : "text-foreground"}`} data-testid="legacy-po-output">{num(outputOee)}</p>
              <span className="font-mono text-base font-bold text-red-600" data-testid="legacy-po-reject">({num(totalReject)})</span>
            </div>
            <ProgressBar value={outputOee} scale={mpq} tone={outputOee >= mpq ? "bg-emerald-600" : "bg-primary"} testId="legacy-po-bar" />
            <p className="font-mono text-[11px] text-muted-foreground">{num(outputOee)} / {num(mpq)} ({poPct.toFixed(1)}%) total MPQ</p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/20 p-3 text-center" data-testid="legacy-qa">
            <div><p className={label}><ShieldCheck className="mr-1 inline size-3 text-primary" />Sample</p><p className="font-mono text-base font-bold">{qaStats.sample}</p></div>
            <div><p className={label}>Released</p><p className="font-mono text-base font-bold text-emerald-600">{qaStats.released}</p></div>
            <div><p className={label}>Reject</p><p className="font-mono text-base font-bold text-red-600">{qaStats.reject}</p></div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <div><p className={label}>Mulai</p><p className="font-mono font-medium">{startStr}</p></div>
            </div>
            <div className="flex items-center justify-end">
              <span className="rounded-md px-2.5 py-1 font-mono text-xs font-bold" style={{ background: "var(--fro-sisa-bg)", color: "var(--fro-sisa-fg)" }} data-testid="legacy-sisa">Sisa {sisaStr}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="h-full min-w-0 border border-border bg-card shadow-sm" data-testid="legacy-shift">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle icon={<BarChart3 className="size-4" />}>Shift Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 text-xs">
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className={label}>Actual output</p>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <p className="font-mono text-2xl font-extrabold" data-testid="legacy-shift-output">{num(outputOee)}</p>
                <span className="font-mono text-sm font-bold text-red-600" data-testid="legacy-shift-reject">({num(totalReject)})</span>
              </div>
              <p className="font-mono text-xs font-bold text-muted-foreground">{num(outputOee)} / {num(shiftProjected)} ({shiftPct.toFixed(1)}%)</p>
            </div>
            <ProgressBar value={outputOee} scale={shiftProjected} testId="legacy-shift-bar" />
            <p className="text-[10px] text-muted-foreground">{snap.shift.label.replace(" WIB", "")} | {formatTimeWib(snap.shift.startSec)} - {formatTimeWib(snap.shift.endSec)}</p>
          </div>

          <RunRateRow testId="legacy-rr-shift" title="Shift run rate line" target={shiftTarget} actual={shiftActual} standard={lineStd} />

          <OeeCard plantId={plantId} lineId={lineId} rejectCount={totalReject} ownToggle />
        </CardContent>
      </Card>

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
