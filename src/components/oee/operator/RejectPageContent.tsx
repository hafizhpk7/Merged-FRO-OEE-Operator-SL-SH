import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRejectSlots, type RejectSlot } from "@/lib/oee/rejectConfig";
import { rejectStore, useRejectStore } from "@/lib/oee/rejectStore";
import { AddRejectModal } from "./AddRejectModal";
import { RemoveRejectModal } from "./RemoveRejectModal";
import { KonfigurasiDetailModal } from "./KonfigurasiDetailModal";
import { Plus, Settings, Trash2, Calendar, BarChart2 } from "lucide-react";
import { getLine } from "@/lib/oee/data";

export function RejectPageContent({
  plantId,
  lineId,
  selectedMachine,
  shiftKey,
}: {
  plantId: string;
  lineId: string;
  selectedMachine: string; // "ALL" or machineCode
  shiftKey: string;
}) {
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const machines: { code: string; name: string }[] = (line?.machines as {
    code: string;
    name: string;
  }[]) || [
    { code: "LCM07", name: "Cartoning Machine" },
    { code: "LBF01", name: "Filler" },
  ];

  const [slots, setSlots] = useState<RejectSlot[]>(() => getRejectSlots(plantId, lineId));
  const [viewMode, setViewMode] = useState<"hourly" | "daily">("hourly");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [removeModalSlot, setRemoveModalSlot] = useState<RejectSlot | null>(null);
  const [configModalSlot, setConfigModalSlot] = useState<RejectSlot | null>(null);

  const { logs, totals } = useRejectStore(plantId, lineId, shiftKey);

  const hoursLabels = [
    "23:00",
    "00:00",
    "01:00",
    "02:00",
    "03:00",
    "04:00",
    "05:00",
    "06:00",
    "07:00",
    "08:00",
    "09:00",
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Legend & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="size-4 rounded bg-red-200 dark:bg-red-950 inline-block" />
            <div>
              <p className="text-xs font-bold text-foreground">Current</p>
              <p className="text-[10px] text-muted-foreground">Nilai setelah koreksi diterapkan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 border-b-2 border-dashed border-red-400 inline-block" />
            <div>
              <p className="text-xs font-bold text-foreground">Actual</p>
              <p className="text-[10px] text-muted-foreground">Nilai sebelum koreksi diterapkan</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-border p-0.5 bg-muted/40 text-xs">
            <button
              onClick={() => setViewMode("hourly")}
              className={`rounded px-3 py-1 font-semibold transition-colors ${
                viewMode === "hourly"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground"
              }`}
            >
              Shift Hourly
            </button>
            <button
              onClick={() => setViewMode("daily")}
              className={`rounded px-3 py-1 font-semibold transition-colors ${
                viewMode === "daily" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              7-Day Trend
            </button>
          </div>

          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-primary text-primary-foreground text-xs font-semibold px-4 h-8"
          >
            <Plus className="size-3.5 mr-1" /> Tambah Reject / Rework
          </Button>
        </div>
      </div>

      {/* Slots Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {slots
          .filter((s) => s.status === "Assigned" && s.rejectTypeId && s.rejectTypeName)
          .filter((s) => selectedMachine === "ALL" || s.assignedMachine === selectedMachine)
          .map((slot) => {
            const slotLogs = logs.filter(
              (l) => l.rejectTypeId === slot.rejectTypeId && l.machineCode === slot.assignedMachine,
            );
            const slotTotal = slotLogs.reduce((acc, l) => acc + l.qty, 0);
            const hourlySeries = rejectStore.getHourlySeries(
              plantId,
              lineId,
              shiftKey,
              slot.rejectTypeId!,
              slot.assignedMachine || undefined,
            );
            const dailyTrend = rejectStore.getDailyTrend(plantId, lineId, [slot.rejectTypeId!]);

            return (
              <Card key={slot.slotId} className="border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded bg-red-500/10 text-red-600 font-bold">
                      ✕
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {slot.rejectTypeName} ({slot.assignedMachine})
                      </h4>
                      <p className="text-[11px] font-mono font-bold text-red-600">
                        {slotTotal} pcs reject
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRemoveModalSlot(slot)}
                      className="h-7 text-[11px] px-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="size-3 mr-1" /> Hapus
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfigModalSlot(slot)}
                      className="h-7 text-[11px] px-2"
                    >
                      <Settings className="size-3 mr-1" /> Konfigurasi Detail
                    </Button>
                  </div>
                </div>

                <CardContent className="p-4">
                  {viewMode === "hourly" ? (
                    <div className="space-y-3">
                      <div className="flex h-36 items-end gap-2 pt-4 pb-2 px-2 border-b border-border/60">
                        {hourlySeries.current.map((val, idx) => {
                          const maxVal = Math.max(...hourlySeries.current, 10);
                          const heightPct = Math.min(100, Math.max(10, (val / maxVal) * 100));
                          const actualVal = hourlySeries.actual[idx] || 0;

                          return (
                            <div
                              key={idx}
                              className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
                            >
                              {/* Tooltip on hover */}
                              <div className="absolute -top-8 hidden group-hover:flex flex-col items-center bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-md z-10 whitespace-nowrap border border-border">
                                <span className="font-semibold">{hoursLabels[idx]}</span>
                                <span>Current: {val} pcs</span>
                                <span>Actual: {actualVal} pcs</span>
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {val}
                              </span>
                              <div
                                className={`w-full rounded-t transition-all ${
                                  idx === hourlySeries.current.length - 1
                                    ? "bg-red-600"
                                    : "bg-red-300 dark:bg-red-900"
                                }`}
                                style={{ height: `${heightPct}%` }}
                              />
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {hoursLabels[idx]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                        <span>Slot ID: {slot.slotId}</span>
                        <span className="font-medium text-foreground">
                          Sensor + Manual + QA Synchronized
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex h-36 items-end gap-3 pt-4 pb-2 px-2 border-b border-border/60">
                        {dailyTrend.map((d, idx) => {
                          const maxVal = Math.max(...dailyTrend.map((x) => x.total), 20);
                          const heightPct = Math.min(100, Math.max(15, (d.total / maxVal) * 100));

                          return (
                            <div
                              key={idx}
                              className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
                            >
                              <div className="absolute -top-8 hidden group-hover:flex flex-col items-center bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-md z-10 whitespace-nowrap border border-border">
                                <span>{d.dateLabel}</span>
                                <span className="font-semibold">{d.total} pcs</span>
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {d.total}
                              </span>
                              <div
                                className="w-full rounded-t bg-primary/70 hover:bg-primary transition-all"
                                style={{ height: `${heightPct}%` }}
                              />
                              <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                                {d.dateLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> 7-Day Historical Reject Trend
                        </span>
                        <span className="font-semibold text-foreground">
                          Total: {dailyTrend.reduce((a, b) => a + b.total, 0)} pcs
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Modals */}
      <AddRejectModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        plantId={plantId}
        lineId={lineId}
        defaultMachine={selectedMachine === "ALL" ? machines[0]?.code || "LCM07" : selectedMachine}
        defaultRejectTypeId="reject-seal"
        machines={machines}
        shiftKey={shiftKey}
      />

      <RemoveRejectModal
        open={!!removeModalSlot}
        onOpenChange={(op) => !op && setRemoveModalSlot(null)}
        logs={
          removeModalSlot
            ? logs.filter(
                (l) =>
                  l.rejectTypeId === removeModalSlot.rejectTypeId &&
                  l.machineCode === removeModalSlot.assignedMachine,
              )
            : []
        }
        rejectTypeName={removeModalSlot?.rejectTypeName || ""}
      />

      <KonfigurasiDetailModal
        open={!!configModalSlot}
        onOpenChange={(op) => !op && setConfigModalSlot(null)}
        slot={configModalSlot}
        machines={machines}
        onSaveConfig={(updated) => {
          setSlots((prev) => prev.map((s) => (s.slotId === updated.slotId ? updated : s)));
        }}
      />
    </div>
  );
}
