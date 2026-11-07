import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Clock,
  Gauge,
  HelpCircle,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Wrench,
} from "lucide-react";

import { MachineView3D } from "@/components/oee/three/machine-view-3d";
import { Delta, EmptyState, KpiCard, PageHeader, Panel } from "@/components/oee/ui";
import { selectStatus } from "@/lib/oee/selectors";
import { ActiveStopBanner } from "@/components/oee/loss/ActiveStopBanner";
import { LossStack } from "@/components/oee/loss/LossStack";
import { OperationalParametersTable } from "@/components/oee/loss/OperationalParametersTable";
import { MACHINE_OUTPUT_LABEL } from "@/lib/oee/config";
import { getLine, getMachine } from "@/lib/oee/data";
import { usePeriod } from "@/lib/oee/period";
import { getMetrics, useLiveTick } from "@/lib/oee/metrics-engine";
import {
  getShiftTimeline,
  useClassificationVersion,
  type ShiftSnapshot,
  type ShiftTimelineResult,
} from "@/lib/oee/machineEvents";
import {
  formatDuration,
  formatTimeWib,
  getPreviousShiftInfo,
  getShiftInfo,
  type ShiftInfo,
} from "@/lib/oee/shiftClock";
import { cn } from "@/lib/utils";

// Memoized 3D Machine Viewer to prevent Three.js scene remounting during 2s data ticks (§8)
const MemoizedMachineView3D = memo(MachineView3D);

export const Route = createFileRoute("/live/$plantId/$zoneId/$lineId/$machineId")({
  head: () => ({
    meta: [
      { title: "Machine Detail — Loss Clarification & Machine Events" },
      {
        name: "description",
        content:
          "Machine level digital twin with multi-tier Loss Clarification, 30s Machine Events timeline, operational parameters, and single-source-of-truth OEE.",
      },
      { property: "og:title", content: "Machine Detail — Loss Clarification" },
      {
        property: "og:description",
        content: "Complete L0-L3 loss taxonomy, shift timeline, and active stop resolution.",
      },
    ],
  }),
  component: MachineDetail,
});

