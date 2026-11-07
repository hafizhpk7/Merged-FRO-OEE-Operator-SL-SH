import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type * as LeafletType from "leaflet";
import "leaflet/dist/leaflet.css";
import { RotateCcw, MapPin, X } from "lucide-react";

import { useApp } from "@/lib/oee/app-context";
import { PLANTS, PLANT_PHASE_LABELS, type Plant } from "@/lib/oee/data";
import { tierOf } from "@/lib/oee/config";
import type { EntityMetrics } from "@/lib/oee/metrics-engine";

// Named constants per requirements
export const MAP_CLUSTER_PX = 56;
export const MAP_FULL_CARD_DISTANCE_PX = 180;
export const MAP_FULL_CARD_MIN_ZOOM = 14;
export const MAP_FIT_PADDING = 60;
export const MAP_WHEEL_ZOOM = true;
export const MAP_MIN_ZOOM = 3;
export const MAP_MAX_ZOOM = 18;

export const TILE_URL_LIGHT = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_URL_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export const TILE_ATTRIBUTION_LIGHT =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
export const TILE_ATTRIBUTION_DARK =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

export const SESSION_MAP_VIEW_KEY = "oee_group_map_view_state";

export type PlantLineStats = {
  total: number;
  running: number;
  downOffline: number;
  down: number;
  slow: number;
  idle: number;
  totalMachines: number;
  downMachines: number;
};

interface GroupSiteMapProps {
  plantMetrics: Record<string, EntityMetrics>;
  plantStats: Record<string, PlantLineStats>;
  onSelectPlant: (plantId: string) => void;
}

type UpcomingPopoverState = {
  plant: Plant;
  x: number;
  y: number;
} | null;

/**
 * Interactive Open Map for Multi Plant View
 * Rendered with Leaflet 1.9.x, theme-aware tile layer, dynamic marker clustering,
 * full/compact/cluster marker forms, parity audit compliance, and session view persistence.
 */
