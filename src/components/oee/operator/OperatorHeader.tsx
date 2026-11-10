import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Factory,
  Gauge,
  LayoutGrid,
  ListFilter,
  Layers,
  PauseCircle,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { FinishWorkOrderModal } from "./FinishWorkOrderModal";
import { PauseWorkOrderModal } from "./PauseWorkOrderModal";
import { ShiftSelect } from "./ShiftSelect";
import { btn } from "./froUi";
import { workOrderStore, useWorkOrder } from "@/lib/oee/workOrderStore";
import { useLineOperationalMode } from "@/lib/oee/assetMaster";
import { useViewShift } from "@/lib/oee/viewShiftStore";
import { useDashboardVersion } from "@/lib/oee/dashboardVersionStore";
import { SRR_BLOCKED_TABS, isOeeActiveLine } from "@/lib/oee/config";
import { srrBlockStore } from "@/lib/oee/srrBlockStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getLine } from "@/lib/oee/data";
import { getShiftInfo } from "@/lib/oee/shiftClock";

const chip =
  "inline-flex items-center gap-1 rounded-md border border-[color:var(--fro-card-border)] px-2 py-0.5 text-xs font-bold [&_svg]:size-3";
const blueChip = `${chip} bg-[color:var(--fro-chip-blue-bg)] text-[color:var(--fro-chip-blue-fg)]`;

/**
 * Header card of every operator page (old FRO design): icon chip + title + plant / zone / line chips,
 * Pause / Finish Work Order, then the Dashboard / Reject / Reason tabs and LIST SHIFT.
 */
