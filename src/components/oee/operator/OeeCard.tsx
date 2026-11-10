import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Maximize2 } from "lucide-react";
import { getLine } from "@/lib/oee/data";
import { computeOperatorCardMetrics } from "@/lib/oee/operatorCardEngine";
import { useViewShift } from "@/lib/oee/viewShiftStore";
import { useSimDataVersion, useSimWindowBucket } from "@/lib/oee/useSimTick";
import { OEE_CARD_FOLLOWS_SRR_SWITCH } from "@/lib/oee/config";
import { useSrrMode } from "@/lib/oee/srrStore";
import { label } from "./froUi";

/** SKU / Line pill switch of the old UI (blue = SKU, knob on the right). */
function SkuLineSwitch({ skuOn, onChange }: { skuOn: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={skuOn}
      aria-label="SKU / Line"
      data-testid="legacy-oee-toggle"
      data-mode={skuOn ? "sku" : "line"}
      onClick={() => onChange(!skuOn)}
      className={`relative h-[26px] w-[94px] shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${skuOn ? "bg-[#3b82f6]" : "bg-zinc-400"}`}
    >
      <span className={`absolute inset-y-0 left-1.5 flex w-[66px] items-center justify-center text-xs font-bold text-white ${skuOn ? "" : "opacity-0"}`}>SKU</span>
      <span aria-hidden={skuOn} className={`absolute inset-y-0 right-1.5 flex w-[66px] items-center justify-center text-xs font-bold text-white ${skuOn ? "opacity-0" : ""}`}>Line</span>
      <span className={`absolute top-1 size-[18px] rounded-full border border-black/5 bg-white transition-all ${skuOn ? "right-1" : "left-1"}`} />
    </button>
  );
}

export function OeeCard({
  plantId,
  lineId,
  rejectCount: _rejectCount,
  ownToggle = false,
}: {
  plantId: string;
  lineId: string;
  rejectCount: number;
  /** Legacy view: the card keeps its own SKU / Line toggle instead of following the SRR switch. */
  ownToggle?: boolean;
}) {
  const srrMode = useSrrMode();
  // CR 5: the card has no toggle of its own; SRR SKU = SKU standard, SRR Line = machine/line rated speed
  const [localSkuOn, setLocalSkuOn] = useState(true);
  const followSwitch = OEE_CARD_FOLLOWS_SRR_SWITCH && !ownToggle;
  const skuOn = followSwitch ? srrMode === "SKU" : localSkuOn;
  const [expandOpen, setExpandOpen] = useState(false);

  const lineObj =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const machines = lineObj?.machines || [];

  // Current shift: recomputed every sampling window (30 s simulated); completed shift: until its end.
  const view = useViewShift();
  const bucket = useSimWindowBucket();
  const dataVer = useSimDataVersion();
  const { lineMetrics, machineMetrics } = useMemo(
    () => computeOperatorCardMetrics(plantId, lineId, skuOn, undefined, view.isPast ? view.info.startSec : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantId, lineId, skuOn, view.isPast ? 0 : bucket, view.info.startSec, dataVer],
  );

  const formatPct = (val: number) => `${val.toFixed(2)}%`;
  const cappedPerf = Math.min(100, lineMetrics.performancePct);

  const bar = (name: string, value: number, pct: number, color: string, testId: string) => (
    <div className="flex min-w-0 flex-col gap-1" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={label}>{name}</p>
        <p className="text-sm font-bold">{formatPct(value)}</p>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--fro-track)]">
        <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-lg p-4" style={{ background: "var(--fro-oee-card-bg)" }} data-testid="oee-card">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold">Overall Equipment Effectiveness</p>
            <div className="flex shrink-0 items-center gap-2">
              {followSwitch ? (
                <span
                  data-testid="oee-card-srr"
                  className="inline-flex h-[26px] w-[94px] items-center justify-center rounded-full bg-[#3b82f6] text-xs font-bold text-white"
                >
                  {srrMode === "SKU" ? "SRR SKU" : "SRR Line"}
                </span>
              ) : (
                <SkuLineSwitch skuOn={skuOn} onChange={setLocalSkuOn} />
              )}
              <button
                type="button"
                aria-label="Detail OEE per mesin"
                onClick={() => setExpandOpen(true)}
                className="flex size-9 items-center justify-center rounded text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Maximize2 className="size-4" />
              </button>
            </div>
          </div>

          {/* Donut */}
          <div className="flex justify-center py-2">
            <div className="relative flex size-[180px] items-center justify-center" data-testid="oee-donut">
              <svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90" aria-hidden>
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="9" stroke="var(--fro-track)" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  strokeWidth="9"
                  strokeLinecap="round"
                  stroke="var(--fro-ring)"
                  pathLength={100}
                  strokeDasharray={`${Math.min(100, Math.max(0, lineMetrics.oeePct))} 100`}
                />
              </svg>
              <p className="font-bold tracking-[-0.025em]" style={{ fontSize: 33 }} data-testid="oee-value">
                {lineMetrics.oeePct.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
            {bar("AVA", lineMetrics.availabilityPct, lineMetrics.availabilityPct, "var(--fro-ok)", "oee-ava")}
            {bar("PER", lineMetrics.performancePct, cappedPerf, "var(--fro-warn)", "oee-per")}
            {bar("QUA", lineMetrics.qualityPct, lineMetrics.qualityPct, "var(--fro-info)", "oee-qua")}
          </div>
        </div>
      </div>

      {/* Expand Modal: Detail OEE per Machine */}
      <Dialog open={expandOpen} onOpenChange={setExpandOpen}>
        <DialogContent className="sm:max-w-3xl p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Production Line OEE Detail — {lineId}</DialogTitle>
            <DialogDescription>
              Comprehensive OEE line metrics and individual machine breakdown.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Line Summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Line OEE Summary ({srrMode === "SKU" ? "SRR SKU" : "SRR Line"})
              </p>
              <div className="text-3xl font-extrabold text-primary">
                {lineMetrics.oeePct.toFixed(2)}%
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2 text-xs">
                <div>
                  AVA: <b>{formatPct(lineMetrics.availabilityPct)}</b>
                </div>
                <div>
                  PER: <b>{formatPct(lineMetrics.performancePct)}</b>
                </div>
                <div>
                  QUA: <b>{formatPct(lineMetrics.qualityPct)}</b>
                </div>
              </div>
            </div>

            {/* Machines breakdown */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Machine OEE Detail ({machines.length} Machines)
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {machines.map((m) => {
                  const mCode = m.code || m.id;
                  const mM = machineMetrics[mCode] ?? lineMetrics;
                  return (
                    <div
                      key={m.code}
                      className="rounded-lg border border-border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {m.code} — {m.name}
                        </span>
                        <span className="text-sm font-extrabold text-primary">
                          {mM.oeePct.toFixed(1)}% OEE
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground">AVA</p>
                          <p className="font-bold">{formatPct(mM.availabilityPct)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">PER</p>
                          <p className="font-bold">{formatPct(mM.performancePct)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">QUA</p>
                          <p className="font-bold">{formatPct(mM.qualityPct)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
