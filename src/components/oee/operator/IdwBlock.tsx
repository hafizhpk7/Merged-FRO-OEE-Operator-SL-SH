import { getNow, getNowMs } from "@/lib/oee/shiftClock";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CounterDetailModal, type CountLogItem } from "./CounterDetailModal";
import { toast } from "sonner";
import { Package, Printer, Bot } from "lucide-react";

export function IdwBlock({
  plantId,
  lineId,
  outputOee,
  totalMpq,
}: {
  plantId: string;
  lineId: string;
  outputOee: number;
  totalMpq: number;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [opKarbox, setOpKarbox] = useState("ABCD");
  const [opInnerbox, setOpInnerbox] = useState("EFGH");

  // Deterministic IDW output (97% - 99.8% of Output OEE)
  const outputIdw = Math.floor(outputOee * 0.985);
  const gapPct = outputOee > 0 ? (((outputOee - outputIdw) / outputOee) * 100).toFixed(2) : "0.00";

  // Counter calculation
  const innerMaster = 12;
  const cartonMaster = 220;
  const palletMaster = 13;

  const currentInner = innerMaster > 0 ? outputIdw % innerMaster : 0;
  const totalCartons = Math.floor(outputIdw / (innerMaster || 1));
  const currentCarton = cartonMaster > 0 ? totalCartons % cartonMaster : totalCartons;
  const totalPallets = Math.floor(totalCartons / (cartonMaster || 1));
  const currentPallet = palletMaster > 0 ? totalPallets : totalPallets;

  const [countLogs, setCountLogs] = useState<CountLogItem[]>([
    { id: "log-1", type: "INNERBOX", count: currentInner, at: "08:12:00" },
    { id: "log-2", type: "KARBOX", count: currentCarton, at: "08:10:00" },
  ]);

  const handleDeleteLastCount = () => {
    setCountLogs((prev) => prev.slice(1));
  };

  const handlePrintAction = (labelName: string) => {
    toast.success(`Printed (mock): ${labelName}`);
    setCountLogs((prev) => [
      {
        id: `log-${getNowMs()}`,
        type: "KARBOX",
        count: currentCarton,
        at: getNow().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  const isJ2 = plantId.toLowerCase() === "j2" || plantId.toLowerCase() === "jatake-2";

  return (
    <Card className="h-full min-w-0 border border-border bg-card shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded bg-primary/10 text-primary">
            <Package className="size-4" />
          </span>
          <CardTitle className="text-sm font-bold uppercase tracking-wide">
            Inline Device Weigher
          </CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDetailOpen(true)}
          className="h-7 text-[11px] px-2.5"
        >
          Counter Detail
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 p-4 text-xs">
        {/* Counter Section */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Counter
          </p>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium">
              <span>INNERBOX</span>
              <span className="font-mono font-bold">
                {currentInner} / {innerMaster}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (currentInner / innerMaster) * 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium">
              <span>KARBOX</span>
              <span className="font-mono font-bold">
                {currentCarton} / {cartonMaster}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (currentCarton / cartonMaster) * 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium">
              <span>PALLET</span>
              <span className="font-mono font-bold">
                {currentPallet} / {palletMaster}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (currentPallet / palletMaster) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Operator Selects */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">
              OP KARBOX
            </label>
            <select
              value={opKarbox}
              onChange={(e) => setOpKarbox(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium"
            >
              <option value="ABCD">ABCD</option>
              <option value="WXYZ">WXYZ</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">
              OP INNERBOX
            </label>
            <select
              value={opInnerbox}
              onChange={(e) => setOpInnerbox(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium"
            >
              <option value="EFGH">EFGH</option>
              <option value="IJKL">IJKL</option>
            </select>
          </div>
        </div>

        {/* Print Label Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePrintAction("Test Print")}
            className="h-8 text-[11px] bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30 font-semibold"
          >
            <Printer className="size-3.5 mr-1.5" /> Test Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePrintAction("Broken Inner Box")}
            className="h-8 text-[11px] bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30 font-semibold"
          >
            Broken Inner Box
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePrintAction("Broken Cart Box")}
            className="h-8 text-[11px] col-span-2 bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/30 font-semibold"
          >
            Broken Cart Box
          </Button>
        </div>

        {/* Autonomous Mobile Robot Block (J2 only) */}
        {isJ2 && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-primary" />
              <p className="text-[11px] font-bold uppercase tracking-wide">
                Autonomous Mobile Robot
              </p>
            </div>
            <p className="text-[10px] text-destructive font-medium">
              Request Material belum dapat dilakukan dikarenakan Unboxing belum dimulai. Silahkan
              refresh status untuk sinkronkan status terbaru apabila Unboxing sudah berjalan.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" size="sm" disabled className="h-7 text-[10px] opacity-60">
                Request Material
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success("AMR FG Release A requested (mock).")}
                className="h-7 text-[10px]"
              >
                FG Release A
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success("AMR FG Release B requested (mock).")}
                className="h-7 text-[10px]"
              >
                FG Release B
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Not simulated in prototype.")}
                className="h-7 text-[10px]"
              >
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* Output rows */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Output IDW</span>
            <span className="font-mono font-bold text-foreground">
              {outputIdw.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Output OEE</span>
            <span className="font-mono font-bold text-foreground">
              {outputOee.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Gap</span>
            <span className="font-mono font-bold text-amber-600">{gapPct}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Total MPQ</span>
            <span className="font-mono font-bold text-foreground">
              {totalMpq.toLocaleString()} pcs
            </span>
          </div>
        </div>
      </CardContent>

      <CounterDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        logs={countLogs}
        onDeleteLast={handleDeleteLastCount}
      />
    </Card>
  );
}
