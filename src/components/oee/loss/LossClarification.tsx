import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Search,
  Wrench,
  Info,
  Package,
  Cpu,
} from "lucide-react";
import { type LossComponent, type LossParent } from "@/lib/oee/lossTree";
import { formatDuration, formatTimeWib, type ShiftInfo } from "@/lib/oee/shiftClock";
import {
  type EventType,
  type MachineEvent,
  type ProductionOrder,
  type ShiftSnapshot,
} from "@/lib/oee/machineEvents";
import { NOT_TAGGED_LABEL } from "@/lib/oee/plcAlarmMap";
import { selectMachineNotTaggedState } from "@/lib/oee/selectors";
import type { ResolvedPeriod } from "@/lib/oee/period";
import { cn } from "@/lib/utils";

export interface LossClarificationProps {
  shift: ShiftInfo;
  machineCode: string;
  orders: ProductionOrder[];
  events: MachineEvent[];
  snapshot: ShiftSnapshot;
  selectedEventId: string | null;
  onSelectEventId: (id: string | null) => void;
  selectedEventIds?: string[];
  onSelectEventIds?: (ids: string[]) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSaveSuccess?: () => void;
  resolved?: ResolvedPeriod;
  className?: string;
}

type TabKey = "not-tagged" | "tagged" | "all";

