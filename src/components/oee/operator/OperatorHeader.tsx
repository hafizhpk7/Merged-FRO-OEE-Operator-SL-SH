import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Gauge,
  LayoutGrid,
  ListFilter,
  Menu,
  Moon,
  PauseCircle,
  PlayCircle,
  Sun,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinishWorkOrderModal } from "./FinishWorkOrderModal";
import { PauseWorkOrderModal } from "./PauseWorkOrderModal";
import { ShiftSelect } from "./ShiftSelect";
import { workOrderStore, useWorkOrder } from "@/lib/oee/workOrderStore";
import { useLineOperationalMode } from "@/lib/oee/assetMaster";
import { useViewShift } from "@/lib/oee/viewShiftStore";
import { useDashboardVersion } from "@/lib/oee/dashboardVersionStore";
import { operatorSidebarStore } from "@/lib/oee/operatorSidebarStore";
import { SRR_BLOCKED_TABS } from "@/lib/oee/config";
import { srrBlockStore } from "@/lib/oee/srrBlockStore";
import { useApp } from "@/lib/oee/app-context";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getLine } from "@/lib/oee/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getDemoClockOffsetMs, getNow, getShiftInfo, subscribeClock } from "@/lib/oee/shiftClock";

/** ISO week number of a date (the old UI shows "Week 46"). */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

const chip = "inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-0.5 text-xs font-bold";

