/**
 * Line OEE Calculation & Topologies (SEQ / OR) per URS §2.4 & Self-Test Suite
 */

import { computeMachineOee, type OeeMetrics, type WindowData } from "./windowEngine";
import { computeOeeFromTotals, aggregateTotals, type MachineTotals } from "./oeeTotals";

export type MachineOeeInput = {
  machineCode: string;
  windows: WindowData[];
  totalUnits?: number;
  rejectCount: number;
  reworkCount: number;
  stdPpm: number;
  weight?: number;
  isParallel?: boolean;
};

export type MachineTotalsInput = {
  machineCode: string;
  totals: MachineTotals;
  stdPpm: number;
  weight?: number;
  isParallel?: boolean;
};

export function computeLineOeeFromTotals(
  machines: MachineTotalsInput[],
  topology: "SEQ" | "OR" = "SEQ",
  bottleneckCode?: string,
): { metrics: OeeMetrics; totals: MachineTotals } {
  if (machines.length === 0) {
    const emptyTotals: MachineTotals = {
      calendarMin: 0,
      naMin: 0,
      usMin: 0,
      pdMin: 0,
      dMin: 0,
      msMin: 0,
      slPosMin: 0,
      slNegMin: 0,
      units: 0,
      reject: 0,
      rework: 0,
      runningMin: 0,
      stops: 0,
    };
    return {
      totals: emptyTotals,
      metrics: computeOeeFromTotals(emptyTotals),
    };
  }

  // SEQ Topology
  if (topology === "SEQ") {
    const target = machines.find((m) => m.machineCode === bottleneckCode) || machines[0]!;
    return {
      totals: target.totals,
      metrics: computeOeeFromTotals(target.totals),
    };
  }

  // OR Topology
  const parallelMachines = machines.filter((m) => m.isParallel);
  const seriesMachines = machines.filter((m) => !m.isParallel);

  // Bottleneck rule: MIN(series OEE) if no bottleneck chosen and sum(parallel std) >= series machines std
  if (!bottleneckCode && seriesMachines.length > 0) {
    const sumParallelStd = parallelMachines.reduce((acc, m) => acc + m.stdPpm, 0);
    const isSeriesBottleneck = seriesMachines.every((sm) => sumParallelStd >= sm.stdPpm);

    if (isSeriesBottleneck) {
      let minMachine = seriesMachines[0]!;
      let minMetrics = computeOeeFromTotals(minMachine.totals);
      for (let i = 1; i < seriesMachines.length; i++) {
        const sm = seriesMachines[i]!;
        const smMetrics = computeOeeFromTotals(sm.totals);
        if (smMetrics.oeePct < minMetrics.oeePct) {
          minMetrics = smMetrics;
          minMachine = sm;
        }
      }
      return { metrics: minMetrics, totals: minMachine.totals };
    }
  }

  // Fallback to explicit bottleneck if exists
  const explicitBottleneck = machines.find((m) => m.machineCode === bottleneckCode);
  if (explicitBottleneck) {
    return {
      totals: explicitBottleneck.totals,
      metrics: computeOeeFromTotals(explicitBottleneck.totals),
    };
  }

  // Otherwise weighted parallel
  const metrics = aggregateTotals(
    parallelMachines.map((pm) => ({
      totals: pm.totals,
      weight: pm.weight ?? 100,
    })),
  );

  // Aggregate totals representation for parallel group
  const firstParallel = parallelMachines[0]!;
  return {
    metrics,
    totals: firstParallel.totals,
  };
}

