import { useState, useEffect } from "react";
import { type ProcessOrderInfo } from "@/lib/oee/poMaster";
import { FileText, Clock, ShieldCheck, Box } from "lucide-react";
import { TargetBlock } from "./TargetBlock";
import { useTargetSnapshot } from "./useTargetSnapshot";
import { FroCard, MulaiRow, PoHeaderBox, QaCounters } from "./froUi";

/**
 * New (CR 5) Process Order Performance: same card frame, typography and sections as the old view;
 * the old run-rate sections are replaced by the Target / Actual / GAP block.
 */
export function ProcessOrderCard({
  plantId,
  lineId,
  poInfo,
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
    <FroCard testId="po-card" tone="po" icon={<FileText />} title="Process Order Performance">
      <PoHeaderBox
        sku={display.skuName}
        po={display.poNumber}
        material={poInfo.materialNumber}
        sediaan={poInfo.sediaan}
        operator={operator}
        operators={poInfo.operators}
        lineId={lineId}
        onOperator={setOperator}
        icon={<Box />}
      />

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

      <QaCounters testId="po-qa" qaStats={qaStats} icon={<ShieldCheck className="size-3.5" />} />

      <div className="flex flex-col gap-4">
        <MulaiRow start={startDateStr} sisa={sisaStr} icon={<Clock />} testId="po-sisa" />
      </div>
    </FroCard>
  );
}
