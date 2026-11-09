import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { OEE_CARD_FOLLOWS_SRR_SWITCH } from "@/lib/oee/config";
import { useSrrMode } from "@/lib/oee/srrStore";

export function OeeCard({
  plantId,
  lineId,
  rejectCount: _rejectCount,
}: {
  plantId: string;
  lineId: string;
  rejectCount: number;
}) {
  const srrMode = useSrrMode();
  // CR 5: the card has no toggle of its own; SRR SKU = SKU standard, SRR Line = machine/line rated speed
  const [localSkuOn, setLocalSkuOn] = useState(true);
  const skuOn = OEE_CARD_FOLLOWS_SRR_SWITCH ? srrMode === "SKU" : localSkuOn;
  const setSkuOn = setLocalSkuOn;
  const [expandOpen, setExpandOpen] = useState(false);

  const lineObj =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const machines = lineObj?.machines || [];

  const { lineMetrics, machineMetrics } = useMemo(
    () => computeOperatorCardMetrics(plantId, lineId, skuOn),
    [plantId, lineId, skuOn],
  );

  const formatPct = (val: number) => `${val.toFixed(2)}%`;
  const cappedPerf = Math.min(100, lineMetrics.performancePct);

  return (
    <>
      <Card className="border border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10 shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Overall Equipment Effectiveness
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {OEE_CARD_FOLLOWS_SRR_SWITCH ? (
                <span
                  data-testid="oee-card-srr"
                  className="rounded bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
                >
                  {srrMode === "SKU" ? "SRR SKU" : "SRR Line"}
                </span>
              ) : (
                <button
                  onClick={() => setSkuOn(!skuOn)}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold text-white transition-colors ${
                    skuOn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {skuOn ? "SKU-ON" : "SKU-OFF"}
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpandOpen(true)}
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <Maximize2 className="size-4" />
              </Button>
            </div>
          </div>

          {/* Donut & A/P/Q Bars */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative flex size-32 items-center justify-center rounded-full border-8 border-primary/20 bg-card shadow-inner">
              <div className="absolute inset-0 rounded-full border-8 border-primary border-t-transparent animate-spin-slow" />
              <div className="text-center">
                <span className="text-2xl font-extrabold font-mono text-foreground">
                  {lineMetrics.oeePct.toFixed(1)}%
                </span>
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                  OEE Line
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>AVA (Availability)</span>
                <span className="font-mono">{formatPct(lineMetrics.availabilityPct)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: `${lineMetrics.availabilityPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>PER (Performance)</span>
                <span className="font-mono">{formatPct(lineMetrics.performancePct)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-blue-600" style={{ width: `${cappedPerf}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span>QUA (Quality)</span>
                <span className="font-mono">{formatPct(lineMetrics.qualityPct)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-purple-600"
                  style={{ width: `${lineMetrics.qualityPct}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <div className="text-3xl font-extrabold font-mono text-primary">
                {lineMetrics.oeePct.toFixed(2)}%
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2 text-xs font-mono">
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
                        <span className="text-xs font-bold font-mono text-foreground">
                          {m.code} — {m.name}
                        </span>
                        <span className="text-sm font-extrabold font-mono text-primary">
                          {mM.oeePct.toFixed(1)}% OEE
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground">AVA</p>
                          <p className="font-mono font-bold">{formatPct(mM.availabilityPct)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">PER</p>
                          <p className="font-mono font-bold">{formatPct(mM.performancePct)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">QUA</p>
                          <p className="font-mono font-bold">{formatPct(mM.qualityPct)}</p>
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
