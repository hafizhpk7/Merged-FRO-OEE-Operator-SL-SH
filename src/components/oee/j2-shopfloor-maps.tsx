import { useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  STATUS_DOT,
  STATUS_HEX,
  STATUS_LABEL,
  TIER_HEX,
  TIER_TEXT,
  tierOf,
  type Status,
} from "@/lib/oee/config";
import type { Line, Machine, Plant, Zone } from "@/lib/oee/data";
import {
  getBottleneck,
  getActivePO,
  getMetrics,
  PO_IDLE_PLACEHOLDER,
} from "@/lib/oee/metrics-engine";
import { LineDataSourceChip } from "@/components/oee/ui";
import { usePeriod } from "@/lib/oee/period";
import {
  CAMERA_FIT_MARGIN_PERCENT,
  DEFAULT_ELEVATION_DEG,
  J2_LINES_CONFIG,
  J2_ZONE_FOOTPRINTS,
  MACHINE_GAP,
  PLANT_BLOCK_SIZE,
  PLANT_MACHINE_GAP,
  ZONE_BLOCK_SIZE,
  type J2LineConfig,
} from "@/lib/oee/j2-layout-config";
import { MODEL_REGISTRY, resolveModelKey } from "@/lib/oee/models";
import { cn } from "@/lib/utils";
import { MapStatusLegendOverlay, ZoomableMap } from "./iso";
import { Bop15ChainSprite } from "./bop15-chain-sprite";

// Global constant to toggle subtle process flow direction arrows/chevrons
export const SHOW_FLOW_CHEVRONS = true;

// Isometric scale constants
const PLANT_ISO_SCALE = 16.0;
const ZONE_ISO_SCALE = 22.0;

export type ViewMode = "3d" | "2d";

export type MachineHoverData = {
  lineCode: string;
  machineCode: string;
  machineName: string;
  zoneId: string;
  zoneName: string;
  lineOee: number;
  machineOee: number;
  machineStatus: Status;
  clientX: number;
  clientY: number;
};

/**
 * High-precision isometric projection with integer pixel output to prevent sub-pixel jitter
 */
export function projectIso(
  x: number,
  y: number,
  h: number,
  scale: number,
  elevationDeg: number = DEFAULT_ELEVATION_DEG,
) {
  const cos30 = 0.8660254;
  const sinFactor = Math.sin((elevationDeg * Math.PI) / 180) * 0.72;
  return {
    x: Math.round((x - y) * scale * cos30),
    y: Math.round((x + y) * scale * sinFactor - h),
  };
}

/**
 * Stable 3D Isometric Extruded Block Component
 * Hover styles strictly modify color/brightness/stroke — NEVER scale, size, or position.
 */
const J2IsoBlock = React.memo(function J2IsoBlock({
  x,
  y,
  w = 0.8,
  d = 0.65,
  h = 14,
  scale = 22,
  elevationDeg = DEFAULT_ELEVATION_DEG,
  color,
  hovered,
  dim,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  x: number;
  y: number;
  w?: number;
  d?: number;
  h?: number;
  scale?: number;
  elevationDeg?: number;
  color: string;
  hovered?: boolean;
  dim?: boolean;
  onClick?: () => void;
  onMouseEnter?: (e: React.MouseEvent<SVGGElement>) => void;
  onMouseLeave?: () => void;
}) {
  const t1 = projectIso(x, y, h, scale, elevationDeg);
  const t2 = projectIso(x + w, y, h, scale, elevationDeg);
  const t3 = projectIso(x + w, y + d, h, scale, elevationDeg);
  const t4 = projectIso(x, y + d, h, scale, elevationDeg);
  const b4 = projectIso(x, y + d, 0, scale, elevationDeg);
  const b3 = projectIso(x + w, y + d, 0, scale, elevationDeg);
  const b2 = projectIso(x + w, y, 0, scale, elevationDeg);

  const pts = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(" ");

  return (
    <g
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="cursor-pointer select-none"
      opacity={dim ? 0.35 : 1}
      style={{
        filter: hovered ? "brightness(1.2)" : undefined,
      }}
    >
      {/* Top Face */}
      <polygon
        points={pts([t1, t2, t3, t4])}
        fill={color}
        stroke={hovered ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.15)"}
        strokeWidth={hovered ? 1.5 : 0.5}
      />
      {/* Front-Left Face */}
      <polygon
        points={pts([t4, t3, b3, b4])}
        fill={color}
        style={{ filter: "brightness(0.78)" }}
        stroke={hovered ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.25)"}
        strokeWidth={hovered ? 1.2 : 0.5}
      />
      {/* Front-Right Face */}
      <polygon
        points={pts([t2, t3, b3, b2])}
        fill={color}
        style={{ filter: "brightness(0.62)" }}
        stroke={hovered ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.35)"}
        strokeWidth={hovered ? 1.2 : 0.5}
      />
    </g>
  );
});

interface BoxRect {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

function computeFittedViewBox(
  sceneEl: SVGGElement | null,
  containerEl: HTMLElement | null,
  fallback: BoxRect,
): string {
  try {
    if (sceneEl && containerEl) {
      const bbox = sceneEl.getBBox();
      if (bbox && bbox.width > 10 && bbox.height > 10) {
        const containerW = containerEl.clientWidth;
        const containerH = containerEl.clientHeight;

        const marginPercent = CAMERA_FIT_MARGIN_PERCENT; // 0.04 (4%)
        const marginX = bbox.width * marginPercent;
        const marginY = bbox.height * marginPercent;
        const contentW = bbox.width + 2 * marginX;
        const contentH = bbox.height + 2 * marginY;
        const contentX = bbox.x - marginX;
        const contentY = bbox.y - marginY;

        if (containerW > 0 && containerH > 0) {
          // Reserve space for overlays inside the fit:
          // top 48 px (3D/2D toggle and legend row), bottom 48 px (Status legend), left/right 16 px
          const padTop = 48;
          const padBottom = 48;
          const padLeft = 16;
          const padRight = 16;

          const usableW = Math.max(20, containerW - (padLeft + padRight));
          const usableH = Math.max(20, containerH - (padTop + padBottom));

          const scale = Math.min(usableW / contentW, usableH / contentH);
          if (scale > 0 && isFinite(scale)) {
            const vbW = containerW / scale;
            const vbH = containerH / scale;

            const contentPixelW = contentW * scale;
            const contentPixelH = contentH * scale;

            const offsetPixelX = padLeft + (usableW - contentPixelW) / 2;
            const offsetPixelY = padTop + (usableH - contentPixelH) / 2;

            const vbX = contentX - offsetPixelX / scale;
            const vbY = contentY - offsetPixelY / scale;

            return `${Math.round(vbX * 10) / 10} ${Math.round(vbY * 10) / 10} ${Math.round(vbW * 10) / 10} ${Math.round(vbH * 10) / 10}`;
          }
        }

        return `${Math.round(contentX * 10) / 10} ${Math.round(contentY * 10) / 10} ${Math.round(contentW * 10) / 10} ${Math.round(contentH * 10) / 10}`;
      }
    }
  } catch {
    // getBBox may throw if unattached; fall back
  }

  return `${fallback.minX} ${fallback.minY} ${fallback.width} ${fallback.height}`;
}

/**
 * High-fidelity Plant View (View 1)
 */
export function J2PlantZoneMap({
  plant,
  activeZoneId,
  onSelectZone,
  className,
}: {
  plant: Plant;
  activeZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
  className?: string;
}) {
  const { resolved } = usePeriod();
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [hoveredLineCode, setHoveredLineCode] = useState<string | null>(null);
  const [hoveredMachine, setHoveredMachine] = useState<MachineHoverData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const zonesMap = useMemo(() => {
    const map = new Map<string, Zone>();
    for (const z of plant.zones) map.set(z.id, z);
    return map;
  }, [plant.zones]);

  const linesMap = useMemo(() => {
    const map = new Map<string, Line>();
    for (const z of plant.zones) {
      for (const l of z.lines) map.set(l.id, l);
    }
    return map;
  }, [plant.zones]);

  const handleZoneClick = useCallback(
    (zoneId: string) => {
      if (onSelectZone) {
        onSelectZone(zoneId);
      } else {
        navigate({
          to: "/live/$plantId/$zoneId",
          params: { plantId: plant.id, zoneId },
        });
      }
    },
    [navigate, onSelectZone, plant.id],
  );

  // Debounced line hover enter/leave to eliminate flickering when moving between block and label
  const handleLineEnter = useCallback((lineCode: string, zoneId: string) => {
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setHoveredLineCode(lineCode);
    setHoveredZoneId(zoneId);
  }, []);

  const handleLineLeave = useCallback(() => {
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = window.setTimeout(() => {
      setHoveredLineCode(null);
      setHoveredZoneId(null);
      setHoveredMachine(null);
      leaveTimerRef.current = null;
    }, 120);
  }, []);

  const handleMachineHover = useCallback(
    (
      e: React.MouseEvent,
      lineCfg: J2LineConfig,
      machine: Machine | undefined,
      machineCode: string,
      zone: Zone | undefined,
      line: Line | undefined,
    ) => {
      handleLineEnter(lineCfg.code, lineCfg.zoneId);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const lineM = getMetrics(plant.id, "line", lineCfg.code, resolved);
      const machineM = getMetrics(plant.id, "machine", machineCode, resolved);

      setHoveredMachine({
        lineCode: lineCfg.code,
        machineCode,
        machineName: machine?.name ?? machineCode,
        zoneId: lineCfg.zoneId,
        zoneName: zone?.name ?? `Zone ${lineCfg.zoneId}`,
        lineOee: lineM.oee,
        machineOee: machineM.oee,
        machineStatus: machine?.status ?? line?.status ?? "running",
        clientX: e.clientX - rect.left,
        clientY: e.clientY - rect.top,
      });
    },
    [handleLineEnter, plant.id, resolved],
  );

  // Auto-Fit Bounding Box (Completely independent of hover state)
  const autoFit3D = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const includePoint = (p: { x: number; y: number }) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    };

