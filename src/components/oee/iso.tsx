/**
 * Lightweight isometric SVG primitives. The After mockups use rendered 3D
 * illustrations; for a clickable prototype a simplified isometric SVG carries the
 * same information (position, status colour, label) — see §8.
 */
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

import { STATUS_DOT, STATUS_LABEL, TIER_TEXT, tierOf, type Status } from "@/lib/oee/config";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3;
const DRAG_THRESHOLD = 5;

type ViewTransform = { scale: number; x: number; y: number };
type DragState = {
  pointerId: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  moved: boolean;
};

export function ZoomableMap({ children, className }: { children: ReactNode; className?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  const draggedRef = useRef(false);
  const [transform, setTransform] = useState<ViewTransform>(transformRef.current);
  const [dragging, setDragging] = useState(false);

  const commit = useCallback((next: ViewTransform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  const zoomAt = useCallback(
    (nextScale: number, px: number, py: number) => {
      const current = transformRef.current;
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextScale));
      const ratio = scale / current.scale;
      commit({
        scale,
        x: px - (px - current.x) * ratio,
        y: py - (py - current.y) * ratio,
      });
    },
    [commit],
  );

  const zoomFromCenter = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    zoomAt(
      transformRef.current.scale * factor,
      viewport.clientWidth / 2,
      viewport.clientHeight / 2,
    );
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      zoomAt(
        transformRef.current.scale * Math.exp(-delta * 0.0015),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  // Pan only starts after the pointer moves past a small threshold, so simple
  // clicks still reach the map's SVG nodes and trigger drill-down navigation.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      setDragging(true);
      if (viewportRef.current?.hasPointerCapture(event.pointerId) === false) {
        viewportRef.current.setPointerCapture(event.pointerId);
      }
    }
    commit({ ...transformRef.current, x: drag.originX + dx, y: drag.originY + dy });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    draggedRef.current = drag.moved;
    dragRef.current = null;
    setDragging(false);
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={viewportRef}
      className={cn("relative h-full min-h-[380px] w-full touch-none overflow-hidden", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(event) => {
        // swallow the click that ends a real pan gesture, allow plain clicks
        if (draggedRef.current) {
          draggedRef.current = false;
          event.stopPropagation();
          event.preventDefault();
        }
      }}
    >
      <div
        className={cn(
          "absolute inset-0 h-full w-full origin-top-left",
          dragging
            ? "cursor-grabbing"
            : "cursor-grab transition-transform duration-200 ease-in-out",
        )}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {children}
      </div>
      <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-md">
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          className="grid size-9 place-items-center text-foreground transition-colors hover:bg-muted"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => zoomFromCenter(1.2)}
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Reset map view"
          title="Reset map view"
          className="grid size-9 place-items-center border-y border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => commit({ scale: 1, x: 0, y: 0 })}
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          className="grid size-9 place-items-center text-foreground transition-colors hover:bg-muted"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => zoomFromCenter(1 / 1.2)}
        >
          <Minus className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function iso(x: number, y: number, h: number, s: number) {
  return { x: (x - y) * s * 0.866, y: (x + y) * s * 0.5 - h };
}

export function IsoBlock({
  x,
  y,
  w = 1,
  d = 1,
  h = 14,
  s = 26,
  color,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  dim,
  hovered,
  className,
}: {
  x: number;
  y: number;
  w?: number;
  d?: number;
  h?: number;
  s?: number;
  color: string;
  onClick?: () => void;
  onMouseEnter?: (e: React.MouseEvent<SVGGElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<SVGGElement>) => void;
  onMouseMove?: (e: React.MouseEvent<SVGGElement>) => void;
  dim?: boolean;
  hovered?: boolean;
  className?: string;
}) {
  const t1 = iso(x, y, h, s);
  const t2 = iso(x + w, y, h, s);
  const t3 = iso(x + w, y + d, h, s);
  const t4 = iso(x, y + d, h, s);
  const b4 = iso(x, y + d, 0, s);
  const b3 = iso(x + w, y + d, 0, s);
  const b2 = iso(x + w, y, 0, s);
  const pts = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(" ");
  const isInteractive = Boolean(onClick || onMouseEnter || onMouseMove);

  return (
    <g
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      className={cn(
        isInteractive &&
          "cursor-pointer transition-all duration-150 hover:brightness-115 hover:[&>polygon]:stroke hover:[&>polygon]:stroke-white/70 hover:[&>polygon]:stroke-[0.8]",
        hovered &&
          "brightness-120 [&>polygon]:stroke [&>polygon]:stroke-white/80 [&>polygon]:stroke-[1]",
        className,
      )}
      style={hovered ? { filter: "brightness(1.18)" } : undefined}
      opacity={dim ? 0.5 : 1}
    >
      <polygon
        points={pts([t1, t2, t3, t4])}
        fill={color}
        stroke={hovered ? "rgba(255,255,255,0.7)" : undefined}
        strokeWidth={hovered ? 0.75 : undefined}
      />
      <polygon
        points={pts([t4, t3, b3, b4])}
        fill={color}
        style={{ filter: "brightness(0.78)" }}
        stroke={hovered ? "rgba(255,255,255,0.55)" : undefined}
        strokeWidth={hovered ? 0.75 : undefined}
      />
      <polygon
        points={pts([t2, t3, b3, b2])}
        fill={color}
        style={{ filter: "brightness(0.6)" }}
        stroke={hovered ? "rgba(255,255,255,0.4)" : undefined}
        strokeWidth={hovered ? 0.75 : undefined}
      />
    </g>
  );
}

export type MapTooltipInfo = {
  title: string;
  subtitle?: string;
  po?: string;
  poOutput?: string;
  status?: Status;
  statusLabel?: string;
  oee: number;
  x: number;
  y: number;
};

export function MapHoverTooltip({ info }: { info: MapTooltipInfo | null }) {
  if (!info) return null;
  const tier = tierOf(info.oee);
  const isNearTop = info.y < 110;

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-50 -translate-x-1/2 transition-opacity duration-150 ease-out select-none",
        isNearTop ? "translate-y-4" : "-translate-y-[calc(100%+14px)]",
      )}
      style={{ left: `${info.x}px`, top: `${info.y}px` }}
    >
      <div className="flex min-w-[200px] flex-col gap-1.5 rounded-lg border border-border bg-surface/95 p-3 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-2.5">
          <span className="font-mono text-xs font-semibold tracking-tight text-foreground">
            {info.title}
          </span>
          {info.status && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                info.status === "running" && "bg-status-running/15 text-status-running",
                info.status === "slow" && "bg-status-slow/20 text-status-slow",
                info.status === "down" && "bg-status-down/15 text-status-down",
                info.status === "idle" && "bg-status-idle/20 text-muted-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", STATUS_DOT[info.status])} />
              {info.statusLabel ?? STATUS_LABEL[info.status]}
            </span>
          )}
        </div>
        {info.subtitle && <p className="text-[10px] text-muted-foreground">{info.subtitle}</p>}
        <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
          <span className="text-muted-foreground">PO</span>
          <span className="font-mono font-medium text-foreground">{info.po ?? "-"}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
          <span className="text-muted-foreground">PO Output</span>
          <span className="font-mono font-medium text-foreground">
            {info.poOutput
              ? info.poOutput.startsWith("=")
                ? info.poOutput
                : `= ${info.poOutput}`
              : "= - / -"}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/70 pt-1 text-[11px]">
          <span className="text-muted-foreground">Current OEE</span>
          <span className={cn("font-mono font-bold", TIER_TEXT[tier])}>{info.oee.toFixed(1)}%</span>
        </div>
      </div>
      {/* Tooltip caret */}
      <div
        className={cn(
          "mx-auto size-0 border-x-4 border-x-transparent",
          isNearTop
            ? "-order-1 -mt-1 mb-0 border-b-4 border-b-border"
            : "border-t-4 border-t-border",
        )}
      />
    </div>
  );
}

