import { useMemo, useState } from "react";
import { Settings, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRejectSlots, type RejectSlot } from "@/lib/oee/rejectConfig";
import { rejectStore, useRejectStore } from "@/lib/oee/rejectStore";
import { formatTimeWib, getShiftInfo } from "@/lib/oee/shiftClock";
import { getLine } from "@/lib/oee/data";
import { KonfigurasiDetailModal } from "./KonfigurasiDetailModal";

type MachineRef = { id: string; code?: string; name?: string };

/** Hourly buckets visible on the page: shift start .. current hour (all 8 for a closed shift). */
function useBuckets(shiftKey: string) {
  const shift = getShiftInfo();
  const isCurrent = shiftKey === shift.shiftKey;
  const nowSec = Math.floor(Date.now() / 1000);
  const currentIdx = isCurrent
    ? Math.max(0, Math.min(7, Math.floor((nowSec - shift.startSec) / 3600)))
    : 7;
  const labels = Array.from({ length: currentIdx + 1 }, (_, h) =>
    formatTimeWib(shift.startSec + h * 3600),
  );
  return { labels, currentIdx, isCurrent };
}

export function RejectPageContent({
  plantId,
  lineId,
  selectedMachine,
  shiftKey,
}: {
  plantId: string;
  lineId: string;
  selectedMachine: string; // machine id/code
  shiftKey: string;
}) {
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const machines = (line?.machines as MachineRef[] | undefined) ?? [];
  const machine = machines.find((m) => m.id === selectedMachine || m.code === selectedMachine);
  const machineCode = machine?.code ?? machine?.id ?? selectedMachine;

  const slots = useMemo<RejectSlot[]>(
    () =>
      getRejectSlots(plantId, lineId).filter(
        (s) =>
          s.status === "Assigned" &&
          s.rejectTypeId &&
          s.rejectTypeName &&
          s.assignedMachine === machineCode,
      ),
    [plantId, lineId, machineCode],
  );

  // Subscribes this page to store changes (corrections re-render the charts).
  useRejectStore(plantId, lineId, shiftKey);
  const { labels, currentIdx } = useBuckets(shiftKey);

  const [configSlot, setConfigSlot] = useState<RejectSlot | null>(null);

  return (
    <div className="space-y-4 pb-12">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-8 rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="h-5 w-12 rounded bg-red-200 dark:bg-red-950" />
          <div>
            <p className="text-xs font-bold text-foreground">Current</p>
            <p className="text-[11px] text-muted-foreground">Nilai setelah koreksi diterapkan</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-12 border-b-2 border-dashed border-red-400" />
          <div>
            <p className="text-xs font-bold text-foreground">Actual</p>
            <p className="text-[11px] text-muted-foreground">Nilai sebelum koreksi diterapkan</p>
          </div>
        </div>
      </div>

      {slots.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-xs text-muted-foreground">
          Belum ada slot reject yang di-assign ke mesin {machineCode}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {slots.map((slot) => {
          const series = rejectStore.getHourlySeries(
            plantId,
            lineId,
            shiftKey,
            slot.rejectTypeId!,
            machineCode,
          );
          const current = series.current.slice(0, currentIdx + 1);
          const actual = series.actual.slice(0, currentIdx + 1);
          const total = current.reduce((a, b) => a + b, 0);

          return (
            <Card key={slot.slotId} className="border border-border bg-card p-4 shadow-xs">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 size-5 fill-red-600 text-white" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{slot.rejectTypeName}</h4>
                    <p className="text-red-700">
                      <span className="text-xl font-bold">{total}</span>{" "}
                      <span className="text-[11px] font-medium text-muted-foreground">
                        pcs reject
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfigSlot(slot)}
                  className="h-8 border-red-200 text-[11px] font-semibold text-red-700 hover:bg-red-50 hover:text-red-800"
                >
                  <Settings className="mr-1 size-3" /> Konfigurasi Detail
                </Button>
              </div>

              <RejectBucketChart labels={labels} current={current} actual={actual} />
            </Card>
          );
        })}
      </div>

      <KonfigurasiDetailModal
        open={!!configSlot}
        onOpenChange={(op) => !op && setConfigSlot(null)}
        slot={configSlot}
        plantId={plantId}
        lineId={lineId}
        shiftKey={shiftKey}
        machineCode={machineCode}
      />
    </div>
  );
}

/** Bars = current (after correction); dashed line + dots = actual (before correction). */
function RejectBucketChart({
  labels,
  current,
  actual,
}: {
  labels: string[];
  current: number[];
  actual: number[];
}) {
  const n = labels.length;
  const maxVal = Math.max(1, ...current, ...actual);
  const CHART_H = 150;
  const yOf = (v: number) => 100 - (v / maxVal) * 100; // percent from top

  const points = actual.map((v, i) => `${((i + 0.5) / n) * 100},${yOf(v)}`).join(" ");

  return (
    <div className="mt-3">
      <div className="relative" style={{ height: CHART_H + 20 }}>
        <div className="absolute inset-x-0 top-5 bottom-0 border-b border-border/60">
          <div className="absolute inset-0 flex items-end">
            {current.map((v, i) => (
              <div key={i} className="flex h-full flex-1 items-end justify-center px-[3px]">
                <div
                  className="w-full rounded-t-sm bg-red-200 dark:bg-red-900/60"
                  style={{ height: `${(v / maxVal) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polyline
              points={points}
              fill="none"
              stroke="#f87171"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {actual.map((v, i) => (
            <span
              key={i}
              className="pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-400 bg-red-300"
              style={{ left: `${((i + 0.5) / n) * 100}%`, top: `${yOf(v)}%` }}
            />
          ))}
          {current.map((v, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 text-[11px] font-bold text-foreground"
              style={{
                left: `${((i + 0.5) / n) * 100}%`,
                bottom: `calc(${(Math.max(v, actual[i] ?? 0) / maxVal) * 100}% + 6px)`,
              }}
            >
              {v}
            </span>
          ))}
        </div>
      </div>
      <div className="flex">
        {labels.map((l, i) => (
          <span
            key={l + i}
            className={`flex-1 pt-1.5 text-center text-[11px] ${
              i === n - 1 ? "font-semibold text-red-600" : "text-muted-foreground"
            }`}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
