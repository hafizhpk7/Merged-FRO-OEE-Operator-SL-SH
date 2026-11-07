import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, LayoutGrid, XCircle, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinishWorkOrderModal } from "./FinishWorkOrderModal";
import { getLine, getPlant } from "@/lib/oee/data";

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Clock state
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
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
            <div className="flex size-7 items-center justify-center rounded-full bg-amber-500 font-semibold text-white text-xs">
              K
            </div>
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

          {/* Action Button: Finish Work Order ONLY (No Pause button!) */}
          <div className="flex items-center gap-2">
            <Button
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

      <FinishWorkOrderModal open={finishModalOpen} onOpenChange={setFinishModalOpen} />
    </>
  );
}
