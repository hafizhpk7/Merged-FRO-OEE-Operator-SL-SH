import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { type ProcessOrderInfo } from "@/lib/oee/poMaster";
import { RUN_RATE_THRESHOLDS } from "@/lib/oee/config";
import { FileText, Clock, ShieldCheck } from "lucide-react";

export function ProcessOrderCard({
  plantId,
  lineId,
  poInfo,
  outputOee,
  totalReject,
  qaStats,
}: {
  plantId: string;
  lineId: string;
  poInfo: ProcessOrderInfo;
  outputOee: number;
  totalReject: number;
  qaStats: { sample: number; released: number; reject: number };
}) {
  const [operator, setOperator] = useState(() => {
    if (typeof window === "undefined") return poInfo.activeOperator;
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

  // Run rates & elapse time calculations
  const skuStandard = poInfo.skuStandardRunRate;
  const lineStandard = 36; // bottleneck machine standard run rate
  const actualSkuRunRate = Math.round(skuStandard * 0.95);
  const actualLineRunRate = Math.round(lineStandard * 0.95);

  const targetSkuRunRate = Math.round(skuStandard * 0.88);
  const targetLineRunRate = Math.round(lineStandard * 0.88);

  const mpq = poInfo.mpq;
  const progressPct = mpq > 0 ? Math.min(100, (outputOee / mpq) * 100) : 0;
  const isGoalReached = outputOee >= mpq;

  // Remaining time calculation
  const sisaTarget = Math.max(0, mpq - outputOee);
  const remainingMinutes = actualLineRunRate > 0 ? Math.ceil(sisaTarget / actualLineRunRate) : 0;
  const days = Math.floor(remainingMinutes / 1440);
  const hours = Math.floor((remainingMinutes % 1440) / 60);
  const mins = remainingMinutes % 60;
  const sisaStr = `${days > 0 ? `${days}h ` : ""}${hours}j ${mins}m`;

  const startDateStr = new Date(poInfo.startTimeSec * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getRunRateColor = (actual: number, standard: number) => {
    const ratio = (actual / standard) * 100;
    if (ratio < RUN_RATE_THRESHOLDS.redMax) return "text-red-600";
    if (ratio > RUN_RATE_THRESHOLDS.yellowMin) return "text-amber-600";
    return "text-emerald-600";
  };

  return (
    <Card className="border border-border bg-card shadow-xs flex-[1.4] min-w-[360px]">
      <CardHeader className="border-b border-border bg-muted/20 pb-3">
        <div className="flex items-center gap-2.5 pb-2">
          <span className="flex size-8 items-center justify-center rounded bg-primary/10 text-primary">
            <FileText className="size-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Process Order Performance
          </span>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
          <h3 className="text-sm font-bold text-foreground leading-snug">{poInfo.skuName}</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                Process Order
              </p>
              <p className="font-mono font-bold text-foreground">{poInfo.poNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Material</p>
              <p className="font-mono font-bold text-foreground">{poInfo.materialNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Sediaan</p>
              <p className="font-mono font-bold text-foreground">{poInfo.sediaan}</p>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">
              Operators
            </label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium"
            >
              {poInfo.operators.map((op) => (
                <option key={op} value={op}>
                  {op} ({lineId})
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 text-xs">
        {/* Run Rate SKU */}
        <div className="space-y-1.5 rounded-lg border border-border p-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">
              Run Rate SKU
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              TARGET <span className="font-mono font-bold text-foreground">{targetSkuRunRate}</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted relative">
                <div className="absolute inset-y-0 left-0 bg-red-400 w-[60%]" />
                <div className="absolute inset-y-0 left-[60%] bg-emerald-400 w-[20%]" />
                <div className="absolute inset-y-0 left-[80%] bg-amber-400 w-[20%]" />
              </div>
            </div>
            <span
              className={`font-mono font-bold text-sm ${getRunRateColor(actualSkuRunRate, skuStandard)}`}
            >
              {actualSkuRunRate} / {skuStandard}
            </span>
          </div>
        </div>

        {/* Run Rate Line */}
        <div className="space-y-1.5 rounded-lg border border-border p-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">
              Run Rate Line
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              TARGET{" "}
              <span className="font-mono font-bold text-foreground">{targetLineRunRate}</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted relative">
                <div className="absolute inset-y-0 left-0 bg-red-400 w-[60%]" />
                <div className="absolute inset-y-0 left-[60%] bg-emerald-400 w-[20%]" />
                <div className="absolute inset-y-0 left-[80%] bg-amber-400 w-[20%]" />
              </div>
            </div>
            <span
              className={`font-mono font-bold text-sm ${getRunRateColor(actualLineRunRate, lineStandard)}`}
            >
              {actualLineRunRate} / {lineStandard}
            </span>
          </div>
        </div>

        {/* Total Output */}
        <div className="rounded-lg border border-border p-4 space-y-3 bg-card shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Output
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold font-mono tracking-tight ${isGoalReached ? "text-emerald-600" : "text-amber-600"}`}
            >
              {outputOee.toLocaleString()}
            </span>
            <span className="text-base font-bold font-mono text-red-600">
              ({totalReject.toLocaleString()})
            </span>
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${isGoalReached ? "bg-emerald-600" : "bg-amber-500"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
              <span>
                {outputOee.toLocaleString()} / {mpq.toLocaleString()} ({progressPct.toFixed(1)}%)
                total MPQ
              </span>
            </div>
          </div>
        </div>

        {/* QA row */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <span className="font-bold text-foreground">QA Inspection</span>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span className="text-muted-foreground">
              Sample: <b>{qaStats.sample}</b>
            </span>
            <span className="text-emerald-600 font-bold">
              Released: <b>{qaStats.released}</b>
            </span>
            <span className="text-red-600 font-bold">
              Reject: <b>{qaStats.reject}</b>
            </span>
          </div>
        </div>

        {/* Elapsed & Sisa row */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border text-xs">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-semibold">Mulai PO</p>
              <p className="font-mono font-medium text-foreground">{startDateStr}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 text-right">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                Sisa Waktu
              </p>
              <p className="font-mono font-bold text-amber-600">{sisaStr}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
