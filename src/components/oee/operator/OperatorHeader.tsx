import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, LayoutGrid, XCircle, ListFilter, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinishWorkOrderModal } from "./FinishWorkOrderModal";
import { PauseWorkOrderModal } from "./PauseWorkOrderModal";
import { workOrderStore, useWorkOrder } from "@/lib/oee/workOrderStore";
import { getLine, getPlant } from "@/lib/oee/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REMINDER_TRIGGER_MINUTES } from "@/lib/oee/config";
import {
  getDemoClockOffsetMs,
  getShiftInfo,
  isShiftOverrideActive,
  jumpToShiftEnd,
  jumpToWibTime,
  setDemoClockOffsetMs,
  setShiftStartOverrideMin,
  subscribeClock,
} from "@/lib/oee/shiftClock";
import { getNow } from "@/lib/oee/shiftClock";

export function OperatorHeader({
  plantId,
  lineId,
  onBeforeFinishWorkOrder,
}: {
  plantId: string;
  lineId: string;
  onBeforeFinishWorkOrder?: (proceed: () => void) => void;
}) {
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const shiftKey = getShiftInfo().shiftKey;
  const wo = useWorkOrder(lineId, shiftKey);
  const [shiftOverride, setShiftOverride] = useState(() => isShiftOverrideActive());
  useEffect(() => subscribeClock(() => setShiftOverride(isShiftOverrideActive())), []);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Clock state
  const [currentTime, setCurrentTime] = useState("");
  const [demoOn, setDemoOn] = useState(() => getDemoClockOffsetMs() !== 0);
  useEffect(() => subscribeClock(() => setDemoOn(getDemoClockOffsetMs() !== 0)), []);

  useEffect(() => {
    const updateClock = () => {
      const now = getNow();
      // Friday, 6 November 2026 - 08:14:19 WIB
      const dateStr = now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-GB", { hour12: false });
      setCurrentTime(`${dateStr} - ${timeStr} WIB`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const plant = getPlant(plantId);
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const zoneName = line?.zoneId ? `LIQUID ${line.zoneId}` : "LIQUID A";

  return (
    <>
      <header className="flex flex-col gap-4 bg-background pb-4">
        {/* Top bar with Week, Clock, Theme, Avatar */}
        <div className="flex items-center justify-between border-b border-border pb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
              Week 45
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs">{currentTime}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="avatar-menu"
                  aria-label="Operator menu"
                  className={`flex size-7 items-center justify-center rounded-full bg-amber-500 font-semibold text-white text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    demoOn ? "ring-2 ring-red-500 ring-offset-1" : ""
                  }`}
                >
                  K
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Dev / demo clock {demoOn ? "(ON)" : ""}
                </DropdownMenuLabel>
                {REMINDER_TRIGGER_MINUTES.map((m) => (
                  <DropdownMenuItem
                    key={m}
                    data-testid={`demo-jump-${m}`}
                    onSelect={() => jumpToShiftEnd(m)}
                    className="text-xs"
                  >
                    Demo: jump to T-{m}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Multi-SKU shift (CR 5) {shiftOverride ? "(ON)" : ""}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  data-testid="demo-multisku"
                  onSelect={() => {
                    setShiftStartOverrideMin(390); // shifts start at :30 (06:30-14:30)
                    jumpToWibTime(10, 30);
                  }}
                  className="text-xs"
                >
                  Demo: multi-SKU shift 06:30-14:30 (now 10:30)
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="demo-standard-shifts"
                  disabled={!shiftOverride}
                  onSelect={() => setShiftStartOverrideMin(null)}
                  className="text-xs"
                >
                  Standard shifts (07:00 / 15:00 / 23:00)
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="demo-reset-wo"
                  onSelect={() => workOrderStore.reset()}
                  className="text-xs"
                >
                  Reset work order state
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid="demo-reset"
                  disabled={!demoOn}
                  onSelect={() => setDemoClockOffsetMs(null)}
                  className="text-xs"
                >
                  Reset demo clock
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-md bg-blue-600 text-white">
                <LayoutGrid className="size-4" />
              </span>
              <h1 className="text-base font-bold tracking-tight text-foreground uppercase">
                OVERALL EQUIPMENT EFFECTIVENESS
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 font-medium text-blue-700 dark:text-blue-300">
                Liquid Plant
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 font-medium text-blue-700 dark:text-blue-300">
                {zoneName}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                <span className="size-2 rounded-full bg-emerald-500" />
                {lineId}
              </span>
            </div>
          </div>

          {/* Pause Work Order (mock, TG-04) and Finish Work Order */}
          <div className="flex items-center gap-2">
            {wo.status === "finished" && (
              <span
                data-testid="wo-finished-badge"
                className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground"
              >
                Work order finished
              </span>
            )}
            {wo.status === "paused" && (
              <span
                data-testid="wo-paused-badge"
                className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800"
              >
                Paused (tetap dihitung berjalan)
              </span>
            )}
            {/* CR 3 SM-01..03: Summarization Kemas, available while packing and on partial stop / shift change */}
            <Button
              variant="outline"
              asChild
              data-testid="summarization-button"
              className="flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-medium"
            >
              <Link to="/operator/$plantId/$lineId/summarization" params={{ plantId, lineId }}>
                <ClipboardList className="size-4" />
                Summarization
              </Link>
            </Button>
            <Button
              variant="outline"
              data-testid="pause-wo"
              disabled={wo.status === "finished"}
              onClick={() => {
                if (wo.status === "paused") workOrderStore.resume(lineId, shiftKey);
                else setPauseModalOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border-amber-300 px-4 text-xs font-medium text-amber-800 hover:bg-amber-50"
            >
              {wo.status === "paused" ? (
                <PlayCircle className="size-4" />
              ) : (
                <PauseCircle className="size-4" />
              )}
              {wo.status === "paused" ? "Resume Work Order" : "Pause Work Order"}
            </Button>
            <Button
              disabled={wo.status === "finished"}
              onClick={() => {
                if (onBeforeFinishWorkOrder) {
                  onBeforeFinishWorkOrder(() => setFinishModalOpen(true));
                } else {
                  setFinishModalOpen(true);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs h-9 px-4 rounded-md shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              Finish Work Order
            </Button>
          </div>
        </div>

        {/* Tab Navigation Segmented Control */}
        <div className="flex items-center gap-2 pt-1">
          <Link
            to="/operator/$plantId/$lineId"
            params={{ plantId, lineId }}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              pathname === `/operator/${plantId}/${lineId}` ||
              pathname === `/operator/${plantId}/${lineId}/`
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            Dashboard
          </Link>
          <Link
            to="/operator/$plantId/$lineId/reject"
            params={{ plantId, lineId }}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              pathname.endsWith("/reject")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <XCircle className="size-3.5" />
            Reject
          </Link>
          <Link
            to="/operator/$plantId/$lineId/reason"
            params={{ plantId, lineId }}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              pathname.endsWith("/reason")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <ListFilter className="size-3.5" />
            Reason
          </Link>
        </div>
      </header>

      <FinishWorkOrderModal
        open={finishModalOpen}
        onOpenChange={setFinishModalOpen}
        onConfirm={() => workOrderStore.finish(lineId, shiftKey)}
      />
      <PauseWorkOrderModal
        open={pauseModalOpen}
        onOpenChange={setPauseModalOpen}
        onConfirm={() => workOrderStore.pause(lineId, shiftKey)}
      />
    </>
  );
}