export function IsoBottleneckMarker({
  x,
  y,
  h = 24,
  s = 26,
}: {
  x: number;
  y: number;
  h?: number;
  s?: number;
}) {
  const p = iso(x, y, h, s);
  return (
    <g transform={`translate(${p.x}, ${p.y - 16})`} pointerEvents="none">
      {/* Base indigo anchor ring */}
      <ellipse cx={0} cy={16} rx={7} ry={3.5} fill="none" stroke="#5B3FD1" strokeWidth={1.5} />
      {/* BN Badge */}
      <rect
        x={-11}
        y={-1}
        width={22}
        height={13}
        rx={3}
        fill="#5B3FD1"
        stroke="#FFFFFF"
        strokeWidth={0.75}
        className="shadow-sm"
      />
      <text x={0} y={8.5} textAnchor="middle" className="fill-white font-mono font-bold text-[8px]">
        BN
      </text>
    </g>
  );
}

export function MapStatusLegendOverlay({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useState(true);

  if (collapsed) {
    return (
      <div
        className={cn("pointer-events-auto absolute bottom-3 left-3 z-10 select-none", className)}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur hover:text-foreground hover:bg-surface cursor-pointer"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          <span>Status Legend</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto absolute bottom-3 left-3 z-10 max-w-[280px] rounded-md border border-border bg-background/95 p-3 text-xs shadow-md backdrop-blur transition-all duration-200 select-none",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>Machine Status Legend</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-[10px] text-primary hover:underline cursor-pointer"
        >
          hide
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-1.5 text-[11px] leading-snug">
        <div className="flex items-start gap-2">
          <span className="mt-1 size-2 rounded-full bg-status-running ring-1 ring-status-running/30 shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Green (Running):</span>{" "}
            <span className="text-muted-foreground">
              Machine running, output matches standard speed.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 size-2 rounded-full bg-status-slow ring-1 ring-status-slow/30 shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Orange (Speed Loss):</span>{" "}
            <span className="text-muted-foreground">
              Machine running, output below standard speed.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 size-2 rounded-full bg-loss-minor-stop ring-1 ring-loss-minor-stop/30 shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Yellow (Minor Stop):</span>{" "}
            <span className="text-muted-foreground">
              Machine running, no output for 10 min or less.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 size-2 rounded-full bg-status-down ring-1 ring-status-down/30 shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Red (Breakdown):</span>{" "}
            <span className="text-muted-foreground">
              Machine running, no output for more than 10 min.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 size-2 rounded-full bg-status-idle ring-1 ring-status-idle/30 shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Gray (Off):</span>{" "}
            <span className="text-muted-foreground">Machine off or no schedule.</span>
          </div>
        </div>
        <div className="flex items-start gap-2 border-t border-border/60 pt-1.5">
          <span className="mt-0.5 inline-flex items-center justify-center size-3.5 rounded bg-[#5B3FD1] text-white text-[8px] font-mono font-bold shrink-0">
            BN
          </span>
          <div>
            <span className="font-semibold text-foreground">
              Bottleneck machine (sets Line OEE)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IsoScene({
  children,
  viewBox = "-320 -140 640 420",
  className,
}: {
  children: ReactNode;
  viewBox?: string;
  className?: string;
}) {
  return (
    <svg viewBox={viewBox} className={className ?? "h-full w-full"} role="img">
      {children}
    </svg>
  );
}

export function IsoGround({ cols, rows, s = 26 }: { cols: number; rows: number; s?: number }) {
  const a = iso(0, 0, 0, s);
  const b = iso(cols, 0, 0, s);
  const c = iso(cols, rows, 0, s);
  const d = iso(0, rows, 0, s);
  return (
    <polygon
      points={[a, b, c, d].map((p) => `${p.x},${p.y}`).join(" ")}
      fill="var(--grid)"
      opacity={0.6}
    />
  );
}

export function IsoChip({
  x,
  y,
  s = 26,
  h = 30,
  label,
  value,
  color,
}: {
  x: number;
  y: number;
  s?: number;
  h?: number;
  label: string;
  value?: string;
  color?: string;
}) {
  const p = iso(x, y, h, s);
  const text = value ? `${label} · ${value}` : label;
  const w = text.length * 5.6 + 12;
  return (
    <g transform={`translate(${p.x - w / 2}, ${p.y - 14})`} pointerEvents="none">
      <rect
        width={w}
        height={15}
        rx={7.5}
        fill="var(--surface)"
        stroke={color ?? "var(--border)"}
      />
      <text
        x={w / 2}
        y={10.5}
        textAnchor="middle"
        className="fill-foreground font-mono"
        style={{ fontSize: 8.5 }}
      >
        {text}
      </text>
    </g>
  );
}

export function Compass() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-center text-[9px] uppercase tracking-widest text-muted-foreground">
      <span>N</span>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M9 1 L12 12 L9 9.5 L6 12 Z" fill="currentColor" opacity="0.6" />
      </svg>
    </div>
  );
}
