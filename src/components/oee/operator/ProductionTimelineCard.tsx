import { useState, useMemo } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Flag, Info, XCircle, Tag } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TIMELINE_COLORS } from "@/lib/oee/reasonConstants";
import type { ShiftTimelineResult, MachineEvent } from "@/lib/oee/machineEvents";

export function ProductionTimelineCard({
  timeline,
  onOpenPendingList,
  onSelectEventToClassify,
}: {
  timeline: ShiftTimelineResult;
  onOpenPendingList: (typeFilter?: string) => void;
  onSelectEventToClassify: (event: MachineEvent) => void;
}) {
  const { events, windows, orders, snapshot } = timeline;

  // Segment D / MS / SL counts
  const dEvents = events.filter((e) => e.type === "downtime");
  const msEvents = events.filter((e) => e.type === "minor_stop");
  const slEvents = events.filter((e) => e.type === "speed_loss");

  const dUnclassified = dEvents.filter((e) => !e.isTagged).length;
  const msUnclassified = msEvents.filter((e) => !e.isTagged).length;
  const slUnclassified = slEvents.filter((e) => !e.isTagged).length;

  const totalPendingCount = dUnclassified + msUnclassified + slUnclassified;

  // Pagination (8 hours per page max)
  const [currentPage, setCurrentPage] = useState(1);
  const totalHours = 8; // Standard shift duration = 8 hours
  const hoursPerPage = 8;
  const totalPages = Math.ceil(totalHours / hoursPerPage);

  // Map 30s windows into 8 hourly rows (0..7)
  const hourRows = useMemo(() => {
    const rows = [];
    const shiftStartHour = 23; // e.g., Shift 3 starts at 23:00

    for (let h = 0; h < totalHours; h++) {
      const hourLabel = `${String((shiftStartHour + h) % 24).padStart(2, "0")}:00`;
      const hourStartSec = h * 3600;
      const hourEndSec = (h + 1) * 3600;

      // Filter events in this hour
      const hourEvents = events.filter((e) => e.startSec < hourEndSec && e.endSec > hourStartSec);

      // Windows in this hour (120 windows of 30s = 3600s = 60 mins)
      const hourWindows = windows.slice(h * 120, (h + 1) * 120);

      // Check if row is future / NOT STARTED
      const isFutureRow = h >= 5; // Rows after elapsed time

      rows.push({
        hourIndex: h,
        hourLabel,
        hourStartSec,
        hourEndSec,
        hourEvents,
        hourWindows,
        isFutureRow,
      });
    }
    return rows;
  }, [windows, events]);

  const visibleRows = hourRows.slice((currentPage - 1) * hoursPerPage, currentPage * hoursPerPage);

  return (
    <TooltipProvider delayDuration={100}>
      <Card className="border border-border bg-card shadow-xs">
        <CardHeader className="space-y-4 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  Production Timeline
                </h2>
                <button
                  onClick={() => onOpenPendingList()}
                  className="flex items-center gap-1.5 rounded-full border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-100"
                >
                  <Tag className="size-3" />
                  Pending Classifications {totalPendingCount}
                </button>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                REASON CLASSIFICATION
              </p>
            </div>

            {/* Pagination Controls if > 8 hours */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs font-mono">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* 3 Summary Chips: D, MS, SL */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Downtime Chip */}
            <button
              onClick={() => onOpenPendingList("downtime")}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium shadow-2xs transition-all hover:border-red-400"
            >
              <span className="flex size-5 items-center justify-center rounded bg-red-500 font-bold text-white text-[10px]">
                D
              </span>
              <span>Downtime · {dEvents.length}</span>
              <span
                className={`flex items-center gap-1 rounded px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                  dUnclassified > 0
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {dUnclassified > 0 && <AlertTriangle className="size-3 text-amber-500" />}
                {dUnclassified}
              </span>
            </button>

            {/* Minor Stop Chip */}
            <button
              onClick={() => onOpenPendingList("minor_stop")}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium shadow-2xs transition-all hover:border-purple-400"
            >
              <span className="flex size-5 items-center justify-center rounded bg-purple-500 font-bold text-white text-[10px]">
                MS
              </span>
              <span>Minor Stop · {msEvents.length}</span>
              <span
                className={`flex items-center gap-1 rounded px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                  msUnclassified > 0
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {msUnclassified > 0 && <AlertTriangle className="size-3 text-amber-500" />}
                {msUnclassified}
              </span>
            </button>

            {/* Speed Loss Chip */}
            <button
              onClick={() => onOpenPendingList("speed_loss")}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium shadow-2xs transition-all hover:border-amber-400"
            >
              <span className="flex size-5 items-center justify-center rounded bg-amber-500 font-bold text-white text-[10px]">
                SL
              </span>
              <span>Speed Loss · {slEvents.length}</span>
              <span
                className={`flex items-center gap-1 rounded px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                  slUnclassified > 0
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {slUnclassified > 0 && <AlertTriangle className="size-3 text-amber-500" />}
                {slUnclassified}
              </span>
            </button>
          </div>

          {/* Color Legend Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-emerald-500" />
              <span>Effective</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-red-500" />
              <span>Downtime</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-amber-500" />
              <span>Speed Loss</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-purple-500" />
              <span>Minor Stop</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-slate-500" />
              <span>Planned Downtime</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-slate-200 border border-slate-300 dark:bg-slate-800" />
              <span>Not Available / Unscheduled</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {/* Timeline Grid (Hour Rows) */}
          <div className="space-y-2">
            {visibleRows.map((row) => (
              <div key={row.hourIndex} className="flex items-center gap-3">
                {/* Hour Label */}
                <span className="w-12 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
                  {row.hourLabel}
                </span>

                {/* Bar Container for 1 Hour */}
                <div className="relative flex h-10 flex-1 items-center overflow-hidden rounded-md border border-border bg-muted/20">
                  {row.isFutureRow ? (
                    <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_8px,#e5e7eb_8px,#e5e7eb_16px)] dark:bg-[repeating-linear-gradient(45deg,#1e293b,#1e293b_8px,#0f172a_8px,#0f172a_16px)]">
                      {row.hourIndex === 5 && (
                        <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                          NOT STARTED
                        </span>
                      )}
                    </div>
                  ) : (
                    /* Contiguous Event Segments for Row */
                    <div className="flex h-full w-full">
                      {row.hourEvents.map((ev, evIdx) => {
                        const isLoss =
                          ev.type === "downtime" ||
                          ev.type === "minor_stop" ||
                          ev.type === "speed_loss";

                        const colorClasses =
                          ev.type === "downtime"
                            ? ev.isTagged
                              ? TIMELINE_COLORS.downtime.solid
                              : TIMELINE_COLORS.downtime.tint
                            : ev.type === "minor_stop"
                              ? ev.isTagged
                                ? TIMELINE_COLORS.minor_stop.solid
                                : TIMELINE_COLORS.minor_stop.tint
                              : ev.type === "speed_loss"
                                ? ev.isTagged
                                  ? TIMELINE_COLORS.speed_loss.solid
                                  : TIMELINE_COLORS.speed_loss.tint
                                : ev.type === "planned"
                                  ? TIMELINE_COLORS.planned.solid
                                  : TIMELINE_COLORS.effective.solid;

                        // Width percentage in hour
                        const widthPct = Math.max(2, Math.min(100, (ev.durationSec / 3600) * 100));

                        // Deterministic PO & Reject icons
                        const hasPoStart = evIdx === 0 && row.hourIndex === 0;
                        const hasReject =
                          evIdx === 1 && (row.hourIndex === 1 || row.hourIndex === 3);

                        return (
                          <Tooltip key={ev.id || evIdx}>
                            <TooltipTrigger asChild>
                              <div
                                onClick={() => {
                                  if (isLoss) {
                                    onSelectEventToClassify(ev);
                                  }
                                }}
                                style={{ width: `${widthPct}%` }}
                                className={`relative flex h-full items-center justify-center border-r border-background/20 px-1 transition-all ${colorClasses} ${
                                  isLoss ? "cursor-pointer hover:brightness-105" : ""
                                }`}
                              >
                                {/* PO Flag Icon */}
                                {hasPoStart && (
                                  <span className="absolute left-1 top-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                                    <Flag className="size-2.5" />
                                  </span>
                                )}

                                {/* Reject Icon */}
                                {hasReject && (
                                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-white shadow-xs">
                                    <XCircle className="size-2.5" />
                                  </span>
                                )}

                                {/* Warning icon for unclassified loss */}
                                {isLoss && !ev.isTagged && (
                                  <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="p-3 text-xs space-y-1.5 max-w-xs">
                              <p className="font-bold text-foreground">
                                {orders[0]?.productName || "Finished Goods"}
                              </p>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground font-mono">
                                <span>Batch: B2201</span>
                                <span>Time: {Math.round(ev.durationSec / 60)} mins</span>
                                <span>Output: {ev.type === "run" ? 120 : 0} pcs/min</span>
                                <span>Standard: 120 ppm</span>
                                <span>Total Output: {snapshot.totalOutput} pcs</span>
                                <span>Total Reject: {snapshot.rejects} pcs</span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Time Scale Ticks */}
          <div className="flex items-center justify-between pl-12 pt-1 font-mono text-[10px] text-muted-foreground">
            <span>:00</span>
            <span>:10</span>
            <span>:20</span>
            <span>:30</span>
            <span>:40</span>
            <span>:50</span>
            <span>:60</span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
