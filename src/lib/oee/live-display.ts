import { useEffect, useMemo, useState } from "react";

import { GROUP, PLANTS, getLine, getMachine, getPlant, getZone, type Line } from "./data";
import type { PeriodId } from "./filters";
import { rand } from "./rng";
import type { Status } from "./config";
import { useApp } from "./app-context";
import { getLineBottleneck, getMetrics, type EntityMetrics } from "./metrics-engine";
import { getNow } from "./shiftClock";

export type LiveMetrics = {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
};

export type MetricDeltas = {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
};

export function clampPercentage(value: number) {
  return Math.min(99.9, Math.max(0, Math.round(value * 10) / 10));
}

/**
 * Real-time live clock that ticks continuously every second.
 * Avoids SSR hydration mismatch by only enabling client ticking after mount.
 */
export function useLiveClock(period?: PeriodId | string): string | null {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;
    setMounted(true);
    setNow(getNow());
    const timer = window.setInterval(() => {
      if (isMounted) {
        setNow(getNow());
      }
    }, 1_000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!mounted || !now) return null;

  const day = String(now.getDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[now.getMonth()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${day}-${month} ${hh}:${mm}:${ss}`;
}

/**
 * Section 1.2: Dynamic comparison context text for KPI comparison rows.
 * Replaces "Compared to 30s ago" everywhere with standard period comparison windows.
 */
export function comparisonContext(period?: PeriodId | string): string {
  switch (period) {
    case "this-shift":
    case "live":
    case "last-shift":
      return "vs last shift";
    case "today":
    case "yesterday":
      return "vs yesterday";
    case "this-week":
    case "last-week":
      return "vs last week";
    case "this-month":
      return "vs last month";
    case "custom":
      return "vs previous period";
    default:
      return "vs last shift";
  }
}

/**
 * LEVEL 1: Group Site Map (Multi-Plant View)
 * Driven by unified metrics engine and shared live tick.
 */
export function useLiveGroupState(period?: PeriodId | string) {
  const { resolvedPeriod, liveTick, isLiveUpdating } = useApp();

  const groupMetrics = useMemo(
    () => getMetrics("all", "group", "group", resolvedPeriod, liveTick),
    [resolvedPeriod, liveTick],
  );

  const plantMetricsMap = useMemo(() => {
    const map: Record<string, EntityMetrics> = {};
    for (const p of PLANTS) {
      map[p.id] = getMetrics(p.id, "plant", p.id, resolvedPeriod, liveTick);
    }
    return map;
  }, [resolvedPeriod, liveTick]);

  const group: LiveMetrics = {
    oee: groupMetrics.oee,
    availability: groupMetrics.availability,
    performance: groupMetrics.performance,
    quality: groupMetrics.quality,
  };

  const plants = useMemo(() => {
    const map: Record<string, LiveMetrics> = {};
    for (const p of PLANTS) {
      const pm = plantMetricsMap[p.id];
      map[p.id] = {
        oee: pm.oee,
        availability: pm.availability,
        performance: pm.performance,
        quality: pm.quality,
      };
    }
    return map;
  }, [plantMetricsMap]);

  const groupDeltas: MetricDeltas = groupMetrics.deltas;

  const plantDeltas = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of PLANTS) {
      map[p.id] = plantMetricsMap[p.id].deltas.oee;
    }
    return map;
  }, [plantMetricsMap]);

  return {
    group,
    plants,
    groupMetrics,
    plantMetricsMap,
    groupDeltas,
    plantDeltas,
    isUpdating: isLiveUpdating,
    compareLabel: resolvedPeriod.compareLabel,
  };
}

/**
 * LEVEL 2: Plant View (Zone Map)
 * Driven by unified metrics engine and shared live tick.
 */
export function useLivePlantState(period: PeriodId | string, plantId: string) {
  const { resolvedPeriod, liveTick, isLiveUpdating } = useApp();
  const basePlant = useMemo(() => getPlant(plantId), [plantId]);

  const plantMetrics = useMemo(
    () => getMetrics(plantId, "plant", plantId, resolvedPeriod, liveTick),
    [plantId, resolvedPeriod, liveTick],
  );

  const zoneMetricsMap = useMemo(() => {
    const map: Record<string, EntityMetrics> = {};
    if (basePlant) {
      for (const z of basePlant.zones) {
        map[z.id] = getMetrics(plantId, "zone", z.id, resolvedPeriod, liveTick);
      }
    }
    return map;
  }, [basePlant, plantId, resolvedPeriod, liveTick]);

  const plant: LiveMetrics = {
    oee: plantMetrics.oee,
    availability: plantMetrics.availability,
    performance: plantMetrics.performance,
    quality: plantMetrics.quality,
  };

  const zones = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        lines: Line[];
        oee: number;
        availability: number;
        performance: number;
        quality: number;
      }
    > = {};
    if (basePlant) {
      for (const z of basePlant.zones) {
        const zm = zoneMetricsMap[z.id];
        map[z.id] = {
          name: z.name,
          lines: z.lines,
          oee: zm?.oee ?? z.oee,
          availability: zm?.availability ?? z.availability,
          performance: zm?.performance ?? z.performance,
          quality: zm?.quality ?? z.quality,
        };
      }
    }
    return map;
  }, [basePlant, zoneMetricsMap]);

  return {
    plant,
    zones,
    plantMetrics,
    zoneMetricsMap,
    plantDeltas: plantMetrics.deltas,
    isUpdating: isLiveUpdating,
    compareLabel: resolvedPeriod.compareLabel,
  };
}

/**
 * LEVEL 3: Zone View (Production Floor Map)
 * Driven by unified metrics engine and shared live tick.
 */
export function useLiveZoneState(period: PeriodId | string, plantId: string, zoneId: string) {
  const { resolvedPeriod, liveTick, isLiveUpdating } = useApp();
  const zone = useMemo(() => getZone(plantId, zoneId), [plantId, zoneId]);

  const zoneMetrics = useMemo(
    () => getMetrics(plantId, "zone", zoneId, resolvedPeriod, liveTick),
    [plantId, zoneId, resolvedPeriod, liveTick],
  );

  const lineMetricsMap = useMemo(() => {
    const map: Record<string, EntityMetrics> = {};
    if (zone) {
      for (const l of zone.lines) {
        map[l.id] = getMetrics(plantId, "line", l.id, resolvedPeriod, liveTick);
      }
    }
    return map;
  }, [plantId, zone, resolvedPeriod, liveTick]);

  const metrics: LiveMetrics = {
    oee: zoneMetrics.oee,
    availability: zoneMetrics.availability,
    performance: zoneMetrics.performance,
    quality: zoneMetrics.quality,
  };

  const lines = useMemo(() => {
    if (!zone) return [];
    return zone.lines.map((l) => {
      const lm = lineMetricsMap[l.id];
      if (!lm) return l;
      return {
        ...l,
        oee: lm.oee,
        availability: lm.availability,
        performance: lm.performance,
        quality: lm.quality,
        outputActual: lm.outputActual,
        outputTarget: lm.outputTarget,
        speed: lm.actualRunRate,
        po: lm.activePo !== "-" ? lm.activePo : l.po,
        bottleneck: getLineBottleneck(plantId, l),
      };
    });
  }, [zone, lineMetricsMap, plantId]);

  const lineStatuses = useMemo(() => {
    const map: Record<string, Status> = {};
    if (zone) {
      for (const l of zone.lines) {
        map[l.id] = l.status;
      }
    }
    return map;
  }, [zone]);

  return {
    metrics,
    deltas: zoneMetrics.deltas,
    zoneMetrics,
    lineMetricsMap,
    lines,
    lineStatuses,
    isUpdating: isLiveUpdating,
    compareLabel: resolvedPeriod.compareLabel,
  };
}

/**
 * LEVEL 4: Line Detail Page
 * Driven by unified metrics engine and shared live tick.
 */
export function useLiveLineState(
  period: PeriodId | string,
  plantId: string,
  zoneId: string,
  lineId: string,
) {
  const { resolvedPeriod, liveTick, isLiveUpdating } = useApp();
  const line = useMemo(() => getLine(plantId, zoneId, lineId), [plantId, zoneId, lineId]);

  const lineMetrics = useMemo(
    () => getMetrics(plantId, "line", lineId, resolvedPeriod, liveTick),
    [plantId, lineId, resolvedPeriod, liveTick],
  );

  const bottleneckMachine = useMemo(
    () => (line ? getLineBottleneck(plantId, line) : lineId),
    [line, plantId, lineId],
  );

  const liveLine: Line = useMemo(() => {
    if (!line) {
      return {
        id: lineId,
        zoneId,
        plantId,
        status: "running",
        availability: lineMetrics.availability,
        performance: lineMetrics.performance,
        quality: lineMetrics.quality,
        oee: lineMetrics.oee,
        outputTarget: lineMetrics.outputTarget,
        outputActual: lineMetrics.outputActual,
        runningMinutes: lineMetrics.runningMinutes,
        speed: lineMetrics.actualRunRate,
        stdSpeed: lineMetrics.runRateSku,
        sku: "SKU-40001",
        po: lineMetrics.activePo,
        batch: "B2201",
        mpqTarget: 180,
        bottleneck: bottleneckMachine,
        bay: { row: 0, col: 0 },
        machines: [],
      };
    }

    return {
      ...line,
      oee: lineMetrics.oee,
      availability: lineMetrics.availability,
      performance: lineMetrics.performance,
      quality: lineMetrics.quality,
      outputActual: lineMetrics.outputActual,
      outputTarget: lineMetrics.outputTarget,
      runningMinutes: lineMetrics.runningMinutes,
      speed: lineMetrics.actualRunRate,
      stdSpeed: lineMetrics.runRateSku,
      bottleneck: bottleneckMachine,
      po: lineMetrics.activePo !== "-" ? lineMetrics.activePo : line.po,
    };
  }, [line, lineId, zoneId, plantId, lineMetrics, bottleneckMachine]);

  return {
    line: liveLine,
    deltas: lineMetrics.deltas,
    lineMetrics,
    isUpdating: isLiveUpdating,
    compareLabel: resolvedPeriod.compareLabel,
    bottleneckMachine,
  };
}

/**
 * LEVEL 5: Machine Detail Page
 * Driven by unified metrics engine and shared live tick.
 */
export function useLiveMachineState(
  period: PeriodId | string,
  plantId: string,
  zoneId: string,
  lineId: string,
  machineId: string,
) {
  const { resolvedPeriod, liveTick, isLiveUpdating } = useApp();
  const baseMachine = useMemo(
    () => getMachine(plantId, zoneId, lineId, machineId),
    [plantId, zoneId, lineId, machineId],
  );

  const machineMetrics = useMemo(
    () => getMetrics(plantId, "machine", machineId, resolvedPeriod, liveTick),
    [plantId, machineId, resolvedPeriod, liveTick],
  );

  const machine: LiveMetrics = {
    oee: machineMetrics.oee,
    availability: machineMetrics.availability,
    performance: machineMetrics.performance,
    quality: machineMetrics.quality,
  };

  const sensors = useMemo(() => {
    return (baseMachine?.sensors ?? []).map((s) => {
      let jitter = 0;
      if (s.unit === "°C") jitter = ((liveTick % 5) - 2) * 0.2;
      else if (s.unit === "bar") jitter = ((liveTick % 3) - 1) * 0.05;
      else if (s.unit === "ppm") jitter = (liveTick % 5) - 2;

      const nextVal = +(s.value + jitter).toFixed(1);
      return {
        ...s,
        value: nextVal,
        warn: s.limit !== undefined ? nextVal > s.limit : false,
      };
    });
  }, [baseMachine, liveTick]);

  return {
    machine,
    sensors,
    machineMetrics,
    deltas: machineMetrics.deltas,
    isUpdating: isLiveUpdating,
    stopsCount: machineMetrics.stopsCount,
    compareLabel: resolvedPeriod.compareLabel,
  };
}