    // Zone footprint polygons & title billboards
    for (const zId of ["A", "B", "C"] as const) {
      const fp = J2_ZONE_FOOTPRINTS[zId];
      for (const pt of fp.polygon) {
        includePoint(projectIso(pt.x, pt.y, 0, PLANT_ISO_SCALE));
      }
      const titlePos = projectIso(fp.labelPos.x, fp.labelPos.y, 38, PLANT_ISO_SCALE);
      includePoint({ x: titlePos.x - 65, y: titlePos.y - 25 });
      includePoint({ x: titlePos.x + 65, y: titlePos.y + 25 });
    }

    // All line blocks and line labels
    for (const lCfg of J2_LINES_CONFIG) {
      for (let mi = 0; mi < lCfg.machines.length; mi++) {
        const m = lCfg.machines[mi];
        const bx = lCfg.layout.x + (m.offsetX ?? mi * PLANT_MACHINE_GAP);
        let by = lCfg.layout.y + (m.offsetY ?? 0);
        if (m.subRow === "top") by -= 0.7;

        includePoint(projectIso(bx, by, 0, PLANT_ISO_SCALE));
        includePoint(
          projectIso(
            bx + PLANT_BLOCK_SIZE.w,
            by + PLANT_BLOCK_SIZE.d,
            PLANT_BLOCK_SIZE.h + 8,
            PLANT_ISO_SCALE,
          ),
        );
      }

      // Outward line labels
      const isLeft = lCfg.labelSide === "left";
      const labelX = isLeft
        ? lCfg.layout.x - 1.8
        : lCfg.layout.x + (lCfg.machines.length - 1) * PLANT_MACHINE_GAP + 2.2;
      const labelPos = projectIso(labelX, lCfg.layout.y + 0.15, 6, PLANT_ISO_SCALE);
      includePoint({ x: labelPos.x - 32, y: labelPos.y - 14 });
      includePoint({ x: labelPos.x + 32, y: labelPos.y + 14 });
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const marginX = Math.round(width * CAMERA_FIT_MARGIN_PERCENT);
    const marginY = Math.round(height * CAMERA_FIT_MARGIN_PERCENT);

    return {
      minX: minX - marginX,
      minY: minY - marginY,
      width: width + 2 * marginX,
      height: height + 2 * marginY,
    };
  }, []);

  const fallback2D = useMemo(() => ({ minX: 0, minY: 0, width: 1020, height: 720 }), []);

  const scene3dRef = useRef<SVGGElement>(null);
  const scene2dRef = useRef<SVGGElement>(null);

  const [viewBox3D, setViewBox3D] = useState<string>(
    () => `${autoFit3D.minX} ${autoFit3D.minY} ${autoFit3D.width} ${autoFit3D.height}`,
  );
  const [viewBox2D, setViewBox2D] = useState<string>(
    () => `${fallback2D.minX} ${fallback2D.minY} ${fallback2D.width} ${fallback2D.height}`,
  );

  const updateFittedViewBox = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (viewMode === "3d") {
      const fitted = computeFittedViewBox(scene3dRef.current, container, autoFit3D);
      setViewBox3D(fitted);
    } else {
      const fitted = computeFittedViewBox(scene2dRef.current, container, fallback2D);
      setViewBox2D(fitted);
    }
  }, [viewMode, autoFit3D, fallback2D]);

  useLayoutEffect(() => {
    updateFittedViewBox();
  }, [updateFittedViewBox]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      updateFittedViewBox();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [updateFittedViewBox]);

  useEffect(() => {
    const img = new Image();
    img.src = "/bop15-chain.webp";
    img.onload = () => {
      updateFittedViewBox();
    };
  }, [updateFittedViewBox]);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex min-h-0 flex-1 flex-col w-full", className)}
    >
      {/* Top Controls: 3D / 2D Switcher & Legend */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background/90 px-2.5 py-1 text-xs shadow-xs backdrop-blur">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-tier-good" />
            <span>OEE ≥ 70%</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-tier-bad" />
            <span>OEE &lt; 70%</span>
          </span>
        </div>

        <div className="flex items-center rounded-md border border-border bg-background/90 p-0.5 shadow-xs backdrop-blur">
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
              viewMode === "3d"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Switch to 3D Isometric View"
          >
            3D
          </button>
          <button
            type="button"
            onClick={() => setViewMode("2d")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
              viewMode === "2d"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Switch to 2D Top-down View"
          >
            2D
          </button>
        </div>
      </div>

      <ZoomableMap className="min-h-[480px] flex-1">
        {viewMode === "3d" ? (
          <svg
            viewBox={viewBox3D}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full select-none"
            role="img"
          >
            {/* 1. Base Ground & Floor Plates */}
            <g id="ground-and-plates-layer" ref={scene3dRef}>
              {(["A", "B", "C"] as const).map((zId) => {
                const fp = J2_ZONE_FOOTPRINTS[zId];
                const isZoneHovered = hoveredZoneId === zId;
                const isDimmed = hoveredZoneId && hoveredZoneId !== zId;

                const polyPoints = fp.polygon
                  .map((pt) => {
                    const p = projectIso(pt.x, pt.y, 0, PLANT_ISO_SCALE);
                    return `${p.x},${p.y}`;
                  })
                  .join(" ");

                return (
                  <polygon
                    key={`zone-poly-${zId}`}
                    points={polyPoints}
                    fill="var(--surface)"
                    fillOpacity={0.75}
                    stroke="rgba(239, 68, 68, 0.85)"
                    strokeWidth={isZoneHovered ? 2.5 : 1.5}
                    strokeDasharray={isZoneHovered ? undefined : "5 3"}
                    className="cursor-pointer transition-colors duration-150"
                    opacity={isDimmed ? 0.35 : 1}
                    onClick={() => handleZoneClick(zId)}
                    onMouseEnter={() => setHoveredZoneId(zId)}
                    onMouseLeave={handleLineLeave}
                  />
                );
              })}
            </g>

            {/* 2. 3D Machine Blocks Layer */}
            <g id="blocks-layer">
              {J2_LINES_CONFIG.map((lineCfg) => {
                const zone = zonesMap.get(lineCfg.zoneId);
                const line = linesMap.get(lineCfg.code);
                const isLineHovered = hoveredLineCode === lineCfg.code;
                const isDimmed =
                  (hoveredZoneId && hoveredZoneId !== lineCfg.zoneId) ||
                  (hoveredLineCode && !isLineHovered);

                if (lineCfg.code === "BOP15") {
                  return (
                    <Bop15ChainSprite
                      key={`blocks-${lineCfg.code}`}
                      layoutX={lineCfg.layout.x}
                      layoutY={lineCfg.layout.y}
                      blockW={PLANT_BLOCK_SIZE.w}
                      blockD={PLANT_BLOCK_SIZE.d}
                      gap={PLANT_MACHINE_GAP}
                      isoScale={PLANT_ISO_SCALE}
                      statusSource={(code) =>
                        line?.machines.find((m) => m.code === code || m.id === code)?.status ??
                        "running"
                      }
                      hoveredMachine={
                        hoveredMachine?.lineCode === "BOP15" ? hoveredMachine.machineCode : null
                      }
                      selectedMachine={null}
                      onMachineHover={(mCode, e) => {
                        if (mCode) {
                          const m = line?.machines.find((m) => m.code === mCode || m.id === mCode);
                          handleMachineHover(
                            e ?? ({ clientX: 0, clientY: 0 } as any),
                            lineCfg,
                            m,
                            mCode,
                            zone,
                            line,
                          );
                        } else {
                          handleLineLeave();
                        }
                      }}
                      onMachineClick={() => handleZoneClick(lineCfg.zoneId)}
                      onLineLeave={handleLineLeave}
                      isDimmed={isDimmed}
                    />
                  );
                }

                return (
                  <g key={`blocks-${lineCfg.code}`} opacity={isDimmed ? 0.35 : 1}>
                    {lineCfg.machines.map((mCfg, mIdx) => {
                      const machine = line?.machines.find(
                        (m) => m.id === mCfg.code || m.code === mCfg.code,
                      );
                      const status = machine?.status ?? "running";

                      const blockX = lineCfg.layout.x + (mCfg.offsetX ?? mIdx * PLANT_MACHINE_GAP);
                      let blockY = lineCfg.layout.y + (mCfg.offsetY ?? 0);
                      if (mCfg.subRow === "top") blockY -= 0.7;

                      const isBlockHovered =
                        hoveredMachine?.lineCode === lineCfg.code &&
                        hoveredMachine?.machineCode === mCfg.code;

                      return (
                        <J2IsoBlock
                          key={`${lineCfg.code}-${mCfg.code}-${mIdx}`}
                          x={blockX}
                          y={blockY}
                          w={PLANT_BLOCK_SIZE.w}
                          d={PLANT_BLOCK_SIZE.d}
                          h={
                            PLANT_BLOCK_SIZE.h +
                            (status === "running" ? 4 : status === "slow" ? 2 : 0)
                          }
                          scale={PLANT_ISO_SCALE}
                          color={STATUS_HEX[status]}
                          hovered={isBlockHovered || isLineHovered}
                          onClick={() => handleZoneClick(lineCfg.zoneId)}
                          onMouseEnter={(e) => {
                            handleMachineHover(e, lineCfg, machine, mCfg.code, zone, line);
                          }}
                          onMouseLeave={handleLineLeave}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* 3. Leader Lines Layer (Connecting outward line labels to edge machine) */}
            <g id="leader-lines-layer" pointerEvents="none">
              {J2_LINES_CONFIG.map((lineCfg) => {
                const isLeft = lineCfg.labelSide === "left";
                const isLineHovered = hoveredLineCode === lineCfg.code;
                const isDimmed =
                  (hoveredZoneId && hoveredZoneId !== lineCfg.zoneId) ||
                  (hoveredLineCode && !isLineHovered);

                let anchorX = lineCfg.layout.x;
                const anchorY = lineCfg.layout.y + PLANT_BLOCK_SIZE.d / 2;
                let labelX = lineCfg.layout.x - 1.8;

                if (!isLeft) {
                  const lastMachineX =
                    lineCfg.layout.x + (lineCfg.machines.length - 1) * PLANT_MACHINE_GAP;
                  anchorX = lastMachineX + PLANT_BLOCK_SIZE.w;
                  labelX = lastMachineX + 2.2;
                }

                const pAnchor = projectIso(anchorX, anchorY, 4, PLANT_ISO_SCALE);
                const pLabel = projectIso(labelX, anchorY, 4, PLANT_ISO_SCALE);

                return (
                  <line
                    key={`leader-${lineCfg.code}`}
                    x1={pLabel.x}
                    y1={pLabel.y}
                    x2={pAnchor.x}
                    y2={pAnchor.y}
                    stroke="var(--border)"
                    strokeWidth={isLineHovered ? 1.5 : 0.85}
                    strokeDasharray="2 2"
                    opacity={isDimmed ? 0.35 : 0.8}
                  />
                );
              })}
            </g>

            {/* 4. Labels Layer (ALWAYS ON TOP — Static Geometry, No Transforms) */}
            <g id="labels-layer">
              {/* Zone Title Badges */}
              {(["A", "B", "C"] as const).map((zId) => {
                const fp = J2_ZONE_FOOTPRINTS[zId];
                const isZoneHovered = hoveredZoneId === zId;
                const isDimmed = hoveredZoneId && hoveredZoneId !== zId;

                const labelPos = projectIso(fp.labelPos.x, fp.labelPos.y, 42, PLANT_ISO_SCALE);
                const zoneM = getMetrics(plant.id, "zone", zId, resolved);
                const zoneOee = zoneM.oee;

                return (
                  <g
                    key={`zone-title-${zId}`}
                    transform={`translate(${labelPos.x}, ${labelPos.y})`}
                    className="cursor-pointer select-none"
                    opacity={isDimmed ? 0.35 : 1}
                    onClick={() => handleZoneClick(zId)}
                    onMouseEnter={() => setHoveredZoneId(zId)}
                    onMouseLeave={handleLineLeave}
                    pointerEvents="auto"
                  >
                    <rect
                      x={-48}
                      y={-14}
                      width={96}
                      height={26}
                      rx={13}
                      fill="var(--background)"
                      stroke={isZoneHovered ? "var(--primary)" : "rgba(239, 68, 68, 0.95)"}
                      strokeWidth={isZoneHovered ? 2.2 : 1.8}
                    />
                    <text
                      x={0}
                      y={2}
                      textAnchor="middle"
                      className="fill-red-500 dark:fill-red-400 font-bold text-[11px] tracking-wider"
                    >
                      {fp.title}
                    </text>
                    <text
                      x={0}
                      y={18}
                      textAnchor="middle"
                      className="fill-muted-foreground font-mono text-[9px] font-bold"
                    >
                      {zoneOee.toFixed(0)}% OEE
                    </text>
                  </g>
                );
              })}

              {/* Line Code Labels (Placed stably in the aisle) */}
              {J2_LINES_CONFIG.map((lineCfg) => {
                const isLeft = lineCfg.labelSide === "left";
                const isLineHovered = hoveredLineCode === lineCfg.code;
                const isDimmed =
                  (hoveredZoneId && hoveredZoneId !== lineCfg.zoneId) ||
                  (hoveredLineCode && !isLineHovered);

                const lineM = getMetrics(plant.id, "line", lineCfg.code, resolved);
                const lineOee = lineM.oee;

                let labelX = lineCfg.layout.x - 1.8;
                const labelY = lineCfg.layout.y + PLANT_BLOCK_SIZE.d / 2;

                if (!isLeft) {
                  const lastMachineX =
                    lineCfg.layout.x + (lineCfg.machines.length - 1) * PLANT_MACHINE_GAP;
                  labelX = lastMachineX + 2.2;
                }

                const lp = projectIso(labelX, labelY, 4, PLANT_ISO_SCALE);

                return (
                  <g
                    key={`line-label-${lineCfg.code}`}
                    transform={`translate(${lp.x}, ${lp.y})`}
                    className="cursor-pointer select-none"
                    opacity={isDimmed ? 0.35 : 1}
                    onClick={() => handleZoneClick(lineCfg.zoneId)}
                    onMouseEnter={() => handleLineEnter(lineCfg.code, lineCfg.zoneId)}
                    onMouseLeave={handleLineLeave}
                    pointerEvents="auto"
                  >
                    {/* Generous Hit-Target Rect */}
                    <rect
                      x={-28}
                      y={-12}
                      width={56}
                      height={24}
                      rx={12}
                      fill="var(--surface)"
                      stroke={isLineHovered ? "var(--primary)" : TIER_HEX[tierOf(lineOee)]}
                      strokeWidth={isLineHovered ? 2.0 : 1.2}
                    />
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      className="fill-foreground font-mono text-[9px] font-bold"
                    >
                      {lineCfg.code}
                    </text>
                  </g>
                );
              })}

              {/* Bottleneck Machine BN Badges (Plant View 3D) */}
              {J2_LINES_CONFIG.map((lineCfg) => {
                const bnCode = getBottleneck(plant.id, lineCfg.code);
                const bnIdx = lineCfg.machines.findIndex((m) => m.code === bnCode);
                const mIdx = bnIdx >= 0 ? bnIdx : 0;
                const mCfg = lineCfg.machines[mIdx];
                if (!mCfg) return null;

                const bx = lineCfg.layout.x + (mCfg.offsetX ?? mIdx * PLANT_MACHINE_GAP);
                let by = lineCfg.layout.y + (mCfg.offsetY ?? 0);
                if (mCfg.subRow === "top") by -= 0.7;

                const p = projectIso(
                  bx + PLANT_BLOCK_SIZE.w / 2,
                  by + PLANT_BLOCK_SIZE.d / 2,
                  PLANT_BLOCK_SIZE.h + 16,
                  PLANT_ISO_SCALE,
                );

                const isDimmed =
                  (hoveredZoneId && hoveredZoneId !== lineCfg.zoneId) ||
                  (hoveredLineCode && hoveredLineCode !== lineCfg.code);

                return (
                  <g
                    key={`plant-bn-badge-${lineCfg.code}`}
                    transform={`translate(${p.x}, ${p.y})`}
                    pointerEvents="none"
                    opacity={isDimmed ? 0.35 : 1}
                  >
                    <rect
                      x={-9}
                      y={-6}
                      width={18}
                      height={12}
                      rx={3}
                      fill="#5B3FD1"
                      stroke="#FFFFFF"
                      strokeWidth={0.75}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor="middle"
                      className="fill-white font-mono font-bold text-[7.5px]"
                    >
                      BN
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          /* 2D Top-Down View */
          <svg
            viewBox={viewBox2D}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full bg-grid/10 select-none"
            role="img"
          >
            <defs>
              <pattern id="j2-grid-2d" width="28" height="28" patternUnits="userSpaceOnUse">
                <path
                  d="M 28 0 L 0 0 0 28"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="0.5"
                  strokeOpacity="0.4"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#j2-grid-2d)" />

            <g id="plant-scene-2d" ref={scene2dRef}>
              {/* 2D Zone Footprints */}
              {(["A", "B", "C"] as const).map((zId) => {
                const fp = J2_ZONE_FOOTPRINTS[zId];
                const isZoneHovered = hoveredZoneId === zId;
                const isDimmed = hoveredZoneId && hoveredZoneId !== zId;

                const scaleX = 28.0;
                const scaleY = 24.0;
                const offsetX = 24;
                const offsetY = 36;

                const zx = fp.bounds.minX * scaleX + offsetX;
                const zy = fp.bounds.minY * scaleY + offsetY;
                const zw = (fp.bounds.maxX - fp.bounds.minX) * scaleX;
                const zh = (fp.bounds.maxY - fp.bounds.minY) * scaleY;
                const zoneM = getMetrics(plant.id, "zone", zId, resolved);
                const zoneOee = zoneM.oee;

                return (
                  <g
                    key={`2d-zone-${zId}`}
                    opacity={isDimmed ? 0.35 : 1}
                    className="transition-colors duration-150"
                    onMouseEnter={() => setHoveredZoneId(zId)}
                    onMouseLeave={handleLineLeave}
                  >
                    <rect
                      x={zx}
                      y={zy}
                      width={zw}
                      height={zh}
                      rx={8}
                      fill="var(--surface)"
                      fillOpacity={0.8}
                      stroke="rgba(239, 68, 68, 0.85)"
                      strokeWidth={isZoneHovered ? 2.5 : 1.5}
                      strokeDasharray={isZoneHovered ? undefined : "5 3"}
                      className="cursor-pointer"
                      onClick={() => handleZoneClick(zId)}
                    />
                    <rect
                      x={zx + zw / 2 - 48}
                      y={zy - 13}
                      width={96}
                      height={24}
                      rx={12}
                      fill="var(--background)"
                      stroke="rgba(239, 68, 68, 0.95)"
                      strokeWidth={1.5}
                      className="cursor-pointer drop-shadow-xs"
                      onClick={() => handleZoneClick(zId)}
                    />
                    <text
                      x={zx + zw / 2}
                      y={zy + 3}
                      textAnchor="middle"
                      className="fill-red-500 font-bold text-xs tracking-wider"
                    >
                      {fp.title} · {zoneOee.toFixed(0)}%
                    </text>
                  </g>
                );
              })}

              {/* 2D Line and Machine Boxes */}
              {J2_LINES_CONFIG.map((lineCfg) => {
                const zone = zonesMap.get(lineCfg.zoneId);
                const line = linesMap.get(lineCfg.code);
                const isDimmed = hoveredZoneId && hoveredZoneId !== lineCfg.zoneId;

                const scaleX = 28.0;
                const scaleY = 24.0;
                const offsetX = 24;
                const offsetY = 36;

                return (
                  <g key={`2d-line-${lineCfg.code}`} opacity={isDimmed ? 0.35 : 1}>
                    {/* Line Code Pill */}
                    {(() => {
                      const isLeft = lineCfg.labelSide === "left";
                      const labelX = isLeft
                        ? (lineCfg.layout.x - 1.2) * scaleX + offsetX
                        : (lineCfg.layout.x +
                            (lineCfg.machines.length - 1) * PLANT_MACHINE_GAP +
                            1.4) *
                            scaleX +
                          offsetX;
                      const labelY = lineCfg.layout.y * scaleY + offsetY;

                      return (
                        <g
                          transform={`translate(${labelX}, ${labelY})`}
                          className="cursor-pointer select-none"
                          onClick={() => handleZoneClick(lineCfg.zoneId)}
                        >
                          <rect
                            x={-20}
                            y={-8}
                            width={40}
                            height={16}
                            rx={8}
                            fill="var(--surface)"
                            stroke="var(--border)"
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={3.5}
                            textAnchor="middle"
                            className="fill-foreground font-mono text-[8.5px] font-bold"
                          >
                            {lineCfg.code}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Machine Rectangles */}
                    {lineCfg.machines.map((mCfg, mIdx) => {
                      const machine = line?.machines.find(
                        (m) => m.id === mCfg.code || m.code === mCfg.code,
                      );
                      const status = machine?.status ?? "running";

                      const blockX =
                        (lineCfg.layout.x + (mCfg.offsetX ?? mIdx * PLANT_MACHINE_GAP)) * scaleX +
                        offsetX;
                      let blockY = (lineCfg.layout.y + (mCfg.offsetY ?? 0)) * scaleY + offsetY;
                      if (mCfg.subRow === "top") blockY -= 15;

                      const isHovered =
                        hoveredMachine?.lineCode === lineCfg.code &&
                        hoveredMachine?.machineCode === mCfg.code;
                      const isBottleneck = getBottleneck(plant.id, lineCfg.code) === mCfg.code;

                      return (
                        <g
                          key={`2d-m-${lineCfg.code}-${mCfg.code}`}
                          className="cursor-pointer"
                          onClick={() => handleZoneClick(lineCfg.zoneId)}
                          onMouseEnter={(e) => {
                            setHoveredZoneId(lineCfg.zoneId);
                            handleMachineHover(e, lineCfg, machine, mCfg.code, zone, line);
                          }}
                          onMouseLeave={handleLineLeave}
                        >
                          {isBottleneck && (
                            <rect
                              x={blockX - 13}
                              y={blockY - 9}
                              width={26}
                              height={18}
                              rx={4}
                              fill="none"
                              stroke="#5B3FD1"
                              strokeWidth={1.5}
                            />
                          )}
                          <rect
                            x={blockX - 11}
                            y={blockY - 7}
                            width={22}
                            height={14}
                            rx={3}
                            fill={STATUS_HEX[status]}
                            stroke={
                              isHovered ? "white" : isBottleneck ? "#5B3FD1" : "rgba(0,0,0,0.3)"
                            }
                            strokeWidth={isHovered ? 1.5 : 0.75}
                          />
                          {isBottleneck && (
                            <g
                              transform={`translate(${blockX}, ${blockY - 14})`}
                              pointerEvents="none"
                            >
                              <rect x={-8} y={-4} width={16} height={9} rx={2} fill="#5B3FD1" />
                              <text
                                x={0}
                                y={3}
                                textAnchor="middle"
                                className="fill-white font-mono font-bold text-[6.5px]"
                              >
                                BN
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </ZoomableMap>

      {/* Hover Tooltip Offset away from cursor so it never steals pointer */}
      {hoveredMachine && (
        <div
          className="pointer-events-none absolute z-50 transition-opacity duration-100 select-none"
          style={{
            left: `${hoveredMachine.clientX + 16}px`,
            top: `${hoveredMachine.clientY + 16}px`,
          }}
        >
          <div className="flex min-w-[210px] flex-col gap-1.5 rounded-lg border border-border bg-surface/95 p-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-foreground">
                  {hoveredMachine.lineCode}
                </span>
                <LineDataSourceChip plantId={plant.id} lineId={hoveredMachine.lineCode} />
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  hoveredMachine.machineStatus === "running" &&
                    "bg-status-running/15 text-status-running",
                  hoveredMachine.machineStatus === "slow" && "bg-status-slow/20 text-status-slow",
                  hoveredMachine.machineStatus === "down" && "bg-status-down/15 text-status-down",
                  hoveredMachine.machineStatus === "idle" &&
                    "bg-status-idle/20 text-muted-foreground",
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", STATUS_DOT[hoveredMachine.machineStatus])}
                />
                {STATUS_LABEL[hoveredMachine.machineStatus]}
              </span>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {hoveredMachine.zoneName} ·{" "}
              <span className="text-foreground font-semibold">{hoveredMachine.machineCode}</span>
              <span className="block text-[10px] text-muted-foreground/80 font-normal">
                {MODEL_REGISTRY[resolveModelKey(hoveredMachine.machineCode)]?.label ??
                  "Production Machine"}
              </span>
            </p>
            <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
              <span className="text-muted-foreground">PO</span>
              <span className="font-mono font-medium text-foreground">
                {getActivePO(plant.id, hoveredMachine.lineCode)?.poNumber ?? PO_IDLE_PLACEHOLDER}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
              <span className="text-muted-foreground">PO Output</span>
              <span className="font-mono font-medium text-foreground">
                {(() => {
                  const po = getActivePO(plant.id, hoveredMachine.lineCode);
                  return po
                    ? `= ${po.currentOutput.toLocaleString()} / ${po.totalMPQ.toLocaleString()}`
                    : "= - / -";
                })()}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
              <span className="text-muted-foreground">OEE</span>
              <span
                className={cn("font-mono font-bold", TIER_TEXT[tierOf(hoveredMachine.machineOee)])}
              >
                Line {hoveredMachine.lineOee.toFixed(1)}% · machine{" "}
                {hoveredMachine.machineOee.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      <MapStatusLegendOverlay />
    </div>
  );
}

/**
 * High-fidelity Zone Production Floor Map (View 2)
 */
export function J2ZoneProductionFloorMap({
  plantId,
  zone,
  selectedMachineId,
  onSelectMachine,
  onSelectLine,
  className,
}: {
  plantId: string;
  zone: Zone;
  selectedMachineId?: string | null;
  onSelectMachine?: (lineId: string, machineId: string) => void;
  onSelectLine?: (lineId: string) => void;
  className?: string;
}) {
  const { resolved } = usePeriod();
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [hoveredLineCode, setHoveredLineCode] = useState<string | null>(null);
  const [hoveredMachine, setHoveredMachine] = useState<MachineHoverData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const linesForZone = useMemo(() => {
    return J2_LINES_CONFIG.filter((l) => l.zoneId === zone.id);
  }, [zone.id]);

  const handleMachineClick = useCallback(
    (lineId: string, machineId: string) => {
      if (onSelectMachine) {
        onSelectMachine(lineId, machineId);
      } else {
        navigate({
          to: "/live/$plantId/$zoneId/$lineId/$machineId",
          params: { plantId, zoneId: zone.id, lineId, machineId },
        });
      }
    },
    [navigate, onSelectMachine, plantId, zone.id],
  );

  const handleLinePillClick = useCallback(
    (lineId: string) => {
      if (onSelectLine) {
        onSelectLine(lineId);
      } else {
        navigate({
          to: "/live/$plantId/$zoneId/$lineId",
          params: { plantId, zoneId: zone.id, lineId },
        });
      }
    },
    [navigate, onSelectLine, plantId, zone.id],
  );

  const handleLineEnter = useCallback((lineCode: string) => {
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setHoveredLineCode(lineCode);
  }, []);

  const handleLineLeave = useCallback(() => {
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = window.setTimeout(() => {
      setHoveredLineCode(null);
      setHoveredMachine(null);
      leaveTimerRef.current = null;
    }, 120);
  }, []);

  // Dynamically compute ground plate tightly surrounding this zone's machines and line labels
  const zoneGround = useMemo(() => {
    let minLx = Infinity;
    let maxLx = -Infinity;
    let minLy = Infinity;
    let maxLy = -Infinity;

    for (const lCfg of linesForZone) {
      for (let mi = 0; mi < lCfg.machines.length; mi++) {
        const m = lCfg.machines[mi];
        const bx = lCfg.zoneViewLayout.x + (m.offsetX ?? mi * MACHINE_GAP);
        let by = lCfg.zoneViewLayout.y + (m.offsetY ?? 0);
        if (m.subRow === "top") by -= 0.85;

        minLx = Math.min(minLx, bx);
        maxLx = Math.max(maxLx, bx + ZONE_BLOCK_SIZE.w);
        minLy = Math.min(minLy, by);
        maxLy = Math.max(maxLy, by + ZONE_BLOCK_SIZE.d);
      }

      const isLeft = lCfg.labelSide === "left";
      const pillX = isLeft
        ? lCfg.zoneViewLayout.x - 2.2
        : lCfg.zoneViewLayout.x + (lCfg.machines.length - 1) * MACHINE_GAP + 2.6;
      minLx = Math.min(minLx, pillX - 1.2);
      maxLx = Math.max(maxLx, pillX + 1.2);
      minLy = Math.min(minLy, lCfg.zoneViewLayout.y);
      maxLy = Math.max(maxLy, lCfg.zoneViewLayout.y + 0.8);
    }

    const groundMinX = Math.max(0, Math.floor(minLx - 0.8));
    const groundMaxX = Math.ceil(maxLx + 1.0);
    const groundMinY = Math.max(0, Math.floor(minLy - 0.8));
    const groundMaxY = Math.ceil(maxLy + 1.0);

    return {
      minX: groundMinX,
      maxX: groundMaxX,
      minY: groundMinY,
      maxY: groundMaxY,
      points: [
        projectIso(groundMinX, groundMinY, 0, ZONE_ISO_SCALE),
        projectIso(groundMaxX, groundMinY, 0, ZONE_ISO_SCALE),
        projectIso(groundMaxX, groundMaxY, 0, ZONE_ISO_SCALE),
        projectIso(groundMinX, groundMaxY, 0, ZONE_ISO_SCALE),
      ],
    };
  }, [linesForZone]);

  // Compute Auto-Fit Bounding Box for the selected zone
  const autoFit3D = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const includePoint = (p: { x: number; y: number }) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    };

    // Ground Plate bounds
    for (const pt of zoneGround.points) includePoint(pt);

    // All blocks and outward labels
    for (const lCfg of linesForZone) {
      for (let mi = 0; mi < lCfg.machines.length; mi++) {
        const m = lCfg.machines[mi];
        const bx = lCfg.zoneViewLayout.x + (m.offsetX ?? mi * MACHINE_GAP);
        let by = lCfg.zoneViewLayout.y + (m.offsetY ?? 0);
        if (m.subRow === "top") by -= 0.85;

        includePoint(projectIso(bx, by, 0, ZONE_ISO_SCALE));
        includePoint(
          projectIso(
            bx + ZONE_BLOCK_SIZE.w,
            by + ZONE_BLOCK_SIZE.d,
            ZONE_BLOCK_SIZE.h + 18,
            ZONE_ISO_SCALE,
          ),
        );
      }

      // Outward Line Pill bounds
      const isLeft = lCfg.labelSide === "left";
      const pillX = isLeft
        ? lCfg.zoneViewLayout.x - 2.2
        : lCfg.zoneViewLayout.x + (lCfg.machines.length - 1) * MACHINE_GAP + 2.6;
      const pillPos = projectIso(pillX, lCfg.zoneViewLayout.y + 0.35, 6, ZONE_ISO_SCALE);

      includePoint({ x: pillPos.x - 50, y: pillPos.y - 18 });
      includePoint({ x: pillPos.x + 50, y: pillPos.y + 18 });
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const marginX = Math.round(width * CAMERA_FIT_MARGIN_PERCENT);
    const marginY = Math.round(height * CAMERA_FIT_MARGIN_PERCENT);

    return {
      minX: minX - marginX,
      minY: minY - marginY,
      width: width + 2 * marginX,
      height: height + 2 * marginY,
    };
  }, [linesForZone, zoneGround]);

  const fallback2D = useMemo(
    () => ({
      minX: 0,
      minY: 0,
      width: 920,
      height: Math.max(400, 80 + Math.max(...linesForZone.map((l) => l.rowOrder), 1) * 44),
    }),
    [linesForZone],
  );

  const scene3dRef = useRef<SVGGElement>(null);
  const scene2dRef = useRef<SVGGElement>(null);

  const [viewBox3D, setViewBox3D] = useState<string>(
    () => `${autoFit3D.minX} ${autoFit3D.minY} ${autoFit3D.width} ${autoFit3D.height}`,
  );
  const [viewBox2D, setViewBox2D] = useState<string>(
    () => `${fallback2D.minX} ${fallback2D.minY} ${fallback2D.width} ${fallback2D.height}`,
  );

  const updateFittedViewBox = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (viewMode === "3d") {
      const fitted = computeFittedViewBox(scene3dRef.current, container, autoFit3D);
      setViewBox3D(fitted);
    } else {
      const fitted = computeFittedViewBox(scene2dRef.current, container, fallback2D);
      setViewBox2D(fitted);
    }
  }, [viewMode, autoFit3D, fallback2D]);

  useLayoutEffect(() => {
    updateFittedViewBox();
  }, [updateFittedViewBox]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let animFrame: number;
    const ro = new ResizeObserver(() => {
      animFrame = requestAnimationFrame(() => {
        updateFittedViewBox();
      });
    });
    ro.observe(container);
    return () => {
      cancelAnimationFrame(animFrame);
      ro.disconnect();
    };
  }, [updateFittedViewBox]);

  useEffect(() => {
    const img = new Image();
    img.src = "/bop15-chain.webp";
    img.onload = () => {
      updateFittedViewBox();
    };
  }, [updateFittedViewBox]);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex min-h-0 flex-1 flex-col w-full", className)}
    >
      {/* View Mode Controls */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background/90 px-2.5 py-1 text-xs shadow-xs backdrop-blur">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-tier-good" />
            <span>OEE ≥ 70%</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-tier-bad" />
            <span>OEE &lt; 70%</span>
          </span>
        </div>

        <div className="flex items-center rounded-md border border-border bg-background/90 p-0.5 shadow-xs backdrop-blur">
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
              viewMode === "3d"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            3D
          </button>
          <button
            type="button"
            onClick={() => setViewMode("2d")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
              viewMode === "2d"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            2D
          </button>
        </div>
      </div>

      <ZoomableMap className="min-h-[480px] flex-1">
        {viewMode === "3d" ? (
          <svg
            viewBox={viewBox3D}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full select-none"
            role="img"
          >
            <g id="zone-scene-3d" ref={scene3dRef}>
              {/* 1. Ground Plate Layer */}
              <g id="ground-layer">
                <polygon
                  points={zoneGround.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="var(--grid)"
                  opacity={0.4}
                />
              </g>

              {/* 2. 3D Machine Blocks Layer */}
              <g id="blocks-layer">
                {linesForZone.map((lineCfg) => {
                  const line = zone.lines.find((l) => l.id === lineCfg.code);
                  const isLineHovered = hoveredLineCode === lineCfg.code;
                  const isDimmed = hoveredLineCode && !isLineHovered;
                  const isRtl = lineCfg.flowDirection === "right-to-left";

                  if (lineCfg.code === "BOP15") {
                    return (
                      <Bop15ChainSprite
                        key={`zone-blocks-${lineCfg.code}`}
                        layoutX={lineCfg.zoneViewLayout.x}
                        layoutY={lineCfg.zoneViewLayout.y}
                        blockW={ZONE_BLOCK_SIZE.w}
                        blockD={ZONE_BLOCK_SIZE.d}
                        gap={MACHINE_GAP}
                        isoScale={ZONE_ISO_SCALE}
                        statusSource={(code) =>
                          line?.machines.find((m) => m.code === code || m.id === code)?.status ??
                          "running"
                        }
                        hoveredMachine={
                          hoveredMachine?.lineCode === "BOP15" ? hoveredMachine.machineCode : null
                        }
                        selectedMachine={selectedMachineId}
                        onMachineHover={(mCode, e) => {
                          if (mCode) {
                            handleLineEnter(lineCfg.code);
                            const m = line?.machines.find(
                              (m) => m.code === mCode || m.id === mCode,
                            );
                            const machineM = getMetrics(plantId, "machine", mCode, resolved);
                            const lineM = getMetrics(plantId, "line", lineCfg.code, resolved);
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (rect && e) {
                              setHoveredMachine({
                                lineCode: lineCfg.code,
                                machineCode: mCode,
                                machineName: m?.name ?? mCode,
                                zoneId: zone.id,
                                zoneName: zone.name,
                                lineOee: lineM.oee,
                                machineOee: machineM.oee,
                                machineStatus: m?.status ?? "running",
                                clientX: e.clientX - rect.left,
                                clientY: e.clientY - rect.top,
                              });
                            }
                          } else {
                            handleLineLeave();
                          }
                        }}
                        onMachineClick={(mCode) => handleMachineClick(lineCfg.code, mCode)}
                        onLineLeave={handleLineLeave}
                        isDimmed={isDimmed}
                      />
                    );
                  }

                  return (
                    <g key={`zone-blocks-${lineCfg.code}`} opacity={isDimmed ? 0.35 : 1}>
                      {lineCfg.machines.map((mCfg, mIdx) => {
                        const machine = line?.machines.find(
                          (m) => m.id === mCfg.code || m.code === mCfg.code,
                        );
                        const machineM = getMetrics(plantId, "machine", mCfg.code, resolved);
                        const lineM = getMetrics(plantId, "line", lineCfg.code, resolved);
                        const machineOee = machineM.oee;
                        const status = machine?.status ?? "running";

                        const blockX =
                          lineCfg.zoneViewLayout.x + (mCfg.offsetX ?? mIdx * MACHINE_GAP);
                        let blockY = lineCfg.zoneViewLayout.y + (mCfg.offsetY ?? 0);
                        if (mCfg.subRow === "top") blockY -= 0.85;

                        const isSelected =
                          selectedMachineId === mCfg.code || selectedMachineId === machine?.key;
                        const isHovered =
                          hoveredMachine?.lineCode === lineCfg.code &&
                          hoveredMachine?.machineCode === mCfg.code;

                        return (
                          <g key={`m-block-group-${lineCfg.code}-${mCfg.code}-${mIdx}`}>
                            <J2IsoBlock
                              x={blockX}
                              y={blockY}
                              w={ZONE_BLOCK_SIZE.w}
                              d={ZONE_BLOCK_SIZE.d}
                              h={ZONE_BLOCK_SIZE.h}
                              scale={ZONE_ISO_SCALE}
                              color={STATUS_HEX[status]}
                              hovered={isHovered || isSelected || isLineHovered}
                              onClick={() => handleMachineClick(lineCfg.code, mCfg.code)}
                              onMouseEnter={(e) => {
                                handleLineEnter(lineCfg.code);
                                const rect = containerRef.current?.getBoundingClientRect();
                                if (rect) {
                                  setHoveredMachine({
                                    lineCode: lineCfg.code,
                                    machineCode: mCfg.code,
                                    machineName: machine?.name ?? mCfg.code,
                                    zoneId: zone.id,
                                    zoneName: zone.name,
                                    lineOee: lineM.oee,
                                    machineOee: machineM.oee,
                                    machineStatus: status,
                                    clientX: e.clientX - rect.left,
                                    clientY: e.clientY - rect.top,
                                  });
                                }
                              }}
                              onMouseLeave={handleLineLeave}
                            />

                            {/* Flow Direction Indicator Chevron between machines */}
                            {SHOW_FLOW_CHEVRONS &&
                              mIdx < lineCfg.machines.length - 1 &&
                              (() => {
                                const midX = blockX + (isRtl ? -0.32 : MACHINE_GAP - 0.25);
                                const midY = blockY + ZONE_BLOCK_SIZE.d / 2;
                                const arrowPos = projectIso(midX, midY, 6, ZONE_ISO_SCALE);

                                return (
                                  <g
                                    transform={`translate(${arrowPos.x}, ${arrowPos.y})`}
                                    pointerEvents="none"
                                  >
                                    <circle
                                      cx={0}
                                      cy={0}
                                      r={4.5}
                                      fill="var(--surface)"
                                      stroke="var(--border)"
                                      strokeWidth={0.7}
                                    />
                                    <text
                                      x={0}
                                      y={3}
                                      textAnchor="middle"
                                      className="fill-muted-foreground text-[7.5px] font-bold"
                                    >
                                      {isRtl ? "◄" : "►"}
                                    </text>
                                  </g>
                                );
                              })()}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>

              {/* 3. Leader Lines Layer */}
              <g id="leader-lines-layer" pointerEvents="none">
                {linesForZone.map((lineCfg) => {
                  const isLeft = lineCfg.labelSide === "left";
                  const isLineHovered = hoveredLineCode === lineCfg.code;
                  const isDimmed = hoveredLineCode && !isLineHovered;

                  let anchorX = lineCfg.zoneViewLayout.x;
                  const anchorY = lineCfg.zoneViewLayout.y + ZONE_BLOCK_SIZE.d / 2;
                  let pillX = lineCfg.zoneViewLayout.x - 2.2;

                  if (!isLeft) {
                    const lastMachineX =
                      lineCfg.zoneViewLayout.x + (lineCfg.machines.length - 1) * MACHINE_GAP;
                    anchorX = lastMachineX + ZONE_BLOCK_SIZE.w;
                    pillX = lastMachineX + 2.6;
                  }

                  const pAnchor = projectIso(anchorX, anchorY, 6, ZONE_ISO_SCALE);
                  const pPill = projectIso(pillX, anchorY, 6, ZONE_ISO_SCALE);

                  return (
                    <line
                      key={`zone-leader-${lineCfg.code}`}
                      x1={pPill.x}
                      y1={pPill.y}
                      x2={pAnchor.x}
                      y2={pAnchor.y}
                      stroke="var(--border)"
                      strokeWidth={isLineHovered ? 1.8 : 1.0}
                      strokeDasharray="2 2"
                      opacity={isDimmed ? 0.35 : 0.85}
                    />
                  );
                })}
              </g>

              {/* 4. Labels Layer (ALWAYS ON TOP — Static Geometry, No Transforms) */}
              <g id="labels-layer">
                {linesForZone.map((lineCfg) => {
                  const lineM = getMetrics(plantId, "line", lineCfg.code, resolved);
                  const lineOee = lineM.oee;
                  const lineTier = tierOf(lineOee);
                  const isLeft = lineCfg.labelSide === "left";
                  const isLineHovered = hoveredLineCode === lineCfg.code;
                  const isDimmed = hoveredLineCode && !isLineHovered;

                  let pillX = lineCfg.zoneViewLayout.x - 2.2;
                  const pillY = lineCfg.zoneViewLayout.y + ZONE_BLOCK_SIZE.d / 2;

                  if (!isLeft) {
                    const lastMachineX =
                      lineCfg.zoneViewLayout.x + (lineCfg.machines.length - 1) * MACHINE_GAP;
                    pillX = lastMachineX + 2.6;
                  }

                  const lp = projectIso(pillX, pillY, 6, ZONE_ISO_SCALE);

                  return (
                    <g key={`labels-group-${lineCfg.code}`} opacity={isDimmed ? 0.35 : 1}>
                      {/* Outward Line Header Pill: e.g. "TUP01 · 58%" */}
                      <g
                        transform={`translate(${lp.x}, ${lp.y})`}
                        className="cursor-pointer select-none"
                        onClick={() => handleLinePillClick(lineCfg.code)}
                        onMouseEnter={() => handleLineEnter(lineCfg.code)}
                        onMouseLeave={handleLineLeave}
                        pointerEvents="auto"
                      >
                        <rect
                          x={-42}
                          y={-14}
                          width={84}
                          height={28}
                          rx={14}
                          fill="var(--surface)"
                          stroke={isLineHovered ? "var(--primary)" : TIER_HEX[lineTier]}
                          strokeWidth={isLineHovered ? 2.2 : 1.5}
                        />
                        <text
                          x={0}
                          y={4.5}
                          textAnchor="middle"
                          className="fill-foreground font-mono text-[10.5px] font-bold"
                        >
                          {lineCfg.code} · {lineOee.toFixed(0)}%
                        </text>
                      </g>

                      {/* Machine Code Label Pills positioned above every machine block */}
                      {lineCfg.machines.map((mCfg, mIdx) => {
                        const blockX =
                          lineCfg.zoneViewLayout.x + (mCfg.offsetX ?? mIdx * MACHINE_GAP);
                        let blockY = lineCfg.zoneViewLayout.y + (mCfg.offsetY ?? 0);
                        if (mCfg.subRow === "top") blockY -= 0.85;

                        const mLabelPos = projectIso(
                          blockX + ZONE_BLOCK_SIZE.w / 2,
                          blockY + ZONE_BLOCK_SIZE.d / 2,
                          ZONE_BLOCK_SIZE.h + 12,
                          ZONE_ISO_SCALE,
                        );

                        const isHovered =
                          hoveredMachine?.lineCode === lineCfg.code &&
                          hoveredMachine?.machineCode === mCfg.code;
                        const isBottleneck = getBottleneck(plantId, lineCfg.code) === mCfg.code;

                        return (
                          <g
                            key={`m-label-${lineCfg.code}-${mCfg.code}-${mIdx}`}
                            transform={`translate(${mLabelPos.x}, ${mLabelPos.y})`}
                            pointerEvents="none"
                            className="select-none"
                          >
                            <rect
                              x={-24}
                              y={-8}
                              width={48}
                              height={16}
                              rx={8}
                              fill="var(--surface)"
                              fillOpacity={0.96}
                              stroke={
                                isHovered
                                  ? "var(--primary)"
                                  : isBottleneck
                                    ? "#5B3FD1"
                                    : "var(--border)"
                              }
                              strokeWidth={isHovered ? 1.5 : isBottleneck ? 1.4 : 0.85}
                              className="drop-shadow-xs"
                            />
                            <text
                              x={0}
                              y={3.5}
                              textAnchor="middle"
                              className="fill-foreground font-mono text-[8px] font-bold"
                            >
                              {mCfg.code}
                            </text>
                            {isBottleneck && (
                              <g transform="translate(0, -13)">
                                <rect x={-8} y={-4} width={16} height={9} rx={2} fill="#5B3FD1" />
                                <text
                                  x={0}
                                  y={3}
                                  textAnchor="middle"
                                  className="fill-white font-mono font-bold text-[6.5px]"
                                >
                                  BN
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        ) : (
          /* 2D Top-Down View for Zone */
          <svg
            viewBox={viewBox2D}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full bg-grid/10 select-none"
            role="img"
          >
            <g id="zone-scene-2d" ref={scene2dRef}>
              {linesForZone.map((lineCfg) => {
                const line = zone.lines.find((l) => l.id === lineCfg.code);

                if (lineCfg.code === "BOP15") {
                  return (
                    <Bop15ChainSprite
                      key={`2d-zone-line-${lineCfg.code}`}
                      layoutX={lineCfg.zoneViewLayout.x}
                      layoutY={lineCfg.zoneViewLayout.y}
                      blockW={ZONE_BLOCK_SIZE.w}
                      blockD={ZONE_BLOCK_SIZE.d}
                      gap={MACHINE_GAP}
                      isoScale={ZONE_ISO_SCALE}
                      statusSource={(code) =>
                        line?.machines.find((m) => m.code === code || m.id === code)?.status ??
                        "running"
                      }
                      hoveredMachine={
                        hoveredMachine?.lineCode === "BOP15" ? hoveredMachine.machineCode : null
                      }
                      selectedMachine={null}
                      onMachineHover={(mCode) => {
                        if (mCode) {
                          const m = line?.machines.find((m) => m.code === mCode || m.id === mCode);
                          const rect = containerRef.current?.getBoundingClientRect();
                          if (rect) {
                            setHoveredMachine({
                              lineCode: lineCfg.code,
                              machineCode: mCode,
                              machineName: m?.name ?? mCode,
                              zoneId: zone.id,
                              zoneName: zone.name,
                              lineOee: getMetrics(plantId, "line", lineCfg.code, resolved).oee,
                              machineOee: getMetrics(plantId, "machine", mCode, resolved).oee,
                              machineStatus: m?.status ?? "running",
                              clientX: 0,
                              clientY: 0,
                            });
                          }
                        } else {
                          handleLineLeave();
                        }
                      }}
                      onMachineClick={(mCode) => handleMachineClick(lineCfg.code, mCode)}
                      onLineLeave={handleLineLeave}
                      isDimmed={false}
                    />
                  );
                }

                return (
                  <g key={`2d-zone-line-${lineCfg.code}`}>
                    {/* Line Pill */}
                    <g
                      transform={`translate(${
                        lineCfg.labelSide === "left"
                          ? (lineCfg.zoneViewLayout.x - 1.4) * 44 + 65
                          : (lineCfg.zoneViewLayout.x +
                              (lineCfg.machines.length - 1) * MACHINE_GAP +
                              1.4) *
                              44 +
                            65
                      }, ${lineCfg.zoneViewLayout.y * 20 + 36})`}
                      className="cursor-pointer"
                      onClick={() => handleLinePillClick(lineCfg.code)}
                    >
                      <rect
                        x={-32}
                        y={-10}
                        width={64}
                        height={20}
                        rx={10}
                        fill="var(--surface)"
                        stroke={
                          TIER_HEX[tierOf(getMetrics(plantId, "line", lineCfg.code, resolved).oee)]
                        }
                        strokeWidth={1.4}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        className="fill-foreground font-mono text-[9.5px] font-bold"
                      >
                        {lineCfg.code}
                      </text>
                    </g>

                    {/* Machines */}
                    {lineCfg.machines.map((mCfg, mIdx) => {
                      const machine = line?.machines.find(
                        (m) => m.id === mCfg.code || m.code === mCfg.code,
                      );
                      const status = machine?.status ?? "running";

                      const blockX =
                        (lineCfg.zoneViewLayout.x + (mCfg.offsetX ?? mIdx * MACHINE_GAP)) * 44 + 65;
                      let blockY = (lineCfg.zoneViewLayout.y + (mCfg.offsetY ?? 0)) * 20 + 36;
                      if (mCfg.subRow === "top") blockY -= 15;

                      const isHovered =
                        hoveredMachine?.lineCode === lineCfg.code &&
                        hoveredMachine?.machineCode === mCfg.code;
                      const isBottleneck = getBottleneck(plantId, lineCfg.code) === mCfg.code;

                      return (
                        <g
                          key={`2d-zm-${lineCfg.code}-${mCfg.code}`}
                          className="cursor-pointer"
                          onClick={() => handleMachineClick(lineCfg.code, mCfg.code)}
                          onMouseEnter={(e) => {
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setHoveredMachine({
                                lineCode: lineCfg.code,
                                machineCode: mCfg.code,
                                machineName: machine?.name ?? mCfg.code,
                                zoneId: zone.id,
                                zoneName: zone.name,
                                lineOee: getMetrics(plantId, "line", lineCfg.code, resolved).oee,
                                machineOee: getMetrics(plantId, "machine", mCfg.code, resolved).oee,
                                machineStatus: status,
                                clientX: e.clientX - rect.left,
                                clientY: e.clientY - rect.top,
                              });
                            }
                          }}
                          onMouseLeave={handleLineLeave}
                        >
                          {isBottleneck && (
                            <rect
                              x={blockX - 22}
                              y={blockY - 13}
                              width={44}
                              height={26}
                              rx={5}
                              fill="none"
                              stroke="#5B3FD1"
                              strokeWidth={1.5}
                            />
                          )}
                          <rect
                            x={blockX - 20}
                            y={blockY - 11}
                            width={40}
                            height={22}
                            rx={4}
                            fill={STATUS_HEX[status]}
                            stroke={
                              isHovered ? "white" : isBottleneck ? "#5B3FD1" : "rgba(0,0,0,0.3)"
                            }
                            strokeWidth={isHovered ? 2 : 1}
                          />
                          <text
                            x={blockX}
                            y={blockY + 3.5}
                            textAnchor="middle"
                            className="fill-white font-mono text-[8.5px] font-bold pointer-events-none drop-shadow-xs"
                          >
                            {mCfg.code}
                          </text>
                          {isBottleneck && (
                            <g
                              transform={`translate(${blockX}, ${blockY - 17})`}
                              pointerEvents="none"
                            >
                              <rect x={-9} y={-5} width={18} height={10} rx={2} fill="#5B3FD1" />
                              <text
                                x={0}
                                y={3}
                                textAnchor="middle"
                                className="fill-white font-mono font-bold text-[7px]"
                              >
                                BN
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </ZoomableMap>

      {/* Hover Tooltip Offset away from cursor so it never steals pointer */}
      {hoveredMachine && (
        <div
          className="pointer-events-none absolute z-50 transition-opacity duration-100 select-none"
          style={{
            left: `${hoveredMachine.clientX + 16}px`,
            top: `${hoveredMachine.clientY + 16}px`,
          }}
        >
          <div className="flex min-w-[210px] flex-col gap-1.5 rounded-lg border border-border bg-surface/95 p-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-foreground">
                  {hoveredMachine.lineCode} · {hoveredMachine.machineCode}
                </span>
                <LineDataSourceChip plantId={plantId} lineId={hoveredMachine.lineCode} />
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  hoveredMachine.machineStatus === "running" &&
                    "bg-status-running/15 text-status-running",
                  hoveredMachine.machineStatus === "slow" && "bg-status-slow/20 text-status-slow",
                  hoveredMachine.machineStatus === "down" && "bg-status-down/15 text-status-down",
                  hoveredMachine.machineStatus === "idle" &&
                    "bg-status-idle/20 text-muted-foreground",
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", STATUS_DOT[hoveredMachine.machineStatus])}
                />
                {STATUS_LABEL[hoveredMachine.machineStatus]}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {hoveredMachine.machineName} ({hoveredMachine.zoneName})
              <span className="block text-[10px] text-muted-foreground/80 font-normal">
                {MODEL_REGISTRY[resolveModelKey(hoveredMachine.machineCode)]?.label ??
                  "Production Machine"}
              </span>
            </p>
            <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
              <span className="text-muted-foreground">PO</span>
              <span className="font-mono font-medium text-foreground">
                {getActivePO(plantId, hoveredMachine.lineCode)?.poNumber ?? PO_IDLE_PLACEHOLDER}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
              <span className="text-muted-foreground">PO Output</span>
              <span className="font-mono font-medium text-foreground">
                {(() => {
                  const po = getActivePO(plantId, hoveredMachine.lineCode);
                  return po
                    ? `= ${po.currentOutput.toLocaleString()} / ${po.totalMPQ.toLocaleString()}`
                    : "= - / -";
                })()}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
              <span className="text-muted-foreground">Machine OEE</span>
              <span
                className={cn("font-mono font-bold", TIER_TEXT[tierOf(hoveredMachine.machineOee)])}
              >
                {hoveredMachine.machineOee.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      <MapStatusLegendOverlay />
    </div>
  );
}
