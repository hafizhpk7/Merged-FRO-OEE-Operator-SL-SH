import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { type ProcessOrderInfo } from "@/lib/oee/poMaster";
import { FileText, Clock, ShieldCheck } from "lucide-react";
import { TargetBlock } from "./TargetBlock";
import { useTargetSnapshot } from "./useTargetSnapshot";

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

  // CR 5: target / actual / GAP come from the shift plan and the 30 s windows (universal SRR switch)
  const snap = useTargetSnapshot(plantId, lineId);
  const cur = snap.result.current;
  const po = snap.result.po;
  const display = {
    skuName: cur ? cur.skuName : poInfo.skuName,
    poNumber: cur ? cur.poNumber : poInfo.poNumber,
  };

  // Elapsed time / remaining time (kept from before)
  const lineStandard = 36; // bottleneck machine standard run rate
  const actualLineRunRate = Math.round(lineStandard * 0.95);
  const mpq = po.mpq || poInfo.mpq;
  const sisaTarget = Math.max(0, mpq - po.actual);
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
          <h3 className="text-sm font-bold text-foreground leading-snug" data-testid="po-sku-name">
            {display.skuName}
          </h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                Process Order
              </p>
              <p className="font-mono font-bold text-foreground" data-testid="po-number">
                {display.poNumber}
              </p>
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
        {/* CR 5: Run Rate SKU / Run Rate Line removed; target, actual and GAP replace them */}
        <TargetBlock
          testId="po-target"
          target={po.target}
          actual={po.actual}
          scale={mpq}
          scaleLabel="total MPQ"
          reject={totalReject}
          gap={po.gap}
          gapMin={po.gapMin}
          noStandard={po.noStandard}
          frozen={snap.frozen}
          formula={`${po.startPoint.toLocaleString()} + ${cur?.srr ?? 0} x ${po.scheduledMin} menit (maks. MPQ)`}
        />

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