function MachineDetail() {
  const { plantId, zoneId, lineId, machineId } = useParams({
    from: "/live/$plantId/$zoneId/$lineId/$machineId",
  });
  const navigate = useNavigate();

  const { resolved, setPeriodKey } = usePeriod();
  const tick = useLiveTick();
  const classVer = useClassificationVersion();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);

  const line = getLine(plantId, zoneId, lineId);
  const machine = getMachine(plantId, zoneId, lineId, machineId);

  const machineMetrics = useMemo(() => {
    void tick;
    return getMetrics(plantId, "machine", machineId, resolved);
  }, [plantId, machineId, resolved, tick]);

  // Determine active shift configuration based on period
  const shiftInfo = useMemo(() => {
    void tick;
    return getShiftInfo(new Date());
  }, [tick]);

  // Unified Shift Timeline (Single Source of Truth)
  const timeline: ShiftTimelineResult = useMemo(() => {
    void tick;
    void classVer;
    return getShiftTimeline(
      machineId,
      shiftInfo,
      shiftInfo.elapsedSec,
      plantId,
      resolved.periodKey,
    );
  }, [machineId, shiftInfo, tick, classVer, plantId, resolved.periodKey]);

  const { snapshot, orders, events, windows, idealRatePpm } = timeline;

  // Active current order
  const currentOrder = useMemo(() => {
    const elapsed = shiftInfo.elapsedSec;
    return (
      orders.find((o) => elapsed >= o.startSec && elapsed <= o.endSec) ||
      orders[0] || {
        id: "PO-2811",
        sku: "4000081204",
        productName: "Production Order",
      }
    );
  }, [orders, shiftInfo.elapsedSec]);

  // Reset selected event when machine code changes
  useEffect(() => {
    setSelectedEventId(null);
    setSelectedEventIds([]);
  }, [machineId]);

  if (!line || !machine) {
    return (
      <div className="p-6">
        <EmptyState message="Machine not found in plant directory" />
      </div>
    );
  }

  // Tone color and status single-source-of-truth for Status card, Twin badge and 3D scene (§2.3)
  const machineStatus = selectStatus(plantId, lineId, machine.id);
  const statusTone =
    machineStatus === "down"
      ? "bad"
      : machineStatus === "slow"
        ? "warn"
        : machineStatus === "running"
          ? "good"
          : "info";
  const statusLabel = machineStatus.toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      {/* ========================================================= */}
      {/* 3.1 HEADER: Back button, title, breadcrumbs, live clock with shift chip, Period selector */}
      {/* ========================================================= */}
      <PageHeader
        title={`${machine.id} — Machine Detail`}
        crumbs={[
          { label: `Zone ${zoneId}`, to: "/live/$plantId/$zoneId", params: { plantId, zoneId } },
          {
            label: lineId,
            to: "/live/$plantId/$zoneId/$lineId",
            params: { plantId, zoneId, lineId },
          },
          { label: machine.id },
        ]}
        meta={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-2.5 py-0.5 text-xs font-mono font-semibold text-foreground shadow-2xs">
              <span className="size-1.5 rounded-full bg-primary" />
              <span>{shiftInfo.label}</span>
            </span>
          </div>
        }
        back={{
          label: lineId,
          to: "/live/$plantId/$zoneId/$lineId",
          params: { plantId, zoneId, lineId },
        }}
      />

      <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 min-w-0 max-w-full overflow-x-hidden">
        {/* ========================================================= */}
        {/* DESKTOP TWO-COLUMN GRID (§3) */}
        {/* Left Column (28-30%, min 340px): 3D Machine Twin + MTTR/MTBF/Stops */}
        {/* Right Column (Rest): 6 KPI Strip + Active Stop Banner + Loss Stack */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start w-full">
          {/* ------------------------------------------------------- */}
          {/* LEFT COLUMN: MACHINE TWIN (3D) */}
          {/* ------------------------------------------------------- */}
          <div className="xl:col-span-4 flex flex-col h-full rounded-lg border border-border bg-surface shadow-xs overflow-hidden">
            {/* Panel Title & Current PO Header */}
            <div className="border-b border-border/80 px-4 py-3 bg-surface/90">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground">{machine.name}</h3>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  {machine.id}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono truncate mt-1">
                {currentOrder.id} · {currentOrder.sku} · {currentOrder.productName}
              </p>
            </div>

            {/* 3D Machine Viewer Wrapper (fills height, min 280px) */}
            <div className="relative w-full flex-1 min-h-[320px] sm:min-h-[360px] xl:min-h-[440px] bg-surface/30">
              <MemoizedMachineView3D
                machineCode={machine.id}
                machineName={machine.name}
                status={machineStatus}
                plantId={plantId}
                lineId={lineId}
                className="h-full w-full"
              />
            </div>

            {/* Under the viewer: Stops tile alone (§3.1, §3.2) */}
            <div className="border-t border-border p-3 space-y-2 text-[11px] bg-muted/20">
              <div
                className="rounded border border-border bg-surface px-3 py-2 flex items-center justify-between"
                title={`Count of downtime and minor stop events occurred during ${
                  resolved.periodKey === "this-shift"
                    ? "this shift"
                    : resolved.periodKey === "today"
                      ? "today"
                      : resolved.periodKey === "this-week"
                        ? "this week"
                        : resolved.periodKey === "this-month"
                          ? "this month"
                          : "custom range"
                }`}
              >
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-semibold">
                    {resolved.periodKey === "this-shift"
                      ? "Stops this shift"
                      : resolved.periodKey === "today"
                        ? "Stops today"
                        : resolved.periodKey === "this-week"
                          ? "Stops this week"
                          : resolved.periodKey === "this-month"
                            ? "Stops this month"
                            : "Stops (custom range)"}
                  </p>
                  <p className="font-mono font-bold text-base text-foreground mt-0.5">
                    {machineMetrics.stopsCount ?? snapshot.stopsThisShift}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground font-mono">
                  {resolved.periodKey === "this-shift" ? "live shift" : resolved.compareLabel}
                </span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- */}
          {/* RIGHT COLUMN: 6 KPI Strip + Banner + Loss Stack */}
          {/* ------------------------------------------------------- */}
          <div className="xl:col-span-8 flex flex-col gap-3 w-full">
            {/* 3.2 KPI STRIP (6 cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
              {/* Card 1: Machine OEE */}
              <KpiCard
                label="Machine OEE"
                value={machineMetrics.oee.toFixed(1)}
                unit="%"
                delta={machineMetrics.deltaOee}
                dataMetric={`machine-${machine.id}-oee`}
                dataRaw={machineMetrics.oee.toFixed(1)}
              />

              {/* Card 2: Availability */}
              <KpiCard
                label="Availability"
                value={machineMetrics.availability.toFixed(1)}
                unit="%"
                delta={machineMetrics.deltaAvailability}
              />

              {/* Card 3: Performance */}
              <KpiCard
                label="Performance"
                value={machineMetrics.performance.toFixed(1)}
                unit="%"
                delta={machineMetrics.deltaPerformance}
              />

              {/* Card 4: Quality */}
              <KpiCard
                label="Quality"
                value={machineMetrics.quality.toFixed(1)}
                unit="%"
                delta={machineMetrics.deltaQuality}
              />

              {/* Card 5: Machine Output (pcs) with sub-line Good X · Rejects Y */}
              <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-3 shadow-2xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {MACHINE_OUTPUT_LABEL}
                </p>
                <div className="my-1 flex items-baseline gap-1">
                  <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {snapshot.totalOutput.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">pcs</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  Good {snapshot.goodOutput.toLocaleString()} · Rej{" "}
                  <span className="font-semibold text-destructive">{snapshot.rejects}</span>
                </p>
              </div>

              {/* Card 6: Status Card with tone color & since duration */}
              <div
                className={cn(
                  "flex flex-col justify-between rounded-lg border p-3 shadow-2xs transition-colors",
                  statusTone === "bad" && "border-destructive/40 bg-destructive/10",
                  statusTone === "warn" && "border-amber-500/40 bg-amber-500/10",
                  statusTone === "good" && "border-tier-good/40 bg-tier-good/10",
                  statusTone === "info" && "border-border bg-surface",
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <div className="my-1">
                  <p
                    className={cn(
                      "font-bold text-base sm:text-lg tracking-tight",
                      statusTone === "bad" && "text-destructive font-extrabold",
                      statusTone === "warn" && "text-amber-600 dark:text-amber-400 font-extrabold",
                      statusTone === "good" && "text-tier-good",
                    )}
                  >
                    {statusLabel}
                  </p>
                </div>
                <p className="text-[10px] text-foreground/80 truncate">
                  {snapshot.status.detail} · {formatDuration(snapshot.status.sinceSec)}
                </p>
              </div>
            </div>

            {/* 3.4 ACTIVE STOP BANNER (only if not running) */}
            <ActiveStopBanner lineId={line.id} machineCode={machine.id} snapshot={snapshot} />

            {/* 3.5 & 3.8 LOSS STACK (Accordion between Loss Clarification & Machine Events) */}
            <LossStack
              shift={shiftInfo}
              machineCode={machine.id}
              idealRatePpm={idealRatePpm}
              orders={orders}
              events={events}
              windows={windows}
              snapshot={snapshot}
              selectedEventId={selectedEventId}
              onSelectEventId={setSelectedEventId}
              selectedEventIds={selectedEventIds}
              onSelectEventIds={setSelectedEventIds}
              isLivePeriod={resolved.periodKey === "this-shift"}
              resolved={resolved}
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3.9 OPERATIONAL PARAMETERS TABLE (full width bottom) */}
        {/* ========================================================= */}
        <div className="w-full mt-2">
          <OperationalParametersTable
            machineCode={machine.id}
            snapshot={snapshot}
            tickSec={tick * 2}
          />
        </div>
      </main>
    </div>
  );
}
