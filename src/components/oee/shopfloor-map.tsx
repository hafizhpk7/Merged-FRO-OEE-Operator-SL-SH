import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  Cpu,
  Layers,
  Maximize2,
  Sparkles,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";

import {
  MACHINE_OUTPUT_LABEL,
  STATUS_HEX,
  STATUS_LABEL,
  TIER_HEX,
  TIER_TEXT,
  tierOf,
  type Status,
} from "@/lib/oee/config";
import type { Line, Machine, Zone } from "@/lib/oee/data";
import { cn } from "@/lib/utils";

export interface ShopfloorMapProps {
  plantId: string;
  zones: Zone[];
  selectedZoneId?: string;
  onSelectZoneId?: (zoneId: string) => void;
  liveLineStatuses?: Record<string, Status>;
  liveMachineStatuses?: Record<string, Status>;
  activeLineId?: string;
  onSelectLine?: (line: Line) => void;
  className?: string;
  isCompact?: boolean;
}

export function ShopfloorMap({
  plantId,
  zones,
  selectedZoneId,
  onSelectZoneId,
  liveLineStatuses = {},
  liveMachineStatuses = {},
  activeLineId,
  onSelectLine,
  className,
  isCompact = false,
}: ShopfloorMapProps) {
  const navigate = useNavigate();
  const [activeTabZone, setActiveTabZone] = useState<string>(selectedZoneId ?? "all");
  const [hoveredMachineKey, setHoveredMachineKey] = useState<string | null>(null);

  // Sync activeTabZone if selectedZoneId changes
  React.useEffect(() => {
    if (selectedZoneId) {
      setActiveTabZone(selectedZoneId);
    }
  }, [selectedZoneId]);

  const zoneA = useMemo(() => zones.find((z) => z.id === "A"), [zones]);
  const zoneB = useMemo(() => zones.find((z) => z.id === "B"), [zones]);
  const zoneC = useMemo(() => zones.find((z) => z.id === "C"), [zones]);

  const visibleZones = useMemo(() => {
    if (activeTabZone === "all") return zones;
    return zones.filter((z) => z.id === activeTabZone);
  }, [zones, activeTabZone]);

  const getStatus = (line: Line): Status => liveLineStatuses[line.id] ?? line.status;

  const getMachineStatus = (line: Line, machine: Machine): Status =>
    liveMachineStatuses[`${line.id}:${machine.id}`] ?? machine.status;

  return (
    <div
      className={cn(
        "flex flex-col w-full h-full min-h-[500px] select-none rounded-lg bg-slate-950 text-slate-100 border border-slate-800 shadow-xl overflow-hidden",
        className,
      )}
    >
      {/* Blueprint Header & HUD Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/90 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-xs font-bold tracking-wider uppercase text-emerald-400">
              JATAKE 2 · SHOPFLOOR BLUEPRINT
            </span>
          </div>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline font-mono text-[11px] text-slate-400">
            Denah Industri Kosmetik PT Paragon Technology and Innovation
          </span>
        </div>

        {/* Zone Filter Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-md bg-slate-950/80 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTabZone("all");
              onSelectZoneId?.("all");
            }}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer",
              activeTabZone === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60",
            )}
          >
            All Zones (Full Blueprint)
          </button>
          {zones.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => {
                setActiveTabZone(z.id);
                onSelectZoneId?.(z.id);
              }}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer flex items-center gap-1.5",
                activeTabZone === z.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60",
              )}
            >
              <span>{z.name}</span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  z.lines.some((l) => getStatus(l) === "down")
                    ? "bg-red-400 animate-pulse"
                    : "bg-emerald-400",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Main Floor Blueprint Canvas Area */}
      <div className="relative flex-1 overflow-auto p-4 sm:p-6 bg-radial from-slate-900/60 via-slate-950 to-slate-950">
        {/* Architectural Blueprint Grid Background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #38bdf8 1px, transparent 1px),
              linear-gradient(to bottom, #38bdf8 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Blueprint North Compass Dial */}
        <div className="pointer-events-none absolute top-4 right-4 z-10 hidden sm:flex items-center gap-2 rounded border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px] font-mono text-slate-400 backdrop-blur">
          <Compass className="size-4 text-sky-400 rotate-90" />
          <span>NORTH (U) → EAST WALL</span>
        </div>

        {/* Content Container: Render Zones side-by-side matching the J2 layout */}
        <div className="relative z-10 flex flex-col xl:flex-row items-start gap-6 w-full min-w-0">
          {/* ZONE A: West Wing (Tube & Blister Lines) */}
          {(activeTabZone === "all" || activeTabZone === "A") && zoneA && (
            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur shadow-lg min-w-0 transition-all",
                activeTabZone === "all" ? "w-full xl:w-[38%]" : "w-full",
                activeTabZone === "A" && "ring-1 ring-primary/40",
              )}
            >
              {/* Zone A Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-blue-600 font-mono text-xs font-bold text-white shadow-sm">
                    A
                  </span>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100">
                      Zone A · Tube & Blister Packaging
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      15 Lines · West Packaging Sector (TUP01 - TUP14, BLP03)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/live/$plantId/$zoneId",
                      params: { plantId, zoneId: "A" },
                    })
                  }
                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium cursor-pointer"
                >
                  <span>Zone View</span>
                  <ChevronRight className="size-3" />
                </button>
              </div>

              {/* Spatial Layout matching Shopfloor J2 Plant Layout blueprint */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Column 1: Left Column (TUP05, TUP03, TUP04, TUP07, TUP10, TUP12, TUP02) */}
                <div className="flex flex-col gap-2.5">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pl-1">
                    Left Bay (Lines 05, 03, 04, 07, 10, 12, 02)
                  </div>
                  {["TUP05", "TUP03", "TUP04", "TUP07", "TUP10", "TUP12", "TUP02"].map((lineId) => {
                    const line = zoneA.lines.find((l) => l.id === lineId);
                    if (!line) return null;
                    return (
                      <LineCard
                        key={line.id}
                        plantId={plantId}
                        zoneId="A"
                        line={line}
                        status={getStatus(line)}
                        getMachineStatus={(m) => getMachineStatus(line, m)}
                        isActive={activeLineId === line.id}
                        onSelectLine={onSelectLine}
                        onHoverMachine={setHoveredMachineKey}
                      />
                    );
                  })}
                </div>

                {/* Column 2: Middle Column (BLP03, TUP11, TUP09, TUP06, TUP08, TUP14, TUP01) */}
                <div className="flex flex-col gap-2.5">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pl-1">
                    Mid Bay (BLP03, Lines 11, 09, 06, 08, 14, 01)
                  </div>
                  {["BLP03", "TUP11", "TUP09", "TUP06", "TUP08", "TUP14", "TUP01"].map((lineId) => {
                    const line = zoneA.lines.find((l) => l.id === lineId);
                    if (!line) return null;
                    return (
                      <LineCard
                        key={line.id}
                        plantId={plantId}
                        zoneId="A"
                        line={line}
                        status={getStatus(line)}
                        getMachineStatus={(m) => getMachineStatus(line, m)}
                        isActive={activeLineId === line.id}
                        onSelectLine={onSelectLine}
                        onHoverMachine={setHoveredMachineKey}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Bottom Row of Zone A: TUP13 running across to the right */}
              {(() => {
                const line13 = zoneA.lines.find((l) => l.id === "TUP13");
                if (!line13) return null;
                return (
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pl-1 pb-1">
                      South Cross Line (TUP13 · 4-Machine Train)
                    </div>
                    <LineCard
                      plantId={plantId}
                      zoneId="A"
                      line={line13}
                      status={getStatus(line13)}
                      getMachineStatus={(m) => getMachineStatus(line13, m)}
                      isActive={activeLineId === line13.id}
                      onSelectLine={onSelectLine}
                      onHoverMachine={setHoveredMachineKey}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* ZONE B: Center Sector (Bottle, Jar & Pouch Lines) */}
          {(activeTabZone === "all" || activeTabZone === "B") && zoneB && (
            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur shadow-lg min-w-0 transition-all",
                activeTabZone === "all" ? "w-full xl:w-[34%]" : "w-full",
                activeTabZone === "B" && "ring-1 ring-primary/40",
              )}
            >
              {/* Zone B Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-amber-600 font-mono text-xs font-bold text-white shadow-sm">
                    B
                  </span>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100">
                      Zone B · Bottle & Pouch Packaging
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      13 Lines · Central Closed System (BOP, JAP, POP)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/live/$plantId/$zoneId",
                      params: { plantId, zoneId: "B" },
                    })
                  }
                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium cursor-pointer"
                >
                  <span>Zone View</span>
                  <ChevronRight className="size-3" />
                </button>
              </div>

              {/* Spatial Layout of Zone B */}
              <div className="flex flex-col gap-3">
                {/* Upper North Stack (BOP02, BOP03, BOP04, BOP05) */}
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pl-1">
                    North Main (BOP02, BOP03, BOP04, BOP05)
                  </div>
                  {["BOP02", "BOP03", "BOP04", "BOP05"].map((lineId) => {
                    const line = zoneB.lines.find((l) => l.id === lineId);
                    if (!line) return null;
                    return (
                      <LineCard
                        key={line.id}
                        plantId={plantId}
                        zoneId="B"
                        line={line}
                        status={getStatus(line)}
                        getMachineStatus={(m) => getMachineStatus(line, m)}
                        isActive={activeLineId === line.id}
                        onSelectLine={onSelectLine}
                        onHoverMachine={setHoveredMachineKey}
                      />
                    );
                  })}
                </div>

                {/* Mid Corridor Lines (BOP14, BOP11, BOP12, POP01) */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pl-1">
                    Mid Corridor (BOP14, BOP11, BOP12, POP01)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {["BOP14", "BOP11", "BOP12", "POP01"].map((lineId) => {
                      const line = zoneB.lines.find((l) => l.id === lineId);
                      if (!line) return null;
                      return (
                        <LineCard
                          key={line.id}
                          plantId={plantId}
                          zoneId="B"
                          line={line}
                          status={getStatus(line)}
                          getMachineStatus={(m) => getMachineStatus(line, m)}
                          isActive={activeLineId === line.id}
                          onSelectLine={onSelectLine}
                          onHoverMachine={setHoveredMachineKey}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* South Area Lines (BOP13, BOP15, JAP04, BOP01, BOP16) */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pl-1">
                    South Bay (BOP13, BOP15, JAP04, BOP01, BOP16)
                  </div>
                  {["BOP13", "BOP15", "JAP04", "BOP01", "BOP16"].map((lineId) => {
                    const line = zoneB.lines.find((l) => l.id === lineId);
                    if (!line) return null;
                    return (
                      <LineCard
                        key={line.id}
                        plantId={plantId}
                        zoneId="B"
                        line={line}
                        status={getStatus(line)}
                        getMachineStatus={(m) => getMachineStatus(line, m)}
                        isActive={activeLineId === line.id}
                        onSelectLine={onSelectLine}
                        onHoverMachine={setHoveredMachineKey}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ZONE C: East Sector (Cup, Emulsion & Secondary Packing) */}
          {(activeTabZone === "all" || activeTabZone === "C") && zoneC && (
            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur shadow-lg min-w-0 transition-all",
                activeTabZone === "all" ? "w-full xl:w-[28%]" : "w-full",
                activeTabZone === "C" && "ring-1 ring-primary/40",
              )}
            >
              {/* Zone C Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-emerald-600 font-mono text-xs font-bold text-white shadow-sm">
                    C
                  </span>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100">
                      Zone C · Cup & Emulsion Packaging
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      12 Lines · East Packaging Wing (CUP, EMP, BOP06/09/10)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/live/$plantId/$zoneId",
                      params: { plantId, zoneId: "C" },
                    })
                  }
                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium cursor-pointer"
                >
                  <span>Zone View</span>
                  <ChevronRight className="size-3" />
                </button>
              </div>

              {/* Spatial Layout of Zone C */}
              <div className="flex flex-col gap-2.5">
                {/* Top North Line: CUP02 (5-Machine Train) */}
                {(() => {
                  const cup02 = zoneC.lines.find((l) => l.id === "CUP02");
                  if (!cup02) return null;
                  return (
                    <div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pl-1 pb-1">
                        North Wing Header (CUP02 · 5-Machine Train)
                      </div>
                      <LineCard
                        plantId={plantId}
                        zoneId="C"
                        line={cup02}
                        status={getStatus(cup02)}
                        getMachineStatus={(m) => getMachineStatus(cup02, m)}
                        isActive={activeLineId === cup02.id}
                        onSelectLine={onSelectLine}
                        onHoverMachine={setHoveredMachineKey}
                      />
                    </div>
                  );
                })()}

                {/* East Corridor Vertical Stack */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pl-1">
                    East Corridor Stack (BOP10 down to EMP17)
                  </div>
                  {[
                    "BOP10",
                    "JAP03",
                    "BOP09",
                    "EMP02",
                    "CUP01",
                    "EMP01",
                    "EMP03",
                    "EMP07",
                    "BOP06",
                    "EMP15",
                    "EMP17",
                  ].map((lineId) => {
                    const line = zoneC.lines.find((l) => l.id === lineId);
                    if (!line) return null;
                    return (
                      <LineCard
                        key={line.id}
                        plantId={plantId}
                        zoneId="C"
                        line={line}
                        status={getStatus(line)}
                        getMachineStatus={(m) => getMachineStatus(line, m)}
                        isActive={activeLineId === line.id}
                        onSelectLine={onSelectLine}
                        onHoverMachine={setHoveredMachineKey}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * LineCard: Renders the Line Container with its nested Machine chain and flow indicators
 */
interface LineCardProps {
  plantId: string;
  zoneId: string;
  line: Line;
  status: Status;
  getMachineStatus: (m: Machine) => Status;
  isActive?: boolean;
  onSelectLine?: (line: Line) => void;
  onHoverMachine?: (key: string | null) => void;
}

export function LineCard({
  plantId,
  zoneId,
  line,
  status,
  getMachineStatus,
  isActive = false,
  onSelectLine,
  onHoverMachine,
}: LineCardProps) {
  const navigate = useNavigate();

  const statusBorder =
    status === "down"
      ? "border-red-500/80 bg-red-950/20"
      : status === "slow"
        ? "border-amber-500/60 bg-amber-950/15"
        : status === "idle"
          ? "border-slate-700 bg-slate-900/60"
          : "border-slate-800 hover:border-slate-700 bg-slate-900/80";

  return (
    <div
      onClick={() => onSelectLine?.(line)}
      className={cn(
        "group relative flex flex-col rounded-lg border p-2.5 transition-all text-left shadow-md",
        statusBorder,
        isActive && "ring-2 ring-primary/80 shadow-primary/20",
      )}
    >
      {/* Line Container Header: Line ID + SKU + Live Status + OEE */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/live/$plantId/$zoneId/$lineId"
            params={{ plantId, zoneId, lineId: line.id }}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs font-bold text-white hover:text-primary transition-colors flex items-center gap-1"
          >
            <span>{line.id}</span>
            <ChevronRight className="size-3 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
          <span className="truncate text-[10px] text-slate-400 max-w-[130px] sm:max-w-[180px]">
            {line.sku}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight",
              status === "down"
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : status === "slow"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : status === "idle"
                    ? "bg-slate-700/40 text-slate-400"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
            )}
          >
            {STATUS_LABEL[status]}
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded font-mono text-[10px] font-bold",
              tierOf(line.oee) === "good"
                ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/60"
                : tierOf(line.oee) === "warn"
                  ? "bg-amber-950/70 text-amber-300 border border-amber-800/60"
                  : "bg-red-950/70 text-red-300 border border-red-800/60",
            )}
          >
            {line.oee.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Nested Machine Train: Render each specific Machine box with sequential flow arrows */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-0.5 scrollbar-thin">
        {line.machines.map((machine, idx) => {
          const mStatus = getMachineStatus(machine);
          const isDown = mStatus === "down";
          const isSlow = mStatus === "slow";
          const isLast = idx === line.machines.length - 1;

          return (
            <React.Fragment key={machine.id}>
              {/* Individual Machine Card */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate({
                    to: "/live/$plantId/$zoneId/$lineId/$machineId",
                    params: { plantId, zoneId, lineId: line.id, machineId: machine.id },
                  });
                }}
                onMouseEnter={() => onHoverMachine?.(`${line.id}:${machine.id}`)}
                onMouseLeave={() => onHoverMachine?.(null)}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded px-2 py-1.5 min-w-[62px] border transition-all cursor-pointer shadow-sm",
                  isDown
                    ? "bg-red-950/50 border-red-500/80 text-red-200 ring-1 ring-red-500/50 hover:bg-red-900/60"
                    : isSlow
                      ? "bg-amber-950/40 border-amber-500/70 text-amber-200 hover:bg-amber-900/50"
                      : mStatus === "idle"
                        ? "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                        : "bg-slate-950/90 border-slate-800 text-slate-200 hover:border-primary/60 hover:bg-slate-900",
                )}
                title={`${machine.name} (${machine.type}) · Status: ${STATUS_LABEL[mStatus]} · OEE: ${machine.oee.toFixed(1)}%`}
              >
                {/* Machine Code */}
                <span className="font-mono text-[11px] font-bold tracking-tight">
                  {machine.name}
                </span>

                {/* Machine Type Short Abbrev */}
                <span className="text-[9px] text-slate-400 truncate max-w-[56px] text-center leading-tight">
                  {machine.type.split(" ")[0]}
                </span>

                {/* Live Status Indicator Dot */}
                <span
                  className={cn(
                    "mt-1 size-1.5 rounded-full",
                    isDown
                      ? "bg-red-400 animate-ping"
                      : isSlow
                        ? "bg-amber-400"
                        : mStatus === "idle"
                          ? "bg-slate-500"
                          : "bg-emerald-400",
                  )}
                />
              </button>

              {/* Sequential Flow Indicator Arrow between machines */}
              {!isLast && (
                <div className="flex items-center justify-center shrink-0 text-slate-600">
                  <ArrowRight
                    className={cn(
                      "size-3 transition-colors",
                      status === "running" && "text-sky-500/70",
                      status === "down" && "text-red-500/50",
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Line Footer: Machine Output pace + Machine count */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
        <span
          className="font-mono truncate"
          title={`${MACHINE_OUTPUT_LABEL}: ${line.outputActual.toLocaleString()} / ${line.outputTarget.toLocaleString()}`}
        >
          <span className="hidden sm:inline">{MACHINE_OUTPUT_LABEL}: </span>
          <span className="sm:hidden">Out: </span>
          {line.outputActual.toLocaleString()} / {line.outputTarget.toLocaleString()}
        </span>
        <span className="text-slate-400 font-medium shrink-0 ml-1">
          {line.machines.length} {line.machines.length === 1 ? "unit" : "units"}
        </span>
      </div>
    </div>
  );
}