export function OperatorHeader({
  plantId,
  lineId,
  onBeforeFinishWorkOrder,
  onBeforeShiftChange,
  extra,
}: {
  plantId: string;
  lineId: string;
  onBeforeFinishWorkOrder?: (proceed: () => void) => void;
  onBeforeShiftChange?: (proceed: () => void) => void;
  /** Controls beside LIST SHIFT (same section). */
  extra?: ReactNode;
}) {
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const shiftKey = getShiftInfo().shiftKey;
  const wo = useWorkOrder(lineId, shiftKey);
  const viewShift = useViewShift();
  const viewingPast = viewShift.isPast;
  const version = useDashboardVersion();
  const opMode = useLineOperationalMode(plantId, lineId);
  const srrMissing = opMode.reason === "srr-line-missing";
  // IDW-only lines (not a SCADA pilot line, or SRR Line not set) cannot open Reason
  const reasonBlocked = opMode.mode !== "full" && SRR_BLOCKED_TABS.includes("reason");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onDashboard = pathname === `/operator/${plantId}/${lineId}` || pathname === `/operator/${plantId}/${lineId}/`;
  const legacy = version === "old" && onDashboard;
  // the five SCADA pilot lines (J2: TUP01, TUP13, TUP14, BOP15, BOP16) have no Pause Work Order button
  const showPause = !isOeeActiveLine(plantId, lineId);

  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const zoneName = line?.zoneId ? `LIQUID ${line.zoneId}` : "LIQUID A";

  const tab = (active: boolean) =>
    `inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
      active
        ? "bg-card font-semibold text-[color:var(--fro-info)] dark:text-blue-400"
        : "font-medium text-[color:var(--fro-text-2)] hover:text-foreground"
    }`;

  return (
    <>
      <section
        className="rounded-md border border-[color:var(--fro-card-border)] bg-card p-5"
        style={{ boxShadow: "var(--fro-shadow)" }}
        data-testid="operator-header"
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg p-2" style={{ background: "var(--fro-chip-blue-bg)", color: "var(--fro-chip-blue-fg)" }}>
              <Gauge className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-sm font-bold uppercase tracking-[0.8px] text-black/80 dark:text-white/80">Overall Equipment Effectiveness</h1>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={blueChip}>
                  <Factory />
                  Liquid Plant
                </span>
                <span className={blueChip}>
                  <Layers />
                  {zoneName}
                </span>
                <span className={`${chip} bg-[color:var(--fro-chip-green-bg)] text-[color:var(--fro-chip-green-fg)]`}>
                  <span className="!size-1.5 rounded-full bg-[color:var(--fro-chip-green-fg)]" />
                  {lineId}
                </span>
                {legacy && (
                  <span data-testid="legacy-chip" className={`${chip} bg-muted text-muted-foreground`}>
                    Legacy view
                  </span>
                )}
                {srrMissing && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          data-testid="srr-missing-chip"
                          className={`${chip} border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300`}
                        >
                          <AlertCircle />
                          SRR Line belum terapply
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-xs">
                        SRR Line belum ditentukan di master data Asset Management untuk line/mesin bottleneck ini.
                        Dashboard hanya menampilkan IDW dan tab Reason belum dapat dipakai.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>

          {/* Summarization (CR 3), Pause Work Order (mock, TG-04) and Finish Work Order */}
          <div className="flex flex-wrap items-center gap-1">
            {viewingPast && (
              <span data-testid="past-shift-badge" className="mr-1 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                Shift selesai: tampilan read-only
              </span>
            )}
            {wo.status === "finished" && (
              <span data-testid="wo-finished-badge" className="mr-1 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                Work order finished
              </span>
            )}
            {wo.status === "paused" && (
              <span data-testid="wo-paused-badge" className="mr-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                Paused (tetap dihitung berjalan)
              </span>
            )}
            {!legacy && (
              <Link to="/operator/$plantId/$lineId/summarization" params={{ plantId, lineId }} data-testid="summarization-button" className={btn.outline}>
                <ClipboardList />
                Summarization
              </Link>
            )}
            {showPause && (
            <button
              type="button"
              data-testid="pause-wo"
              disabled={wo.status === "finished" || viewingPast}
              onClick={() => {
                if (wo.status === "paused") workOrderStore.resume(lineId, shiftKey);
                else setPauseModalOpen(true);
              }}
              className={btn.pause}
            >
              {wo.status === "paused" ? <PlayCircle /> : <PauseCircle />}
              {wo.status === "paused" ? "Resume Work Order" : "Pause Work Order"}
            </button>
            )}
            <button
              type="button"
              data-testid="finish-wo"
              disabled={wo.status === "finished" || viewingPast}
              onClick={() => {
                if (onBeforeFinishWorkOrder) onBeforeFinishWorkOrder(() => setFinishModalOpen(true));
                else setFinishModalOpen(true);
              }}
              className={btn.danger}
            >
              <CheckCircle2 />
              Finish Work Order
            </button>
          </div>
        </header>

        <hr className="my-3 border-0 border-t border-border" />

        {/* Tab switcher and LIST SHIFT */}
        <div className="flex min-h-[55px] flex-wrap items-end justify-between gap-x-10 gap-y-3">
          <nav aria-label="Halaman operator" className="inline-flex flex-wrap gap-1 rounded-xl bg-black/[0.06] dark:bg-white/10">
            <Link to="/operator/$plantId/$lineId" params={{ plantId, lineId }} className={tab(onDashboard)}>
              <LayoutGrid className="size-4" />
              Dashboard
            </Link>
            <Link to="/operator/$plantId/$lineId/reject" params={{ plantId, lineId }} className={tab(pathname.endsWith("/reject"))}>
              <XCircle className="size-4" />
              Reject
            </Link>
            {reasonBlocked ? (
              <button type="button" data-testid="reason-tab-blocked" onClick={() => srrBlockStore.open()} className={`${tab(false)} opacity-70`}>
                <ListFilter className="size-4" />
                Reason
              </button>
            ) : (
              <Link to="/operator/$plantId/$lineId/reason" params={{ plantId, lineId }} className={tab(pathname.endsWith("/reason"))}>
                <ListFilter className="size-4" />
                Reason
              </Link>
            )}
          </nav>
          <div className="flex w-full min-w-0 flex-wrap items-end justify-end gap-3 sm:w-auto" data-testid="header-right">
            {extra}
            <ShiftSelect {...(onBeforeShiftChange ? { onBeforeChange: onBeforeShiftChange } : {})} />
          </div>
        </div>
      </section>

      <FinishWorkOrderModal open={finishModalOpen} onOpenChange={setFinishModalOpen} onConfirm={() => workOrderStore.finish(lineId, shiftKey)} />
      <PauseWorkOrderModal open={pauseModalOpen} onOpenChange={setPauseModalOpen} onConfirm={() => workOrderStore.pause(lineId, shiftKey)} />
    </>
  );
}
