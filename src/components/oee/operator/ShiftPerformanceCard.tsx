import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OeeCard } from "./OeeCard";
import { BarChart3 } from "lucide-react";
import { TargetBlock } from "./TargetBlock";
import { useTargetSnapshot } from "./useTargetSnapshot";
import { formatTimeWib } from "@/lib/oee/shiftClock";

export function ShiftPerformanceCard({
  plantId,
  lineId,
  totalReject,
}: {
  plantId: string;
  lineId: string;
  outputOee: number;
  totalReject: number;
}) {
  // CR 5: Shift Run Rate Line removed; same four elements as the PO card with the shift rules
  const snap = useTargetSnapshot(plantId, lineId);
  const s = snap.result.shift;
  const cur = snap.result.current;
  const runLabel =
    snap.mode === "LINE"
      ? `SRR Line ${snap.srrLine ?? "-"} ppm`
      : cur
        ? `${cur.skuLabel} ${cur.skuSrr ?? "-"} ppm`
        : "-";

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
        <div className="mt-2 rounded-lg border border-border bg-card p-3 text-xs">
          <p className="font-bold text-foreground" data-testid="shift-title">
            {snap.shift.label.replace(" WIB", "")}
          </p>
          <p className="mt-0.5 text-muted-foreground" data-testid="shift-projection">
            Target shift (proyeksi){" "}
            <span className="font-mono font-bold text-foreground">{s.projected.toLocaleString()}</span> pcs
            {snap.mode === "SKU"
              ? ` | dihitung ulang tiap changeover, saat ini ${runLabel}`
              : ` | ${runLabel}`}
            {" | "}
            {formatTimeWib(snap.shift.startSec)} - {formatTimeWib(snap.shift.endSec)}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 text-xs">
        <TargetBlock
          testId="shift-target"
          target={s.target}
          actual={s.actual}
          scale={s.projected}
          scaleLabel="target shift"
          reject={totalReject}
          gap={s.gap}
          gapMin={s.gapMin}
          noStandard={s.noStandard}
          frozen={snap.frozen}
          formula="jumlah per segmen SKU"
        />

        {/* OEE Card */}
        <OeeCard plantId={plantId} lineId={lineId} rejectCount={totalReject} />
      </CardContent>
    </Card>
  );
}
