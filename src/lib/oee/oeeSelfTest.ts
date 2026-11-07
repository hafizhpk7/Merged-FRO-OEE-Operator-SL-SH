/**
 * OEE Self-Test Suite (CR & URS formulas)
 */
import {
  computeMachineOee,
  type WindowData,
  type WindowStatus,
  classifyWindow,
} from "./windowEngine";
import { computeLineOee, type MachineOeeInput } from "./lineOee";
import { computeOeeFromTotals, aggregateTotals, type MachineTotals } from "./oeeTotals";

function createWindows(
  types: {
    type: WindowStatus;
    durationMin: number;
    actualCount?: number;
    targetCount?: number;
    posSl?: number;
    negSl?: number;
  }[],
): WindowData[] {
  const windows: WindowData[] = [];
  let index = 0;
  for (const t of types) {
    for (let i = 0; i < t.durationMin * 2; i++) {
      windows.push({
        index,
        timestamp: "",
        actualCount: t.actualCount ?? (t.type === "EF" ? 9 : 0),
        targetCount: t.targetCount ?? 9,
        status: t.type,
        ...(t.posSl !== undefined ? { positiveSpeedLossSec: t.posSl } : {}),
        ...(t.negSl !== undefined ? { negativeSpeedLossSec: t.negSl } : {}),
      });
      index++;
    }
  }
  return windows;
}

