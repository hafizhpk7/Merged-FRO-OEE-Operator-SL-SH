import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  HelpCircle,
  Package,
  TrendingDown,
  XCircle,
} from "lucide-react";
import {
  formatDuration,
  formatEventDuration,
  formatTimeWib,
  SHIFT_SECONDS,
  type ShiftInfo,
} from "@/lib/oee/shiftClock";
import {
  DOWNTIME_THRESHOLD_SEC,
  WINDOW_SEC,
  type MachineEvent,
  type ShiftSnapshot,
  type TimelineWindow,
} from "@/lib/oee/machineEvents";
import type { ResolvedPeriod } from "@/lib/oee/period";
import { MACHINE_OUTPUT_LABEL } from "@/lib/oee/config";
import { cn } from "@/lib/utils";

export interface MachineEventsProps {
  shift: ShiftInfo;
  machineCode: string;
  idealRatePpm: number;
  events: MachineEvent[];
  windows: TimelineWindow[];
  snapshot: ShiftSnapshot;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isLivePeriod?: boolean;
  resolved?: ResolvedPeriod;
  className?: string;
}

type RangeView = "full" | "last2h";

export function MachineEvents({
  shift,
  machineCode,
  idealRatePpm,
  events,
  windows,
  snapshot,
  selectedEventId,
  onSelectEvent,
  isExpanded,
  onToggleExpand,
  isLivePeriod = true,
  resolved,
  className,
}: MachineEventsProps) {
  const [rangeView, setRangeView] = useState<RangeView>("full");
  const [hoveredX, setHoveredX] = useState<number | null>(null);
  const [hoveredWindow, setHoveredWindow] = useState<TimelineWindow | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<MachineEvent | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(800);

  // 1. Real-time polling tick every 2 seconds when in LIVE mode
  const [nowTime, setNowTime] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!isLivePeriod) return;

    setNowTime(new Date());

    const interval = setInterval(() => {
      setNowTime(new Date());
    }, 2000);

    return () => clearInterval(interval);
  }, [isLivePeriod]);

  // Calculate current elapsed seconds in shift timezone
  const currentElapsedSec = useMemo(() => {
    if (!isLivePeriod) return shift.elapsedSec;
    const nowSec = Math.floor(nowTime.getTime() / 1000);
    const elapsed = nowSec - shift.startSec;
    return Math.min(SHIFT_SECONDS, Math.max(0, elapsed));
  }, [isLivePeriod, nowTime, shift.startSec, shift.elapsedSec]);

  // 2. Active Event Extension:
  // Automatically extend the current/latest machine event block to match current ticking time
  const extendedEvents = useMemo(() => {
    if (!isLivePeriod || events.length === 0) return events;

    const ongoingEvIdx = events.findIndex((e) => e.isOngoing);
    const targetIdx = ongoingEvIdx !== -1 ? ongoingEvIdx : events.length - 1;

    return events.map((ev, idx) => {
      if (idx === targetIdx || ev.isOngoing) {
        const newEnd = Math.max(ev.startSec + 1, currentElapsedSec);
        const newDur = Math.max(1, newEnd - ev.startSec);
        let newType = ev.type;
        if (newType === "minor_stop" && newDur > DOWNTIME_THRESHOLD_SEC) {
          newType = "downtime";
        }
        return {
          ...ev,
          endSec: newEnd,
          durationSec: newDur,
          type: newType,
          isOngoing: true,
        };
      }
      return ev;
    });
  }, [events, isLivePeriod, currentElapsedSec]);

  // 3. Extend Timeline Windows dynamically up to currentElapsedSec
  const extendedWindows = useMemo(() => {
    if (!isLivePeriod || windows.length === 0) return windows;

    const activeEv =
      extendedEvents.find((e) => e.isOngoing) || extendedEvents[extendedEvents.length - 1];
    const activeType = activeEv ? activeEv.type : "run";

    return windows.map((w) => {
      if (w.startSec < currentElapsedSec) {
        if (activeEv && w.startSec >= activeEv.startSec && w.startSec < currentElapsedSec) {
          let speedPpm = idealRatePpm;
          let output = (idealRatePpm * WINDOW_SEC) / 60;
          if (
            activeType === "downtime" ||
            activeType === "minor_stop" ||
            activeType === "planned"
          ) {
            speedPpm = 0;
            output = 0;
          } else if (activeType === "speed_loss") {
            const pct = activeEv.speedPct ?? 78;
            speedPpm = Math.round((idealRatePpm * pct) / 100);
            output = Math.round((output * pct) / 100);
          }

          const needsReason = activeType !== "run" && !activeEv.isTagged;

          return {
            ...w,
            type: activeType,
            speedPpm,
            output,
            eventId: activeEv.id,
            needsReason,
          };
        }
      }
      return w;
    });
  }, [windows, isLivePeriod, currentElapsedSec, extendedEvents, idealRatePpm]);

  // ResizeObserver for chart width
  useEffect(() => {
    if (!containerRef.current) return;
    let animFrame: number;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const w = entries[0].contentRect.width;
        if (w > 0) {
          animFrame = requestAnimationFrame(() => {
            setChartWidth(w);
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(animFrame);
      observer.disconnect();
    };
  }, [isExpanded]);

  // 4. Dynamic X-Axis domain boundaries:
  // Dynamically updates maximum time boundary on every tick so graph visually scrolls/ticks forward
  const timeRange = useMemo(() => {
    if (rangeView === "last2h") {
      const endSec = isLivePeriod ? currentElapsedSec : shift.elapsedSec;
      const startSec = Math.max(0, endSec - 7200); // 2 hours
      return { startSec, endSec, durationSec: 7200, bucketMinutes: 10 };
    }

    if (isLivePeriod) {
      // Dynamic boundary ticks forward with current time
      const endSec = Math.min(SHIFT_SECONDS, Math.max(1800, currentElapsedSec));
      return {
        startSec: 0,
        endSec,
        durationSec: endSec,
        bucketMinutes: endSec <= 7200 ? 5 : endSec <= 14400 ? 10 : 30,
      };
    }

    return {
      startSec: 0,
      endSec: SHIFT_SECONDS,
      durationSec: SHIFT_SECONDS,
      bucketMinutes: 30,
    };
  }, [rangeView, isLivePeriod, currentElapsedSec, shift.elapsedSec]);

  // Output buckets
  const buckets = useMemo(() => {
    const bucketCount = Math.max(
      1,
      Math.round(timeRange.durationSec / 60 / timeRange.bucketMinutes),
    );
    const bucketSec = timeRange.bucketMinutes * 60;
    const list: {
      index: number;
      label: string;
      startSec: number;
      endSec: number;
      output: number;
      target: number;
      isFuture: boolean;
      isCurrent: boolean;
    }[] = [];

    for (let b = 0; b < bucketCount; b++) {
      const bStart = timeRange.startSec + b * bucketSec;
      const bEnd = bStart + bucketSec;
      const isFuture = bStart >= currentElapsedSec;
      const isCurrent = currentElapsedSec >= bStart && currentElapsedSec < bEnd;

      const bWindows = extendedWindows.filter((w) => w.startSec >= bStart && w.endSec <= bEnd);
      const output = bWindows.reduce((sum, w) => sum + w.output, 0);
      const target = idealRatePpm * timeRange.bucketMinutes;

      const hourWib = formatTimeWib(shift.startSec + bStart, false);
      list.push({
        index: b,
        label: hourWib,
        startSec: bStart,
        endSec: bEnd,
        output,
        target,
        isFuture,
        isCurrent,
      });
    }
    return list;
  }, [timeRange, extendedWindows, idealRatePpm, shift, currentElapsedSec]);

  // Height allocations for SVG rows
  const chartHeight = 220;
  const paddingLeft = 46;
  const paddingRight = 16;
  const usableWidth = Math.max(100, chartWidth - paddingLeft - paddingRight);

  // Row Y boundaries
  const speedRowY = 32;
  const speedRowHeight = 110;
  const lossRowY = 152;
  const lossRowHeight = 32;
  const xAxisY = 196;

  // Max Speed scale
  const maxSpeedY = idealRatePpm * 1.35;

  // Speed line path calculation
  const speedPoints = useMemo(() => {
    const visibleWindows = extendedWindows.filter(
      (w) => w.startSec >= timeRange.startSec && w.endSec <= timeRange.endSec,
    );
    if (visibleWindows.length === 0) return { path: "", area: "" };

    const pts: { x: number; y: number; isFuture: boolean }[] = [];
    visibleWindows.forEach((w) => {
      const tNorm = (w.startSec + 15 - timeRange.startSec) / timeRange.durationSec;
      const x = paddingLeft + tNorm * usableWidth;
      const isFuture = w.startSec >= currentElapsedSec;
      const val = isFuture ? 0 : w.speedPpm;
      const yNorm = Math.min(1, Math.max(0, val / maxSpeedY));
      const y = speedRowY + speedRowHeight - yNorm * speedRowHeight;
      pts.push({ x, y, isFuture });
    });

    const activePts = pts.filter((p) => !p.isFuture);
    if (activePts.length === 0) return { path: "", area: "" };

    const linePath = activePts.reduce(
      (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      "",
    );

    const first = activePts[0];
    const last = activePts[activePts.length - 1];
    const baseLineY = speedRowY + speedRowHeight;
    const areaPath = `${linePath} L ${last.x} ${baseLineY} L ${first.x} ${baseLineY} Z`;

    return { path: linePath, area: areaPath };
  }, [extendedWindows, timeRange, currentElapsedSec, paddingLeft, usableWidth, maxSpeedY]);

  // Standard rate line Y
  const stdLineY = speedRowY + speedRowHeight - (idealRatePpm / maxSpeedY) * speedRowHeight;

  // Now Marker X position
  const nowNorm = (currentElapsedSec - timeRange.startSec) / timeRange.durationSec;
  const nowX = nowNorm >= 0 && nowNorm <= 1 ? paddingLeft + nowNorm * usableWidth : null;

  // Mouse move over SVG chart
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    if (clientX < paddingLeft || clientX > paddingLeft + usableWidth) {
      setHoveredX(null);
      setHoveredWindow(null);
      setHoveredEvent(null);
      return;
    }

    const tNorm = (clientX - paddingLeft) / usableWidth;
    const hoveredSec = timeRange.startSec + tNorm * timeRange.durationSec;
    setHoveredX(clientX);

    const win = extendedWindows.find((w) => hoveredSec >= w.startSec && hoveredSec < w.endSec);
    setHoveredWindow(win || null);

    const ev = extendedEvents.find(
      (e) => hoveredSec >= e.startSec && hoveredSec < (e.isOngoing ? currentElapsedSec : e.endSec),
    );
    setHoveredEvent(ev || null);
  };

  const handleMouseLeave = () => {
    setHoveredX(null);
    setHoveredWindow(null);
    setHoveredEvent(null);
  };

  // Click segment to clarify loss
  const handleChartClick = () => {
    if (hoveredEvent && hoveredEvent.type !== "run") {
      onSelectEvent(hoveredEvent.id);
    }
  };

  // Active event duration for header
  const activeEv =
    extendedEvents.find((e) => e.isOngoing) || extendedEvents[extendedEvents.length - 1];
  const activeEvDurationSec = activeEv ? currentElapsedSec - activeEv.startSec : 0;

  // -------------------------------------------------------------
  // RENDER: COLLAPSED STRIP VIEW
  // -------------------------------------------------------------
  if (!isExpanded) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-border/80 bg-surface/95 px-4 py-3 shadow-xs backdrop-blur-md transition-all hover:border-border cursor-pointer select-none",
          className,
        )}
        onClick={onToggleExpand}
      >
        {/* Header KPI Row remains visible in collapsed state */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-foreground">Machine Events</h3>
            {isLivePeriod && (
              <span className="inline-flex items-center gap-1 rounded-full bg-tier-good/20 text-tier-good px-2 py-0.5 text-[10px] font-bold">
                <span className="size-1.5 rounded-full bg-tier-good animate-pulse" />
                <span>LIVE</span>
              </span>
            )}
          </div>

          {/* Key Quick KPIs */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Status: </span>
              <span
                className={cn(
                  "font-bold",
                  snapshot.status.tone === "bad" && "text-destructive",
                  snapshot.status.tone === "warn" && "text-amber-500",
                  snapshot.status.tone === "good" && "text-tier-good",
                )}
              >
                {snapshot.status.label}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Loss: </span>
              <span className="font-mono font-bold">{snapshot.totalLossMin}m</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">
                {MACHINE_OUTPUT_LABEL}:{" "}
              </span>
              <span className="font-mono font-bold">
                {snapshot.totalOutput.toLocaleString()} pcs
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">NOT TAGGED: </span>
              <span
                className={cn(
                  "font-mono font-bold",
                  snapshot.notTaggedCount > 0 ? "text-amber-500" : "text-tier-good",
                )}
                data-metric="unclassified-count"
                data-raw={snapshot.notTaggedCount}
              >
                {snapshot.notTaggedCount}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Expand Machine Events"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        {/* Collapsed Thin Timeline Ribbon */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground mt-1">
          <span>{formatTimeWib(shift.startSec, false)}</span>
          <div className="relative h-2.5 flex-1 rounded-full overflow-hidden bg-muted/60 flex">
            {extendedWindows.map((w, idx) => {
              if (idx % 4 !== 0) return null; // subsample for thin bar
              const isFuture = w.startSec >= currentElapsedSec;
              return (
                <div
                  key={w.index}
                  className={cn(
                    "h-full flex-1",
                    isFuture && "bg-muted/40",
                    !isFuture && w.type === "run" && "bg-[var(--loss-run)]",
                    !isFuture && w.type === "speed_loss" && "bg-[var(--loss-speed)]",
                    !isFuture && w.type === "minor_stop" && "bg-[var(--loss-minor)]",
                    !isFuture && w.type === "downtime" && "bg-[var(--loss-down)]",
                    !isFuture && w.type === "planned" && "bg-[var(--loss-planned)]",
                  )}
                />
              );
            })}
            {/* Live now marker tick */}
            {nowNorm !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-tier-good z-10"
                style={{ left: `${Math.min(100, Math.max(0, nowNorm * 100))}%` }}
              />
            )}
          </div>
          <span>{formatTimeWib(shift.endSec, false)}</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: EXPANDED FULL VIEW
  // -------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-lg border border-border bg-surface shadow-xs overflow-hidden transition-all",
        className,
      )}
    >
      {/* Header Row with full KPIs & Collapse */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3
            className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5"
            onClick={onToggleExpand}
          >
            <span>Machine Events</span>
          </h3>
          {isLivePeriod && (
            <span className="inline-flex items-center gap-1 rounded-full bg-tier-good/20 text-tier-good px-2 py-0.5 text-[10px] font-bold">
              <span className="size-1.5 rounded-full bg-tier-good animate-pulse" />
              <span>LIVE</span>
            </span>
          )}
        </div>

        {/* Header KPI Metrics */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground">Current: </span>
            <span
              className={cn(
                "font-bold",
                snapshot.status.tone === "bad" && "text-destructive",
                snapshot.status.tone === "warn" && "text-amber-500",
                snapshot.status.tone === "good" && "text-tier-good",
              )}
            >
              {snapshot.status.label}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono ml-1">
              ({formatDuration(activeEvDurationSec)})
            </span>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground">Total loss: </span>
            <span className="font-mono font-bold text-destructive">
              {snapshot.totalLossMin} min
            </span>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground">Speed · std {idealRatePpm}: </span>
            <span className="font-mono font-bold text-foreground">
              {snapshot.status.state === "down" ? 0 : idealRatePpm} ppm
            </span>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground">
              {MACHINE_OUTPUT_LABEL} · {snapshot.outputVsPlanPct}% of plan:{" "}
            </span>
            <span className="font-mono font-bold text-foreground">
              {snapshot.totalOutput.toLocaleString()} pcs
            </span>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground">
              Rejects · {snapshot.rejectRatePct}%:{" "}
            </span>
            <span className="font-mono font-bold text-foreground">{snapshot.rejects} pcs</span>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground">NOT TAGGED: </span>
            <span
              className={cn(
                "font-mono font-bold",
                snapshot.notTaggedCount > 0 ? "text-amber-500" : "text-tier-good",
              )}
              data-metric="unclassified-count"
              data-raw={snapshot.notTaggedCount}
            >
              {snapshot.notTaggedCount} losses
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleExpand}
            className="flex size-7 items-center justify-center rounded-md border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Collapse panel"
          >
            <ChevronUp className="size-4" />
          </button>
        </div>
      </div>

      {/* Toolbar: Range toggle, Legend, Shift label */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/50 px-4 py-2 text-xs">
        {/* Segmented Control: Full shift | Last 2 h */}
        <div className="flex items-center rounded border border-border bg-background p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setRangeView("full")}
            className={cn(
              "rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer",
              rangeView === "full"
                ? "bg-surface font-bold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Full shift
          </button>
          <button
            type="button"
            onClick={() => setRangeView("last2h")}
            className={cn(
              "rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer",
              rangeView === "last2h"
                ? "bg-surface font-bold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Last 2 h
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground select-none">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[var(--loss-run)]" />
            <span>Effective</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[var(--loss-speed)]" />
            <span>Speed loss</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[var(--loss-minor)]" />
            <span>Minor stop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[var(--loss-down)]" />
            <span>Downtime</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[var(--loss-planned)]" />
            <span>Planned stop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-amber-500 hatch-needs-reason border border-border" />
            <span>Not Tagged Yet</span>
          </div>
        </div>

        {/* Shift chip */}
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
          {shift.label}
        </span>
      </div>

      {/* SVG Chart Container */}
      <div className="relative w-full overflow-x-auto p-2 bg-surface">
        <div className="min-w-[640px] relative">
          <svg
            width={chartWidth}
            height={chartHeight}
            className="w-full select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleChartClick}
          >
            <defs>
              {/* Not Tagged diagonal hatch pattern */}
              <pattern
                id="eventHatch"
                width="8"
                height="8"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />
              </pattern>
            </defs>

            {/* Row 1 Label: Machine Output */}
            <text x={10} y={16} className="fill-muted-foreground text-[10px] font-bold uppercase">
              {MACHINE_OUTPUT_LABEL}
            </text>

            {/* Row 2 Label: Speed ppm */}
            <text x={10} y={speedRowY + 14} className="fill-muted-foreground text-[10px] font-bold">
              Speed
            </text>
            <text
              x={10}
              y={speedRowY + 26}
              className="fill-muted-foreground/70 text-[8px] font-mono"
            >
              ppm
            </text>

            {/* Row 3 Label: Loss type */}
            <text x={10} y={lossRowY + 20} className="fill-muted-foreground text-[10px] font-bold">
              Loss
            </text>

            {/* 1. Output Row Bucket Numbers */}
            {buckets.map((b) => {
              const bWidth = usableWidth / buckets.length;
              const x = paddingLeft + b.index * bWidth;
              const ratio = b.output / (b.target || 1);
              let textColor = "fill-muted-foreground";
              if (!b.isFuture && !b.isCurrent) {
                if (ratio >= 0.9) textColor = "fill-tier-good font-bold";
                else if (ratio >= 0.6) textColor = "fill-amber-500 font-bold";
                else textColor = "fill-destructive font-bold";
              }

              return (
                <g key={b.index}>
                  {/* Bucket vertical grid line */}
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={xAxisY}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.4"
                  />
                  {/* Production value text */}
                  <text
                    x={x + bWidth / 2}
                    y={16}
                    textAnchor="middle"
                    className={cn("text-[10px] font-mono", textColor)}
                  >
                    {b.isFuture ? "-" : b.output.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* 2. Speed Row: Background Grid & Dashed Std Reference Line */}
            <line
              x1={paddingLeft}
              y1={stdLineY}
              x2={paddingLeft + usableWidth}
              y2={stdLineY}
              stroke="var(--color-primary)"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.6"
            />
            <text
              x={paddingLeft + 4}
              y={stdLineY - 4}
              className="fill-primary text-[9px] font-mono font-semibold"
            >
              Std {idealRatePpm}
            </text>

            {/* Speed Area & Line */}
            {speedPoints.area && (
              <path d={speedPoints.area} fill="var(--color-primary)" fillOpacity="0.12" />
            )}
            {speedPoints.path && (
              <path
                d={speedPoints.path}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="1.8"
              />
            )}

            {/* 3. Loss Type Band: Colored segments with hatch on needs-reason */}
            {extendedWindows
              .filter((w) => w.startSec >= timeRange.startSec && w.endSec <= timeRange.endSec)
              .map((w) => {
                const wWidth = (WINDOW_SEC / timeRange.durationSec) * usableWidth;
                const x =
                  paddingLeft +
                  ((w.startSec - timeRange.startSec) / timeRange.durationSec) * usableWidth;
                const isFuture = w.startSec >= currentElapsedSec;
                const isSelected = w.eventId && w.eventId === selectedEventId;

                let fill = "var(--loss-run)";
                if (isFuture) fill = "var(--color-muted)";
                else if (w.type === "speed_loss") fill = "var(--loss-speed)";
                else if (w.type === "minor_stop") fill = "var(--loss-minor)";
                else if (w.type === "downtime") fill = "var(--loss-down)";
                else if (w.type === "planned") fill = "var(--loss-planned)";

                return (
                  <g key={w.index}>
                    <rect
                      x={x}
                      y={lossRowY}
                      width={Math.max(0.5, wWidth)}
                      height={lossRowHeight}
                      fill={fill}
                      className={cn(w.type !== "run" && "cursor-pointer")}
                    />
                    {/* Needs reason hatch overlay */}
                    {!isFuture && w.needsReason && (
                      <rect
                        x={x}
                        y={lossRowY}
                        width={Math.max(0.5, wWidth)}
                        height={lossRowHeight}
                        fill="url(#eventHatch)"
                        className="cursor-pointer"
                      />
                    )}
                    {/* Selected event outline highlight */}
                    {isSelected && (
                      <rect
                        x={x}
                        y={lossRowY - 1}
                        width={Math.max(1, wWidth)}
                        height={lossRowHeight + 2}
                        fill="none"
                        stroke="var(--color-foreground)"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                );
              })}

            {/* 4. X-Axis Time Ticks */}
            <line
              x1={paddingLeft}
              y1={xAxisY}
              x2={paddingLeft + usableWidth}
              y2={xAxisY}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            {buckets.map((b) => {
              const bWidth = usableWidth / buckets.length;
              const x = paddingLeft + b.index * bWidth;
              return (
                <g key={b.index}>
                  <line
                    x1={x}
                    y1={xAxisY}
                    x2={x}
                    y2={xAxisY + 4}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={xAxisY + 14}
                    textAnchor="start"
                    className="fill-muted-foreground text-[9px] font-mono"
                  >
                    {b.label}
                  </text>
                </g>
              );
            })}

            {/* 5. Green Live NOW Marker with Time Pill */}
            {isLivePeriod && nowX !== null && (
              <g>
                <line
                  x1={nowX}
                  y1={0}
                  x2={nowX}
                  y2={xAxisY + 6}
                  stroke="var(--color-tier-good)"
                  strokeWidth="1.8"
                />
                <rect
                  x={nowX - 22}
                  y={xAxisY - 2}
                  width="44"
                  height="16"
                  rx="3"
                  className="fill-tier-good"
                />
                <text
                  x={nowX}
                  y={xAxisY + 9}
                  textAnchor="middle"
                  className="fill-white font-mono text-[9px] font-bold"
                >
                  {formatTimeWib(shift.startSec + currentElapsedSec, true)}
                </text>
              </g>
            )}

            {/* 6. Hover Vertical Crosshair */}
            {hoveredX !== null && (
              <line
                x1={hoveredX}
                y1={0}
                x2={hoveredX}
                y2={xAxisY}
                stroke="var(--color-foreground)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
            )}
          </svg>

          {/* Interactive Hover Tooltip */}
          {hoveredX !== null && hoveredWindow && (
            <div
              className="absolute pointer-events-none z-30 rounded-md border border-border bg-surface/95 p-2 shadow-lg backdrop-blur-md text-xs transition-all max-w-[240px]"
              style={{
                left: `${Math.min(
                  usableWidth + paddingLeft - 220,
                  Math.max(paddingLeft + 10, hoveredX + 12),
                )}px`,
                top: "30px",
              }}
            >
              <p className="font-mono font-bold text-foreground">
                {formatTimeWib(shift.startSec + hoveredWindow.startSec, true)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                <Gauge className="size-3 text-primary" />
                <span className="font-mono font-bold">{hoveredWindow.speedPpm} ppm</span>
                <span className="text-muted-foreground">({hoveredWindow.output} pcs / 30s)</span>
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-border/60">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      hoveredWindow.type === "run" && "bg-[var(--loss-run)]",
                      hoveredWindow.type === "speed_loss" && "bg-[var(--loss-speed)]",
                      hoveredWindow.type === "minor_stop" && "bg-[var(--loss-minor)]",
                      hoveredWindow.type === "downtime" && "bg-[var(--loss-down)]",
                      hoveredWindow.type === "planned" && "bg-[var(--loss-planned)]",
                    )}
                  />
                  <span className="font-bold text-[11px] text-foreground">
                    {hoveredWindow.type === "run"
                      ? "Effective Run"
                      : hoveredWindow.type === "speed_loss"
                        ? "Speed Loss"
                        : hoveredWindow.type === "minor_stop"
                          ? "Minor Stop"
                          : hoveredWindow.type === "downtime"
                            ? "Downtime Breakdown"
                            : "Planned Stop"}
                  </span>
                </div>

                {hoveredEvent && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {hoveredEvent.causes.length > 0
                      ? hoveredEvent.causes[0].l3ReasonName
                      : hoveredEvent.isOngoing
                        ? "Ongoing, awaiting reason"
                        : "Needs a reason"}
                  </p>
                )}

                {hoveredWindow.type !== "run" && (
                  <p className="text-[10px] font-bold text-primary mt-1.5">
                    Click to clarify this loss
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