export function LossClarification({
  shift,
  machineCode,
  orders,
  events,
  snapshot,
  selectedEventId,
  onSelectEventId,
  isExpanded,
  onToggleExpand,
  className,
}: LossClarificationProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("not-tagged");
  const [typeFilter, setTypeFilter] = useState<"all" | EventType>("all");
  const [hideUnderOneMin, setHideUnderOneMin] = useState<boolean>(false);
  const [groupByPO, setGroupByPO] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Single source of truth selector for Not Tagged / Tagged counts
  const notTaggedState = useMemo(() => {
    return selectMachineNotTaggedState(events, snapshot.activeStop);
  }, [events, snapshot.activeStop]);

  const { notTaggedCount, taggedCount, allCount, notTaggedDurationSec } = notTaggedState;

  // Filtered event list
  const filteredEvents = useMemo(() => {
    return events
      .filter((e) => {
        // Exclude pure run events from loss list
        if (e.type === "run" || e.type === "negative_speed_loss") return false;

        // Tab filter: Not Tagged vs Tagged vs All
        if (activeTab === "not-tagged" && e.isTagged) return false;
        if (activeTab === "tagged" && !e.isTagged) return false;

        // Type filter
        if (typeFilter !== "all" && e.type !== typeFilter) return false;

        // Duration filter
        if (hideUnderOneMin && e.durationSec < 60) return false;

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchId = e.id.toLowerCase().includes(q);
          const matchAlarm = e.plcAlarm?.toLowerCase().includes(q);
          const matchCat = e.l2CategoryName?.toLowerCase().includes(q);
          const matchReason = e.l3ReasonName?.toLowerCase().includes(q);
          const matchSku = e.sku?.toLowerCase().includes(q);
          const matchOrder = e.orderId?.toLowerCase().includes(q);
          if (!matchId && !matchAlarm && !matchCat && !matchReason && !matchSku && !matchOrder) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => b.startSec - a.startSec);
  }, [events, activeTab, typeFilter, hideUnderOneMin, searchQuery]);

  // Selected event resolution
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Group events by PO if requested
  const eventsByPO = useMemo(() => {
    if (!groupByPO) return null;
    const map = new Map<string, MachineEvent[]>();
    for (const e of filteredEvents) {
      const list = map.get(e.orderId) || [];
      list.push(e);
      map.set(e.orderId, list);
    }
    return map;
  }, [filteredEvents, groupByPO]);

  return (
    <div
      className={cn("rounded-lg border border-border bg-card shadow-xs transition-all", className)}
    >
      {/* 1. Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4 border-b border-border/70">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-2 text-left cursor-pointer group"
            aria-expanded={isExpanded}
          >
            <div className="flex size-7 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground group-hover:bg-muted group-hover:text-foreground transition-colors">
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </div>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Loss Clarification
            </h3>
          </button>
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Read-only
          </span>
        </div>

        {/* Right side: N not tagged yet · total duration */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            <span
              className={cn(
                "font-mono font-bold",
                notTaggedCount > 0 ? "text-amber-500" : "text-tier-good",
              )}
            >
              {notTaggedCount}
            </span>{" "}
            not tagged yet ·{" "}
            <span className="font-mono font-medium">{formatDuration(notTaggedDurationSec)}</span>
          </span>
        </div>
      </div>

      {/* 2. Collapsible Body */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-3">
          {/* Controls: Tabs & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 pb-3">
            {/* Tabs: Not Tagged / Tagged / All */}
            <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("not-tagged")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors cursor-pointer",
                  activeTab === "not-tagged"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-metric="unclassified-tab-count"
                data-raw={notTaggedCount}
              >
                <span>Not Tagged</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                    notTaggedCount > 0
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {notTaggedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tagged")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors cursor-pointer",
                  activeTab === "tagged"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-metric="classified-tab-count"
                data-raw={taggedCount}
              >
                <span>Tagged</span>
                <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                  {taggedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors cursor-pointer",
                  activeTab === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-metric="all-tab-count"
                data-raw={allCount}
              >
                <span>All</span>
                <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                  {allCount}
                </span>
              </button>
            </div>

            {/* Filter pills: Type, Hide < 1 min, Group by PO, Search */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | EventType)}
                className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Types</option>
                <option value="downtime">Downtime</option>
                <option value="minor_stop">Minor Stop</option>
                <option value="speed_loss">Speed Loss</option>
                <option value="planned">Planned Stop</option>
              </select>

              {/* Hide < 1 min */}
              <label className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 h-8 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={hideUnderOneMin}
                  onChange={(e) => setHideUnderOneMin(e.target.checked)}
                  className="rounded border-border size-3.5 text-primary"
                />
                <span className="text-[11px]">Hide &lt; 1m</span>
              </label>

              {/* Group by PO */}
              <label className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 h-8 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={groupByPO}
                  onChange={(e) => setGroupByPO(e.target.checked)}
                  className="rounded border-border size-3.5 text-primary"
                />
                <span className="text-[11px]">Group by PO</span>
              </label>

              {/* Search box */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-32 sm:w-44 rounded-md border border-border bg-background pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Master-Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[380px]">
            {/* Left Column: Event List (7 cols) */}
            <div className="lg:col-span-7 flex flex-col border border-border/70 rounded-md bg-surface/50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/70 bg-muted/20 text-[11px] font-semibold text-muted-foreground flex justify-between items-center">
                <span>EVENTS ({filteredEvents.length})</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  Click a row to inspect classification
                </span>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[460px] p-2 space-y-1.5">
                {filteredEvents.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No loss events matching current filter criteria.
                  </div>
                ) : groupByPO && eventsByPO ? (
                  Array.from(eventsByPO.entries()).map(([poId, poEvs]) => (
                    <div key={poId} className="space-y-1">
                      <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold text-muted-foreground bg-muted/30 rounded">
                        <Package className="size-3 text-primary" />
                        <span>{poId}</span>
                        <span className="text-[10px] font-normal">({poEvs.length} events)</span>
                      </div>
                      <div className="space-y-1 pl-1">
                        {poEvs.map((ev) => (
                          <EventRow
                            key={ev.id}
                            event={ev}
                            isSelected={ev.id === selectedEventId}
                            onSelect={() =>
                              onSelectEventId(ev.id === selectedEventId ? null : ev.id)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  filteredEvents.map((ev) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      isSelected={ev.id === selectedEventId}
                      onSelect={() => onSelectEventId(ev.id === selectedEventId ? null : ev.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right Column: View-only Detail Pane (5 cols) */}
            <div className="lg:col-span-5 flex flex-col border border-border/70 rounded-md bg-surface/50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/70 bg-muted/20 text-[11px] font-semibold text-muted-foreground flex justify-between items-center">
                <span>LOSS CLASSIFICATION DETAIL</span>
                {selectedEvent && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {selectedEvent.id}
                  </span>
                )}
              </div>

              <div className="flex-1 p-3 overflow-y-auto">
                {!selectedEvent ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <Info className="size-8 text-muted-foreground/50 mb-2" />
                    <p className="text-xs font-medium text-foreground">No event selected</p>
                    <p className="text-[11px] mt-1 text-muted-foreground max-w-[220px]">
                      Select an event to view its loss classification
                    </p>
                  </div>
                ) : (
                  <EventDetailView event={selectedEvent} machineCode={machineCode} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({
  event,
  isSelected,
  onSelect,
}: {
  event: MachineEvent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isTagged = Boolean(
    event.isTagged && event.l2CategoryName && event.l2CategoryName !== NOT_TAGGED_LABEL,
  );

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-1 p-2 rounded-md border text-xs cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/5 shadow-xs"
          : "border-border/60 bg-background hover:bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Type Pill */}
          <span
            className={cn(
              "rounded px-1.5 py-0.2 font-mono text-[10px] font-bold uppercase",
              event.type === "downtime" && "bg-destructive/15 text-destructive",
              event.type === "minor_stop" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              event.type === "speed_loss" && "bg-blue-500/15 text-blue-500",
              event.type === "planned" && "bg-muted text-muted-foreground",
            )}
          >
            {event.type.replace("_", " ")}
          </span>

          {/* Time range */}
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatTimeWib(event.startSec)}–{formatTimeWib(event.endSec)}
          </span>

          {/* Fault / Alarm text */}
          {event.plcAlarm && (
            <span className="font-medium text-foreground truncate max-w-[140px] sm:max-w-[200px]">
              {event.plcAlarm}
            </span>
          )}
        </div>

        {/* Duration */}
        <span className="font-mono font-bold text-foreground shrink-0">
          {formatDuration(event.durationSec)}
        </span>
      </div>

      {/* Second Line: Tagged L2/L3 or Not Tagged Yet + Source Badge */}
      <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5">
        <div className="flex items-center gap-1.5 truncate">
          {isTagged ? (
            <span className="truncate text-foreground font-medium">
              {event.l2CategoryName} › {event.l3ReasonName}
            </span>
          ) : (
            <span className="rounded bg-muted/80 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground italic border border-border">
              {NOT_TAGGED_LABEL}
            </span>
          )}
        </div>

        {/* Source Badge */}
        <span
          className={cn(
            "rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold border shrink-0",
            event.source === "PLC"
              ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
              : "bg-muted text-muted-foreground border-border",
          )}
        >
          {event.source || "Non-PLC"}
        </span>
      </div>
    </div>
  );
}

function EventDetailView({ event, machineCode }: { event: MachineEvent; machineCode: string }) {
  const isTagged = Boolean(
    event.isTagged && event.l2CategoryName && event.l2CategoryName !== NOT_TAGGED_LABEL,
  );

  const l0 =
    event.l0Component ||
    event.causes?.[0]?.l0Component ||
    (event.type === "planned"
      ? "Loading"
      : event.type === "downtime"
        ? "Availability"
        : "Performance");

  const l1 =
    event.l1Parent ||
    event.causes?.[0]?.l1Parent ||
    (event.type === "planned"
      ? "Planned Downtime"
      : event.type === "downtime"
        ? "Breakdown"
        : event.type === "minor_stop"
          ? "Minor Stop"
          : "Speed Loss");

  const l2 = isTagged
    ? event.l2CategoryName || event.causes?.[0]?.l2CategoryName
    : NOT_TAGGED_LABEL;
  const l3 = isTagged ? event.l3ReasonName || event.causes?.[0]?.l3ReasonName : NOT_TAGGED_LABEL;

  return (
    <div className="space-y-3.5 text-xs">
      {/* 1. Header Information */}
      <div className="rounded-md border border-border bg-background p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">
            {event.type.replace("_", " ").toUpperCase()}
          </span>
          <span
            className={cn(
              "rounded px-2 py-0.5 font-mono text-[10px] font-bold border",
              event.source === "PLC"
                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                : "bg-muted text-muted-foreground border-border",
            )}
          >
            Source: {event.source || "Non-PLC"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div>
            <span className="text-muted-foreground">Duration:</span>{" "}
            <span className="font-mono font-bold text-foreground">
              {formatDuration(event.durationSec)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Time (WIB):</span>{" "}
            <span className="font-mono text-foreground">
              {formatTimeWib(event.startSec)} – {formatTimeWib(event.endSec)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Order:</span>{" "}
            <span className="font-mono text-foreground">{event.orderId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">SKU:</span>{" "}
            <span className="font-mono text-foreground truncate block">{event.sku}</span>
          </div>
        </div>
      </div>

      {/* 2. Taxonomy Hierarchy (L0 -> L1 -> L2 -> L3) */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Classification Hierarchy (Master v2)
        </label>
        <div className="rounded-md border border-border bg-background p-3 space-y-2">
          {/* L0 Component */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">L0 Component</span>
            <span className="rounded bg-muted/60 px-2 py-0.5 font-medium text-foreground text-[11px]">
              {l0}
            </span>
          </div>

          {/* L1 Parent */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">L1 Parent</span>
            <span className="rounded bg-muted/60 px-2 py-0.5 font-medium text-foreground text-[11px]">
              {l1}
            </span>
          </div>

          {/* L2 Category */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">L2 Category</span>
            <span
              className={cn(
                "rounded px-2 py-0.5 font-medium text-[11px]",
                isTagged
                  ? "bg-primary/10 text-primary font-semibold"
                  : "bg-muted text-muted-foreground italic",
              )}
            >
              {l2}
            </span>
          </div>

          {/* L3 Reason */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">L3 Reason</span>
            <span
              className={cn(
                "rounded px-2 py-0.5 font-medium text-[11px]",
                isTagged
                  ? "bg-primary/10 text-primary font-semibold"
                  : "bg-muted text-muted-foreground italic",
              )}
            >
              {l3}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Telemetry & Fault Attribution */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Telemetry & Attribution
        </label>
        <div className="rounded-md border border-border bg-background p-3 space-y-2 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">PLC Alarm Code / Text:</span>
            <span className="font-mono text-foreground font-medium">
              {event.plcAlarm || "None"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Attributed Machine:</span>
            <span className="font-mono text-foreground font-semibold">
              {event.causeMachineCode || machineCode}
            </span>
          </div>

          {event.note && (
            <div className="pt-1.5 border-t border-border/60">
              <span className="text-muted-foreground block mb-0.5">Note:</span>
              <p className="text-foreground bg-muted/40 p-2 rounded text-[11px] italic">
                {event.note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
