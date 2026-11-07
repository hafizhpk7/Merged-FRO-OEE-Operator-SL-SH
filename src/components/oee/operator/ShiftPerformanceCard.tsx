import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OeeCard } from "./OeeCard";
import { RUN_RATE_THRESHOLDS } from "@/lib/oee/config";
import { BarChart3 } from "lucide-react";

export function ShiftPerformanceCard({
  plantId,
  lineId,
  outputOee,
  totalReject,
}: {
  plantId: string;
  lineId: string;
  outputOee: number;
  totalReject: number;
}) {
  const shiftTarget = 22050; // shift MPQ target
  const shiftProgressPct = shiftTarget > 0 ? Math.min(100, (outputOee / shiftTarget) * 100) : 0;

  const actualShiftRunRate = 22;
  const standardShiftRunRate = 35;
  const targetShiftRunRate = 129;

  const getRunRateColor = (actual: number, standard: number) => {
    const ratio = (actual / standard) * 100;
    if (ratio < RUN_RATE_THRESHOLDS.redMax) return "text-red-600";
    if (ratio > RUN_RATE_THRESHOLDS.yellowMin) return "text-amber-600";
    return "text-emerald-600";
  };

  return (
    <Card className="border border-border bg-card shadow-xs flex-[1.4] min-w-[360px]">
      <CardHeader className="border-b border-border bg-muted/20 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Shift Performance
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 text-xs">
        {/* Actual Output */}
        <div className="rounded-lg border border-border p-4 space-y-3 bg-card shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Actual Output
          </p>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold font-mono text-foreground">
                {outputOee.toLocaleString()}
              </span>
              <span className="text-sm font-bold font-mono text-red-600">
                ({totalReject.toLocaleString()})
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-muted-foreground">
              {outputOee.toLocaleString()} / {shiftTarget.toLocaleString()} (
              {shiftProgressPct.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${shiftProgressPct}%` }}
            />
          </div>
        </div>

        {/* Shift Run Rate Line */}
        <div className="space-y-1.5 rounded-lg border border-border p-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">
              Shift Run Rate Line
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              TARGET{" "}
              <span className="font-mono font-bold text-foreground">{targetShiftRunRate}</span>
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
              className={`font-mono font-bold text-sm ${getRunRateColor(actualShiftRunRate, standardShiftRunRate)}`}
            >
              {actualShiftRunRate} / {standardShiftRunRate}
            </span>
          </div>
        </div>

        {/* OEE Card */}
        <OeeCard plantId={plantId} lineId={lineId} rejectCount={totalReject} />
      </CardContent>
    </Card>
  );
}
