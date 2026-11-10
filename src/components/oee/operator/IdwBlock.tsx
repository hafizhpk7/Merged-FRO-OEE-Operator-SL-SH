import { useState } from "react";
import { Boxes, Container, Package, Printer, RefreshCw, TriangleAlert, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { CounterDetailModal, type CountLogItem } from "./CounterDetailModal";
import { CounterRow, FgReleaseButton, FroCard, FroSelect, OutputRow, btn, label, num } from "./froUi";
import { getNow, getNowMs } from "@/lib/oee/shiftClock";

/** Inline Device Weigher block, shared by the old and the new Main Dashboard. */
export function IdwBlock({ plantId, lineId: _lineId, outputOee, totalMpq }: { plantId: string; lineId: string; outputOee: number; totalMpq: number }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [opKarbox, setOpKarbox] = useState("ABCD");
  const [opInnerbox, setOpInnerbox] = useState("EFGH");
  const outputIdw = Math.floor(outputOee * 0.985); // deterministic IDW output, 97 % - 99.8 % of Output OEE
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

  return (
    <FroCard testId="idw-card" tone="idw" icon={<Package />} title="Inline Device Weigher">
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex items-center justify-between">
          <p className={label}>Counter</p>
          <button type="button" className={btn.blue} onClick={() => setDetailOpen(true)}>
            <Maximize2 />
            Counter Detail
          </button>
        </div>
        <div className="grid gap-2">
          <CounterRow icon={<Package />} name="Innerbox" cur={currentInner} master={innerMaster} />
          <CounterRow icon={<Boxes />} name="Karbox" cur={currentCarton} master={cartonMaster} />
          <CounterRow icon={<Container />} name="Pallet" cur={currentPallet} master={palletMaster} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-2">
          <span className={label}>OP Karbox</span>
          <FroSelect value={opKarbox} onChange={setOpKarbox}>
            <option value="ABCD">ABCD</option>
            <option value="WXYZ">WXYZ</option>
          </FroSelect>
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>OP Innerbox</span>
          <FroSelect value={opInnerbox} onChange={setOpInnerbox}>
            <option value="EFGH">EFGH</option>
            <option value="IJKL">IJKL</option>
          </FroSelect>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className={label}>Print Label</p>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={btn.blue} onClick={() => print("Test Print")}>
            <Printer />
            Test Print
          </button>
          <button type="button" className={btn.danger} onClick={() => print("Broken Inner Box")}>
            <TriangleAlert />
            Broken Inner Box
          </button>
          <button type="button" className={btn.danger} onClick={() => print("Broken Cart Box")}>
            <TriangleAlert />
            Broken Cart Box
          </button>
        </div>
      </div>

      {isJ2 && (
        <div className="flex flex-col gap-2" data-testid="legacy-amr">
          <p className={label}>Autonomous Mobile Robot</p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled
              title="Request Material belum dapat dilakukan dikarenakan Unboxing belum dimulai. Silahkan refresh status untuk sinkronkan status terbaru apabila Unboxing sudah berjalan."
              className={btn.gray}
            >
              <Package />
              Request Material
            </button>
            <FgReleaseButton name="A" />
            <FgReleaseButton name="B" />
            <button type="button" className={btn.outline} onClick={() => toast.info("Not simulated in prototype.")}>
              <RefreshCw />
              Refresh
            </button>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col">
        <OutputRow name="Output IDW" value={num(outputIdw)} testId="legacy-output-idw" />
        <OutputRow name="Output OEE" value={num(outputOee)} testId="legacy-output-oee" />
        <OutputRow name="Gap" value={`${gapPct}%`} />
        <OutputRow name="Total MPQ" value={`${num(totalMpq)} pcs`} testId="legacy-mpq" />
      </div>
      <CounterDetailModal open={detailOpen} onOpenChange={setDetailOpen} logs={logs} onDeleteLast={() => setLogs((p) => p.slice(1))} />
    </FroCard>
  );
}

