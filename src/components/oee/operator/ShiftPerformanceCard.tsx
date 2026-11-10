import { OeeCard } from "./OeeCard";
import { BarChart3 } from "lucide-react";
import { TargetBlock } from "./TargetBlock";
import { useTargetSnapshot } from "./useTargetSnapshot";
import { FroCard, label, text2 } from "./froUi";
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
    <FroCard testId="shift-card" tone="shift" icon={<BarChart3 />} title="Shift Performance" gap="gap-6">
      <div className="flex flex-col gap-0.5">
        <p className={label} data-testid="shift-title">
          {snap.shift.label.replace(" WIB", "")} | {formatTimeWib(snap.shift.startSec)} - {formatTimeWib(snap.shift.endSec)}
        </p>
        <p className={`text-xs ${text2}`} data-testid="shift-projection">
          Target shift (proyeksi) <span className="font-semibold text-foreground">{s.projected.toLocaleString()}</span> pcs
          {snap.mode === "SKU" ? ` | dihitung ulang tiap changeover, saat ini ${runLabel}` : ` | ${runLabel}`}
        </p>
      </div>

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

      <div>
        <OeeCard plantId={plantId} lineId={lineId} rejectCount={totalReject} />
      </div>
    </FroCard>
  );
}