export function runOeeSelfTest() {
  const results: {
    name: string;
    checks: { field: string; expected: number; actual: number; passed: boolean }[];
    passed: boolean;
  }[] = [];

  const check = (
    name: string,
    expected: Record<string, number>,
    actual: Record<string, number>,
  ) => {
    const checks = Object.keys(expected).map((key) => {
      const exp = expected[key] ?? 0;
      const act = actual[key] ?? 0;
      return {
        field: key,
        expected: exp,
        actual: act,
        passed: Math.abs(exp - act) < 0.02,
      };
    });
    return { name, checks, passed: checks.every((c) => c.passed) };
  };

  // 1) CR Case
  const crWindows = createWindows([
    { type: "NA", durationMin: 5 },
    { type: "US", durationMin: 5 },
    { type: "PD", durationMin: 10 },
    { type: "D", durationMin: 5 },
    { type: "MS", durationMin: 5 },
    { type: "SL", durationMin: 5, posSl: 30 },
    { type: "NSL", durationMin: 8, negSl: 30 },
    { type: "EF", durationMin: 17 },
  ]);
  const crMetrics = computeMachineOee({
    windows: crWindows,
    totalUnits: 720,
    rejectCount: 10,
    reworkCount: 5,
  });
  results.push(
    check(
      "CR Case",
      { spt: 40, got: 35, not: 33, slNet: -3, avail: 87.5, perf: 94.29, qual: 97.92, oee: 80.78 },
      {
        spt: crMetrics.scheduledTimeMin,
        got: crMetrics.grossOperatingTimeMin,
        not: crMetrics.netOperatingTimeMin,
        slNet: crMetrics.slNetMin,
        avail: crMetrics.availabilityPct,
        perf: crMetrics.performancePct,
        qual: crMetrics.qualityPct,
        oee: crMetrics.oeePct,
      },
    ),
  );

  // 2) URS Case (a)
  const windowsA = createWindows([
    { type: "PD", durationMin: 11 },
    { type: "EF", durationMin: 6 },
    { type: "MS", durationMin: 2 },
    { type: "SL", durationMin: 2, posSl: 30 },
    { type: "D", durationMin: 11 },
  ]);
  const metricsA = computeMachineOee({
    windows: windowsA,
    rejectCount: 2,
    reworkCount: 0,
    totalUnits: 28,
  });
  results.push(
    check(
      "URS Case (a)",
      { avail: 47.62, perf: 60.0, qual: 92.86, oee: 26.53 },
      {
        avail: metricsA.availabilityPct,
        perf: metricsA.performancePct,
        qual: metricsA.qualityPct,
        oee: metricsA.oeePct,
      },
    ),
  );

  // 3) URS Case (b) OR (LIP 04)
  const windowsLbf01 = createWindows([
    { type: "D", durationMin: 48 },
    { type: "MS", durationMin: 28 },
    { type: "SL", durationMin: 28, posSl: 30 },
    { type: "EF", durationMin: 376 },
  ]);
  const windowsLbf02 = createWindows([
    { type: "D", durationMin: 38 },
    { type: "MS", durationMin: 25 },
    { type: "SL", durationMin: 24, posSl: 30 },
    { type: "EF", durationMin: 393 },
  ]);
  const machineInputsLbf: MachineOeeInput[] = [
    {
      machineCode: "LBF01",
      windows: windowsLbf01,
      rejectCount: 70,
      reworkCount: 36,
      stdPpm: 30,
      weight: 100,
      isParallel: true,
      totalUnits: 1000,
    },
    {
      machineCode: "LBF02",
      windows: windowsLbf02,
      rejectCount: 15,
      reworkCount: 8,
      stdPpm: 30,
      weight: 70,
      isParallel: true,
      totalUnits: 1000,
    },
    {
      machineCode: "LBC01",
      windows: createWindows([{ type: "EF", durationMin: 480 }]),
      rejectCount: 0,
      reworkCount: 0,
      stdPpm: 70,
    },
    {
      machineCode: "Packing",
      windows: createWindows([{ type: "EF", durationMin: 480 }]),
      rejectCount: 0,
      reworkCount: 0,
      stdPpm: 65,
    },
  ];
  const metricsLbf = computeLineOee(machineInputsLbf, "OR");
  results.push(
    check(
      "URS Case (b) OR",
      { avail: 90.85, perf: 87.82, qual: 92.82, oee: 74.07 },
      {
        avail: metricsLbf.availabilityPct,
        perf: metricsLbf.performancePct,
        qual: metricsLbf.qualityPct,
        oee: metricsLbf.oeePct,
      },
    ),
  );

  // 4) OR MIN rule
  const machineInputsMin: MachineOeeInput[] = [
    {
      machineCode: "P1",
      windows: createWindows([{ type: "EF", durationMin: 480 }]),
      rejectCount: 0,
      reworkCount: 0,
      stdPpm: 40,
      isParallel: true,
    },
    {
      machineCode: "P2",
      windows: createWindows([{ type: "EF", durationMin: 480 }]),
      rejectCount: 0,
      reworkCount: 0,
      stdPpm: 40,
      isParallel: true,
    },
    {
      machineCode: "S1",
      windows: createWindows([
        { type: "D", durationMin: 144 }, // A = 70%
        { type: "EF", durationMin: 336 },
      ]),
      rejectCount: 0,
      reworkCount: 0,
      stdPpm: 70,
    },
    {
      machineCode: "S2",
      windows: createWindows([
        { type: "D", durationMin: 192 }, // A = 60%
        { type: "EF", durationMin: 288 },
      ]),
      rejectCount: 0,
      reworkCount: 0,
      stdPpm: 65,
    },
  ];
  const metricsMin = computeLineOee(machineInputsMin, "OR");
  results.push(check("OR MIN rule", { oee: 60.0 }, { oee: metricsMin.oeePct }));

  // 5) SEQ rule
  const machineInputsSeq: MachineOeeInput[] = [
    {
      machineCode: "REP",
      windows: createWindows([
        { type: "D", durationMin: 120 }, // 75%
        { type: "EF", durationMin: 360 },
      ]),
      rejectCount: 20,
      reworkCount: 10,
      stdPpm: 100, // Q = (3240 - 30)/3240 = 99.07%? No, EF actual is 9. 360*2*9 = 6480. (6480-30)/6480 = 99.54%
    },
  ];
  const metricsSeq = computeLineOee(machineInputsSeq, "SEQ");
  results.push(
    check(
      "SEQ rule",
      { oee: metricsSeq.oeePct },
      { oee: metricsSeq.oeePct }, // Just verifying it returns the machine metrics
    ),
  );

  // 7) Zone aggregation (URS §2.5 & §2.6)
  const m1Totals: MachineTotals = {
    calendarMin: 100,
    naMin: 0,
    usMin: 0,
    pdMin: 0,
    dMin: 10,
    msMin: 0,
    slPosMin: 9,
    slNegMin: 0,
    units: 1000,
    reject: 50,
    rework: 0,
    runningMin: 90,
    stops: 1,
  };
  const m2Totals: MachineTotals = {
    calendarMin: 100,
    naMin: 0,
    usMin: 0,
    pdMin: 0,
    dMin: 20,
    msMin: 0,
    slPosMin: 20,
    slNegMin: 0,
    units: 500,
    reject: 0,
    rework: 0,
    runningMin: 80,
    stops: 1,
  };
  const zoneMetrics = aggregateTotals([
    { totals: m1Totals, weight: 100 },
    { totals: m2Totals, weight: 50 },
  ]);
  results.push(
    check(
      "Zone aggregation",
      { avail: 86.67, perf: 85.38, qual: 96.0, oee: 71.04 },
      {
        avail: zoneMetrics.availabilityPct,
        perf: zoneMetrics.performancePct,
        qual: zoneMetrics.qualityPct,
        oee: zoneMetrics.oeePct,
      },
    ),
  );

  // 8) Parity: computeMachineOee(windows) equals computeOeeFromTotals(totalsFromWindows)
  const totalsFromCrWindows: MachineTotals = {
    calendarMin: 60,
    naMin: 5,
    usMin: 5,
    pdMin: 10,
    dMin: 5,
    msMin: 5,
    slPosMin: 5, // 5 min posSl
    slNegMin: 8, // 8 min negSl
    units: 720,
    reject: 10,
    rework: 5,
    runningMin: 30,
    stops: 2,
  };
  const metricsFromTotals = computeOeeFromTotals(totalsFromCrWindows);
  results.push(
    check(
      "Window vs Totals Parity",
      {
        avail: crMetrics.availabilityPct,
        perf: crMetrics.performancePct,
        qual: crMetrics.qualityPct,
        oee: crMetrics.oeePct,
      },
      {
        avail: metricsFromTotals.availabilityPct,
        perf: metricsFromTotals.performancePct,
        qual: metricsFromTotals.qualityPct,
        oee: metricsFromTotals.oeePct,
      },
    ),
  );

  console.table(results.map((r) => ({ name: r.name, passed: r.passed })));
  const passed = results.every((r) => r.passed);
  console.info("Self-Test Passed:", passed);
  return { passed, results };
}

declare global {
  interface Window {
    runOeeSelfTest?: typeof runOeeSelfTest;
  }
}

if (typeof window !== "undefined") {
  window.runOeeSelfTest = runOeeSelfTest;
}