export function computeLineOee(
  machines: MachineOeeInput[],
  topology: "SEQ" | "OR" = "SEQ",
  bottleneckCode?: string,
): OeeMetrics {
  if (machines.length === 0) {
    return {
      calendarTimeMin: 0,
      scheduledTimeMin: 0,
      grossOperatingTimeMin: 0,
      netOperatingTimeMin: 0,
      slNetMin: 0,
      availabilityPct: 0,
      performancePct: 0,
      qualityPct: 0,
      oeePct: 0,
    };
  }

  // SEQ Topology
  if (topology === "SEQ") {
    const target = machines.find((m) => m.machineCode === bottleneckCode) || machines[0];
    if (!target) {
      return {
        calendarTimeMin: 0,
        scheduledTimeMin: 0,
        grossOperatingTimeMin: 0,
        netOperatingTimeMin: 0,
        slNetMin: 0,
        availabilityPct: 0,
        performancePct: 0,
        qualityPct: 0,
        oeePct: 0,
      };
    }
    return computeMachineOee({
      windows: target.windows,
      rejectCount: target.rejectCount,
      reworkCount: target.reworkCount,
    });
  }

  // OR Topology
  const parallelMachines = machines.filter((m) => m.isParallel);
  const seriesMachines = machines.filter((m) => !m.isParallel);

  // Bottleneck rule: MIN(series OEE) if no bottleneck chosen and sum(parallel std) >= series machines std
  if (!bottleneckCode && seriesMachines.length > 0) {
    const sumParallelStd = parallelMachines.reduce((acc, m) => acc + m.stdPpm, 0);
    // Check if parallel group is faster than ALL series machines (meaning a series machine is the bottleneck)
    const isSeriesBottleneck = seriesMachines.every((sm) => sumParallelStd >= sm.stdPpm);

    if (isSeriesBottleneck) {
      const seriesOees = seriesMachines.map((sm) =>
        computeMachineOee({
          windows: sm.windows,
          rejectCount: sm.rejectCount,
          reworkCount: sm.reworkCount,
        }),
      );
      return seriesOees.reduce((min, curr) => (curr.oeePct < min.oeePct ? curr : min));
    }
  }

  // Fallback to bottleneck if it exists
  const explicitBottleneck = machines.find((m) => m.machineCode === bottleneckCode);
  if (explicitBottleneck) {
    return computeMachineOee({
      windows: explicitBottleneck.windows,
      rejectCount: explicitBottleneck.rejectCount,
      reworkCount: explicitBottleneck.reworkCount,
    });
  }

  // Otherwise weighted parallel
  let sumParallelGotWeight = 0;
  let sumParallelSptWeight = 0;
  let sumParallelNotWeight = 0;
  let sumParallelEffWeight = 0;
  let sumParallelUnitsWeight = 0;

  for (const pm of parallelMachines) {
    const metrics = computeMachineOee({
      windows: pm.windows,
      rejectCount: pm.rejectCount,
      reworkCount: pm.reworkCount,
    });
    const wt = pm.weight || 100;
    const totalUnits = pm.totalUnits || pm.windows.reduce((acc, w) => acc + w.actualCount, 0);
    const effectiveUnits = Math.max(0, totalUnits - pm.rejectCount - pm.reworkCount);

    sumParallelGotWeight += metrics.grossOperatingTimeMin * wt;
    sumParallelSptWeight += metrics.scheduledTimeMin * wt;
    sumParallelNotWeight += metrics.netOperatingTimeMin * wt;
    sumParallelEffWeight += effectiveUnits * wt;
    sumParallelUnitsWeight += totalUnits * wt;
  }

  const availability = sumParallelSptWeight > 0 ? sumParallelGotWeight / sumParallelSptWeight : 0;
  const performance = sumParallelGotWeight > 0 ? sumParallelNotWeight / sumParallelGotWeight : 0;
  const quality = sumParallelUnitsWeight > 0 ? sumParallelEffWeight / sumParallelUnitsWeight : 0;
  const oee = availability * performance * quality;

  return {
    calendarTimeMin: 0,
    scheduledTimeMin: Math.round(sumParallelSptWeight * 100) / 100,
    grossOperatingTimeMin: Math.round(sumParallelGotWeight * 100) / 100,
    netOperatingTimeMin: Math.round(sumParallelNotWeight * 100) / 100,
    slNetMin: 0, // Placeholder
    availabilityPct: Math.round(availability * 10000) / 100,
    performancePct: Math.round(performance * 10000) / 100,
    qualityPct: Math.round(quality * 10000) / 100,
    oeePct: Math.round(oee * 10000) / 100,
  };
}