export const GroupSiteMap = React.memo(function GroupSiteMap({
  plantMetrics,
  plantStats,
  onSelectPlant,
}: GroupSiteMapProps) {
  const { isDarkMode } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletType.Map | null>(null);
  const tileLayerRef = useRef<LeafletType.TileLayer | null>(null);
  const markersLayerRef = useRef<LeafletType.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LeafletType | null>(null);
  const [activeUpcomingPopover, setActiveUpcomingPopover] = useState<UpcomingPopoverState>(null);

  // Store callbacks in refs to avoid recreating markers on callback reference changes
  const onSelectPlantRef = useRef(onSelectPlant);
  onSelectPlantRef.current = onSelectPlant;

  const plantMetricsRef = useRef(plantMetrics);
  plantMetricsRef.current = plantMetrics;

  const plantStatsRef = useRef(plantStats);
  plantStatsRef.current = plantStats;

  const isDarkModeRef = useRef(isDarkMode);
  isDarkModeRef.current = isDarkMode;

  // Compute all plant bounding box for initial fit and reset
  const allCoordinates = useMemo(() => PLANTS.map((p) => p.coordinates as [number, number]), []);

  // Re-cluster and update markers on zoom/move or data change
  const renderMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const L = leafletRef.current;
    if (!map || !markersLayer || !L) return;

    markersLayer.clearLayers();

    const zoom = map.getZoom();

    // Map each plant to screen container point
    const points = PLANTS.map((p) => {
      const latLng = L.latLng(p.coordinates[0], p.coordinates[1]);
      const pt = map.latLngToContainerPoint(latLng);
      return { plant: p, latLng, pt };
    });

    // Connected-component clustering within MAP_CLUSTER_PX
    const visited = new Set<string>();
    const clusters: {
      plants: Plant[];
      latLngs: LeafletType.LatLng[];
      centerPt: { x: number; y: number };
    }[] = [];

    for (const item of points) {
      if (visited.has(item.plant.id)) continue;
      const members = [item.plant];
      const memberLatLngs = [item.latLng];
      visited.add(item.plant.id);

      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const other of points) {
          if (visited.has(other.plant.id)) continue;
          const isNearby = members.some((m) => {
            const mPt = points.find((x) => x.plant.id === m.id)!.pt;
            const dist = Math.hypot(mPt.x - other.pt.x, mPt.y - other.pt.y);
            return dist < MAP_CLUSTER_PX;
          });
          if (isNearby) {
            members.push(other.plant);
            memberLatLngs.push(other.latLng);
            visited.add(other.plant.id);
            expanded = true;
          }
        }
      }

      const mPoints = members.map((m) => points.find((x) => x.plant.id === m.id)!.pt);
      const avgX = mPoints.reduce((acc, p) => acc + p.x, 0) / mPoints.length;
      const avgY = mPoints.reduce((acc, p) => acc + p.y, 0) / mPoints.length;

      clusters.push({
        plants: members,
        latLngs: memberLatLngs,
        centerPt: { x: avgX, y: avgY },
      });
    }

    // Render markers for each cluster
    for (const cluster of clusters) {
      if (cluster.plants.length > 1) {
        // --- CLUSTER MARKER ---
        const centerLatLng = L.latLngBounds(cluster.latLngs).getCenter();
        const count = cluster.plants.length;
        const plantNames = cluster.plants.map((p) => p.name).join(", ");

        const clusterHtml = `
          <div
            tabindex="0"
            role="button"
            aria-label="${count} plants cluster: ${plantNames}. Click to zoom in."
            class="group relative flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
            style="width: 48px; height: 48px;"
          >
            <div class="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-60 pointer-events-none"></div>
            <div class="relative flex flex-col items-center justify-center size-12 rounded-full border-2 border-white/90 bg-primary shadow-xl text-primary-foreground font-sans transition-transform duration-150 group-hover:scale-110">
              <span class="text-sm font-black leading-none">${count}</span>
              <span class="text-[9px] font-bold uppercase tracking-tighter opacity-90">plants</span>
            </div>
          </div>
        `;

        const clusterIcon = L.divIcon({
          html: clusterHtml,
          className: "leaflet-plant-cluster-icon",
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });

        const clusterMarker = L.marker(centerLatLng, {
          icon: clusterIcon,
          keyboard: false,
          zIndexOffset: 100,
        });

        clusterMarker.on("click", () => {
          map.fitBounds(L.latLngBounds(cluster.latLngs), {
            padding: [MAP_FIT_PADDING, MAP_FIT_PADDING],
            maxZoom: 17,
          });
        });

        markersLayer.addLayer(clusterMarker);
      } else {
        // --- SINGLE PLANT MARKER ---
        const plant = cluster.plants[0];
        const latLng = cluster.latLngs[0];
        const isOperational = plant.isOperational;
        const currentMetrics = plantMetricsRef.current[plant.id];
        const stats = plantStatsRef.current[plant.id] ?? {
          total: 0,
          running: 0,
          downOffline: 0,
          down: 0,
          slow: 0,
          idle: 0,
          totalMachines: 0,
          downMachines: 0,
        };

        const oeeVal = isOperational && currentMetrics ? currentMetrics.oee : 0;
        const tier = tierOf(oeeVal);

        // Calculate distance to nearest other plant marker on screen
        const otherDistances = points
          .filter((p) => p.plant.id !== plant.id)
          .map((p) => {
            const thisPt = points.find((x) => x.plant.id === plant.id)!.pt;
            return Math.hypot(thisPt.x - p.pt.x, thisPt.y - p.pt.y);
          });
        const nearestOtherDist = otherDistances.length > 0 ? Math.min(...otherDistances) : 9999;

        const isFullCard =
          isOperational &&
          zoom >= MAP_FULL_CARD_MIN_ZOOM &&
          nearestOtherDist >= MAP_FULL_CARD_DISTANCE_PX;

        let markerHtml = "";
        let iconSize: [number, number] = [180, 70];
        let iconAnchor: [number, number] = [90, 70];

        if (!isOperational) {
          // --- UPCOMING PLANT (Klang, Batang) ---
          const phaseLabel = PLANT_PHASE_LABELS[plant.phase] ?? "Under Planning";
          markerHtml = `
            <div
              tabindex="0"
              role="button"
              aria-label="${plant.name} · ${phaseLabel} · Operational data is not available yet"
              title="${plant.region}"
              class="group relative flex flex-col items-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground/60 rounded-md"
              style="width: 170px;"
            >
              <div class="flex flex-col gap-0.5 rounded-lg border border-dashed border-muted-foreground/50 bg-background/95 p-2 shadow-lg backdrop-blur-md transition-all duration-150 group-hover:border-muted-foreground group-hover:bg-background group-hover:shadow-xl w-full text-left">
                <div class="flex items-center justify-between gap-1">
                  <span class="truncate font-semibold text-xs tracking-tight text-foreground/80">${plant.name}</span>
                  <span class="rounded bg-muted/80 px-1 py-0.2 font-mono text-[9px] font-medium text-muted-foreground shrink-0">${phaseLabel}</span>
                </div>
                <div class="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/50">
                  <span class="truncate font-sans">${plant.block}</span>
                  <span class="font-mono text-[10px] font-semibold text-muted-foreground/90">OEE —</span>
                </div>
              </div>
              <div class="w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-muted-foreground/60 -mt-[1px]"></div>
              <div class="size-2.5 rounded-full border-2 border-dashed border-muted-foreground/90 bg-muted/60 mt-0.5 ring-2 ring-muted-foreground/20"></div>
            </div>
          `;
          iconSize = [170, 68];
          iconAnchor = [85, 68];
        } else if (isFullCard) {
          // --- FULL CARD FORM (Zoom >= 14 & Distance >= 180px) ---
          const tierBgClass =
            tier === "good"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : tier === "warn"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";

          markerHtml = `
            <div
              tabindex="0"
              role="button"
              aria-label="${plant.name} · OEE ${oeeVal.toFixed(1)}% · Click to view plant"
              class="group relative flex flex-col items-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
              style="width: 200px;"
            >
              <div class="flex flex-col gap-1.5 rounded-lg border border-border/90 bg-background/95 p-2.5 shadow-2xl backdrop-blur-md transition-all duration-150 group-hover:border-primary group-hover:bg-background group-hover:shadow-2xl w-full text-left">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1 min-w-0">
                    <span class="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0"></span>
                    <span class="truncate font-bold text-xs tracking-tight text-foreground">${plant.name}</span>
                  </div>
                  <span
                    data-metric="plant-oee-${plant.id}"
                    data-raw="${oeeVal}"
                    class="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${tierBgClass} shrink-0"
                  >
                    ${oeeVal.toFixed(1)}%
                  </span>
                </div>
                <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  <span class="font-mono text-[10px]">${plant.block}</span>
                  <span class="font-medium text-foreground">${stats.running}/${stats.total} Lines</span>
                  <span class="font-mono text-[10px] ${stats.downMachines > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-600 dark:text-emerald-400"}">
                    ${stats.downMachines > 0 ? `${stats.downMachines} Down` : "0 Down"}
                  </span>
                </div>
                <div class="flex items-center justify-between text-[9px] font-medium text-primary pt-0.5 border-t border-border/40">
                  <span>Click to drill in</span>
                  <span>→</span>
                </div>
              </div>
              <div class="w-0 h-0 border-x-[6px] border-x-transparent border-t-[7px] border-t-primary/80 group-hover:border-t-primary -mt-[1px]"></div>
              <div class="size-3 rounded-full border-2 border-white bg-primary shadow-md mt-0.5 ring-2 ring-primary/40"></div>
            </div>
          `;
          iconSize = [200, 106];
          iconAnchor = [100, 106];
        } else {
          // --- COMPACT FORM (Low zoom / close proximity) ---
          const tierPillClass =
            tier === "good"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : tier === "warn"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";

          markerHtml = `
            <div
              tabindex="0"
              role="button"
              aria-label="${plant.name} · OEE ${oeeVal.toFixed(1)}% · Click to view plant"
              class="group relative flex flex-col items-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
              style="width: 150px;"
            >
              <div class="flex items-center gap-1.5 rounded-full border border-border/90 bg-background/95 px-2.5 py-1 shadow-lg backdrop-blur-md transition-all duration-150 group-hover:border-primary group-hover:bg-background group-hover:scale-105">
                <span class="size-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0"></span>
                <span class="truncate font-semibold text-[11px] tracking-tight text-foreground max-w-[70px]">${plant.name}</span>
                <span
                  data-metric="plant-oee-${plant.id}"
                  data-raw="${oeeVal}"
                  class="rounded-full px-1.5 py-0.2 font-mono text-[9px] font-bold border ${tierPillClass} shrink-0"
                >
                  ${oeeVal.toFixed(1)}%
                </span>
              </div>
              <div class="w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-primary/80 group-hover:border-t-primary -mt-[1px]"></div>
              <div class="size-2.5 rounded-full border-2 border-white bg-primary shadow mt-0.5 ring-2 ring-primary/40"></div>
            </div>
          `;
          iconSize = [150, 48];
          iconAnchor = [75, 48];
        }

        const icon = L.divIcon({
          html: markerHtml,
          className: "leaflet-plant-marker-icon",
          iconSize,
          iconAnchor,
        });

        const marker = L.marker(latLng, {
          icon,
          keyboard: false,
          zIndexOffset: isOperational ? 200 : 50,
        });

        if (isOperational) {
          marker.on("click", () => {
            onSelectPlantRef.current(plant.id);
          });
        } else {
          marker.on("click", (e) => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const mouseX = (e.originalEvent as MouseEvent).clientX - rect.left;
            const mouseY = (e.originalEvent as MouseEvent).clientY - rect.top;
            setActiveUpcomingPopover({
              plant,
              x: Math.max(12, Math.min(mouseX - 130, rect.width - 280)),
              y: Math.max(12, Math.min(mouseY - 90, rect.height - 120)),
            });
          });
        }

        markersLayer.addLayer(marker);
      }
    }
  }, []);

  // Initialize Leaflet map on client mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapInstanceRef.current || typeof window === "undefined") return;

    let isCancelled = false;

    import("leaflet").then((leafletModule) => {
      if (isCancelled || !containerRef.current) return;
      const L = (leafletModule.default ?? leafletModule) as typeof LeafletType;
      leafletRef.current = L;

      // Check for saved center & zoom from session storage
      let initialCenter: [number, number] = [-4.0, 105.0];
      let initialZoom = 6;
      let hasSavedState = false;

      try {
        const saved = sessionStorage.getItem(SESSION_MAP_VIEW_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            typeof parsed.lat === "number" &&
            typeof parsed.lng === "number" &&
            typeof parsed.zoom === "number"
          ) {
            initialCenter = [parsed.lat, parsed.lng];
            initialZoom = parsed.zoom;
            hasSavedState = true;
          }
        }
      } catch {
        // fallback
      }

      // Initialize Leaflet Map
      const map = L.map(container, {
        center: initialCenter,
        zoom: initialZoom,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        scrollWheelZoom: MAP_WHEEL_ZOOM,
        doubleClickZoom: true,
        zoomControl: false,
        attributionControl: true,
      });

      mapInstanceRef.current = map;

      // Scale control (metric only, bottom-left per §2.7)
      L.control
        .scale({
          imperial: false,
          metric: true,
          position: "bottomleft",
        })
        .addTo(map);

      // Initial tile layer based on current theme
      const tileUrl = isDarkModeRef.current ? TILE_URL_DARK : TILE_URL_LIGHT;
      const tileAttribution = isDarkModeRef.current
        ? TILE_ATTRIBUTION_DARK
        : TILE_ATTRIBUTION_LIGHT;
      const tileLayer = L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Marker Layer Group
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      // Fit bounds if no session state
      if (!hasSavedState) {
        const bounds = L.latLngBounds(allCoordinates);
        map.fitBounds(bounds, {
          padding: [MAP_FIT_PADDING, MAP_FIT_PADDING],
        });
      }

      const handleMoveEnd = () => {
        try {
          const c = map.getCenter();
          const z = map.getZoom();
          sessionStorage.setItem(
            SESSION_MAP_VIEW_KEY,
            JSON.stringify({ lat: c.lat, lng: c.lng, zoom: z }),
          );
        } catch {
          // ignore
        }
        renderMarkers();
      };

      map.on("moveend", handleMoveEnd);
      map.on("zoomend", handleMoveEnd);

      renderMarkers();
    });

    let animFrame: number;
    const ro = new ResizeObserver(() => {
      animFrame = requestAnimationFrame(() => {
        mapInstanceRef.current?.invalidateSize();
      });
    });
    ro.observe(container);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animFrame);
      ro.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, [allCoordinates, renderMarkers]);

  // Theme change tile update without recreating the map
  useEffect(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;

    const nextUrl = isDarkMode ? TILE_URL_DARK : TILE_URL_LIGHT;
    tileLayer.setUrl(nextUrl);
  }, [isDarkMode]);

  // Update marker icons and DOM attributes when live telemetry or period changes
  useEffect(() => {
    renderMarkers();
  }, [plantMetrics, plantStats, renderMarkers]);

  // Zoom handlers
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleResetView = () => {
    try {
      sessionStorage.removeItem(SESSION_MAP_VIEW_KEY);
    } catch {
      // ignore
    }
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    const bounds = L.latLngBounds(allCoordinates);
    map.fitBounds(bounds, {
      padding: [MAP_FIT_PADDING, MAP_FIT_PADDING],
    });
  };

  return (
    <div
      style={{
        position: "relative",
        zIndex: 0,
        isolation: "isolate",
      }}
      className="relative w-full rounded-b-lg overflow-hidden bg-muted/20 select-none"
    >
      {/* Map Canvas */}
      <div
        ref={containerRef}
        className="w-full h-[clamp(520px,62vh,720px)] bg-slate-900/5 dark:bg-slate-950/40"
      />

      {/* Top-Right Custom Controls (§2.3) */}
      <div className="pointer-events-auto absolute top-3.5 right-3.5 z-[500] flex flex-col items-end gap-1.5">
        <div className="flex items-center rounded-md border border-border bg-background/95 p-0.5 shadow-md backdrop-blur">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="flex size-7 items-center justify-center rounded text-foreground hover:bg-muted text-sm font-semibold transition-colors cursor-pointer"
          >
            +
          </button>
          <div className="h-4 w-px bg-border/80" />
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="flex size-7 items-center justify-center rounded text-foreground hover:bg-muted text-sm font-semibold transition-colors cursor-pointer"
          >
            −
          </button>
        </div>
        <button
          type="button"
          onClick={handleResetView}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-md hover:bg-muted transition-colors cursor-pointer backdrop-blur"
        >
          <RotateCcw className="size-3 text-muted-foreground" />
          Reset view
        </button>
      </div>

      {/* Bottom-Left Legend (§2.7) */}
      <div className="pointer-events-none absolute bottom-9 left-3 z-[500] flex items-center gap-2.5 rounded-md border border-border/80 bg-background/90 px-2.5 py-1 text-[11px] shadow-sm backdrop-blur select-none">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          <span>Operational</span>
        </div>
        <span className="text-muted-foreground/60">·</span>
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <span className="size-2 rounded-full border border-dashed border-muted-foreground bg-transparent" />
          <span>Under planning / construction</span>
        </div>
      </div>

      {/* Popover on click for Upcoming Plants (§2.5) */}
      {activeUpcomingPopover && (
        <div
          className="absolute z-[600] flex flex-col gap-1.5 rounded-lg border border-border bg-background/98 p-3 shadow-2xl backdrop-blur text-xs ring-1 ring-border max-w-[270px]"
          style={{
            left: `${activeUpcomingPopover.x}px`,
            top: `${activeUpcomingPopover.y}px`,
          }}
        >
          <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <MapPin className="size-3.5 text-muted-foreground shrink-0" />
              <span>{activeUpcomingPopover.plant.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveUpcomingPopover(null)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="space-y-1 text-muted-foreground text-[11px]">
            <p className="font-semibold text-foreground/90">
              {PLANT_PHASE_LABELS[activeUpcomingPopover.plant.phase]}
            </p>
            <p>{activeUpcomingPopover.plant.region}</p>
            <p className="text-muted-foreground/80 italic pt-0.5">
              Operational data is not available yet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