export function OperatorHeader({
  plantId,
  lineId,
  onBeforeFinishWorkOrder,
  onBeforeShiftChange,
}: {
  plantId: string;
  lineId: string;
  onBeforeFinishWorkOrder?: (proceed: () => void) => void;
  onBeforeShiftChange?: (proceed: () => void) => void;
}) {
  const { isDarkMode, setIsDarkMode } = useApp();
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const shiftKey = getShiftInfo().shiftKey;
  const wo = useWorkOrder(lineId, shiftKey);
  const viewShift = useViewShift();
  const viewingPast = viewShift.isPast;
  const version = useDashboardVersion();
  const opMode = useLineOperationalMode(plantId, lineId);
  const srrMissing = opMode.reason === "srr-line-missing";
  const reasonBlocked = srrMissing && SRR_BLOCKED_TABS.includes("reason");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onDashboard = pathname === `/operator/${plantId}/${lineId}` || pathname === `/operator/${plantId}/${lineId}/`;
  const legacy = version === "old" && onDashboard;

  // Clock state
  const [currentTime, setCurrentTime] = useState("");
  const [week, setWeek] = useState(() => isoWeek(getNow()));
  const [demoOn, setDemoOn] = useState(() => getDemoClockOffsetMs() !== 0);
  useEffect(() => subscribeClock(() => setDemoOn(getDemoClockOffsetMs() !== 0)), []);

  useEffect(() => {
    const updateClock = () => {
      const now = getNow();
      const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour12: false });
      setCurrentTime(`${dateStr} - ${timeStr} WIB`);
      setWeek(isoWeek(now));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const zoneName = line?.zoneId ? `LIQUID ${line.zoneId}` : "LIQUID A";

  const tab = (active: boolean) =>
    `flex h-9 items-center gap-2 rounded-xl px-4 text-sm transition-colors ${
      active ? "bg-card font-semibold text-[var(--fro-info,#2563eb)] shadow-[var(--fro-shadow)]" : "font-medium text-muted-foreground hover:text-foreground"
    }`;

  return (
    <>
      <header className="flex flex-col gap-3" data-testid="operator-header">
        {/* Top bar: Week, date and time, theme, avatar */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs">
          <button
            type="button"
            data-testid="menu-button"
            aria-label="Menu"
            onClick={() => operatorSidebarStore.toggle()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground lg:hidden"
          >
            <Menu className="size-4" />
            Menu
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="rounded-full bg-[var(--fro-chip-blue-bg,#dbeafe)] px-3 py-1 text-xs font-bold text-[var(--fro-chip-blue-fg,#173da6)]" data-testid="week-chip">
              Week {week}
            </span>
            <span className="text-xs font-semibold text-muted-foreground" data-testid="clock-text">{currentTime}</span>
            <button
              type="button"
              aria-label={isDarkMode ? "Light mode" : "Dark mode"}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent"
            >
              {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="avatar-menu"
                  aria-label="User menu"
                  className={`flex size-9 items-center justify-center rounded-full bg-orange-200 text-xs font-medium uppercase text-[#92310a] outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    demoOn ? "ring-2 ring-red-500 ring-offset-1" : ""
                  }`}
                >
                  SA
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">
                  Super Admin
                  <span className="block text-[10px] font-normal text-muted-foreground">Prototype user</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onSelect={() => toast.info("Not part of this prototype")}>
                  Profil
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onSelect={() => toast.info("Not part of this prototype")}>
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Header card */}
        <div className="flex flex-col gap-4 rounded-md border border-border/60 bg-card p-4 shadow-xs sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-md bg-[var(--fro-chip-blue-bg,#dbeafe)] text-primary">
                  <Gauge className="size-4" />
                </span>
                <h1 className="text-sm font-bold uppercase tracking-[0.08em] text-foreground">Overall Equipment Effectiveness</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${chip} bg-[var(--fro-chip-blue-bg,#dbeafe)] text-[var(--fro-chip-blue-fg,#173da6)]`}>Liquid Plant</span>
                <span className={`${chip} bg-[var(--fro-chip-blue-bg,#dbeafe)] text-[var(--fro-chip-blue-fg,#173da6)]`}>{zoneName}</span>
                <span className={`${chip} bg-[var(--fro-chip-green-bg,#dcfce7)] text-[var(--fro-chip-green-fg,#116932)]`}>
                  <span className="size-2 rounded-full bg-emerald-500" />
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
                          <AlertCircle className="size-3" />
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

            {/* Summarization (CR 3), Pause Work Order (mock, TG-04) and Finish Work Order */}
            <div className="flex flex-wrap items-center gap-2">
              {viewingPast && (
                <span data-testid="past-shift-badge" className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  Shift selesai: tampilan read-only
                </span>
              )}
              {wo.status === "finished" && (
                <span data-testid="wo-finished-badge" className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  Work order finished
                </span>
              )}
              {wo.status === "paused" && (
                <span data-testid="wo-paused-badge" className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                  Paused (tetap dihitung berjalan)
                </span>
              )}
              {!legacy && (
                <Button variant="outline" asChild data-testid="summarization-button" className="h-8 gap-1.5 rounded-lg px-3 text-xs font-medium">
                  <Link to="/operator/$plantId/$lineId/summarization" params={{ plantId, lineId }}>
                    <ClipboardList className="size-4" />
                    Summarization
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                data-testid="pause-wo"
                disabled={wo.status === "finished" || viewingPast}
                onClick={() => {
                  if (wo.status === "paused") workOrderStore.resume(lineId, shiftKey);
                  else setPauseModalOpen(true);
                }}
                className="h-8 gap-1.5 rounded-lg border-[var(--fro-pause-border,#fef08a)] px-3 text-xs font-medium text-[var(--fro-pause-fg,#713f12)] hover:bg-amber-50"
              >
                {wo.status === "paused" ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
                {wo.status === "paused" ? "Resume Work Order" : "Pause Work Order"}
              </Button>
              <Button
                data-testid="finish-wo"
                disabled={wo.status === "finished" || viewingPast}
                onClick={() => {
                  if (onBeforeFinishWorkOrder) onBeforeFinishWorkOrder(() => setFinishModalOpen(true));
                  else setFinishModalOpen(true);
                }}
                className="h-8 gap-1.5 rounded-lg bg-[var(--fro-danger-btn,#e45b4a)] px-3 text-xs font-medium text-white hover:opacity-90"
              >
                <CheckCircle2 className="size-4" />
                Finish Work Order
              </Button>
            </div>
          </div>

          <div className="border-t border-border/60" />

          {/* Tab switcher and LIST SHIFT */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <nav aria-label="Halaman operator" className="inline-flex flex-wrap gap-1 rounded-xl bg-foreground/[0.06] p-0">
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
            <ShiftSelect {...(onBeforeShiftChange ? { onBeforeChange: onBeforeShiftChange } : {})} />
          </div>
        </div>
      </header>

      <FinishWorkOrderModal open={finishModalOpen} onOpenChange={setFinishModalOpen} onConfirm={() => workOrderStore.finish(lineId, shiftKey)} />
      <PauseWorkOrderModal open={pauseModalOpen} onOpenChange={setPauseModalOpen} onConfirm={() => workOrderStore.pause(lineId, shiftKey)} />
    </>
  );
}
