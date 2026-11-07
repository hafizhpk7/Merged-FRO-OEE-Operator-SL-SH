/**
 * OEE Calibration and Realistic Distribution Engine (§2.3 CR & URS §2.4-§2.6).
 * Calibrates loss factor per line and plant targets for This Shift and This Month.
 */

import { rand } from "./rng";
import { PLANTS, getPlant } from "./data";
import { getMetrics } from "./metrics-engine";

export const OEE_CALIBRATION = {
  // Plant-specific tuning to reach targets: J1 ~70%, J2 ~66%, J4 ~70%
  plantLossScale: {
    J1: 1.38,
    J2: 1.55,
    J4: 1.38,
  } as Record<string, number>,

  // Base parameters
  targetEventCount: 11,
  downtimeProb: 0.28,
  speedLossProb: 0.32,
  minorStopProb: 0.32,
  plannedProb: 0.08,

  // Duration scales (in seconds)
  downtimeBaseSec: 700,
  downtimeRangeSec: 1000,
  speedLossBaseSec: 900,
  speedLossRangeSec: 1000,
  minorStopBaseSec: 45,
  minorStopRangeSec: 180,

  // Speed derating range
  speedPctBase: 72,
  speedPctRange: 16,

  // Reject rate baseline
  baseRejectPct: 1.7,
  minRejectPct: 0.7,
  maxRejectPct: 3.2,
};

/**
 * Returns a seeded loss factor for a line between 0.5 and 2.2, scaled by plant factor.
 */
export function getLineLossFactor(plantId: string, lineId: string): number {
  const seed = `${plantId}:${lineId}:lossFactor`;
  const base = rand(seed, 0.5, 2.2, 2);
  const scale = OEE_CALIBRATION.plantLossScale[plantId] ?? 1.38;
  return Math.round(base * scale * 100) / 100;
}

export type CalibrationResult = {
  passed: boolean;
  thisMonth: {
    plants: Record<
      string,
      { oee: number; availability: number; performance: number; quality: number }
    >;
    zones: Record<string, number>;
    lineDistribution: Record<
      string,
      { totalLines: number; below70Pct: number; below55Pct: number; above80Pct: number }
    >;
  };
  thisShift: {
    bop15Oee: number;
    bop15Passed: boolean;
  };
  checks: { name: string; expected: string; actual: string; passed: boolean }[];
};

/**
 * Validates and logs calibration metrics against acceptance criteria.
 */
export function runCalibrationCheck(): CalibrationResult {
  const checks: { name: string; expected: string; actual: string; passed: boolean }[] = [];
  const operationalPlants = PLANTS.filter((p) => p.isOperational);

  const plantMetricsMonth: Record<
    string,
    { oee: number; availability: number; performance: number; quality: number }
  > = {};
  const zoneMetricsMonth: Record<string, number> = {};
  const lineDistMonth: Record<
    string,
    { totalLines: number; below70Pct: number; below55Pct: number; above80Pct: number }
  > = {};

  for (const p of operationalPlants) {
    const pm = getMetrics(p.id, "plant", p.id, "this-month");
    plantMetricsMonth[p.id] = {
      oee: pm.oee,
      availability: pm.availability,
      performance: pm.performance,
      quality: pm.quality,
    };

    const plantObj = getPlant(p.id);
    const lines = plantObj?.zones.flatMap((z) => z.lines) ?? [];
    let below70Count = 0;
    let below55Count = 0;
    let above80Count = 0;

    for (const z of plantObj?.zones ?? []) {
      const zm = getMetrics(p.id, "zone", z.id, "this-month");
      zoneMetricsMonth[`${p.id}-${z.id}`] = zm.oee;
    }

    for (const l of lines) {
      const lm = getMetrics(p.id, "line", l.id, "this-month");
      if (lm.oee < 70) below70Count++;
      if (lm.oee < 55) below55Count++;
      if (lm.oee > 80) above80Count++;
    }

    const total = Math.max(1, lines.length);
    lineDistMonth[p.id] = {
      totalLines: total,
      below70Pct: Math.round((below70Count / total) * 1000) / 10,
      below55Pct: Math.round((below55Count / total) * 1000) / 10,
      above80Pct: Math.round((above80Count / total) * 1000) / 10,
    };
  }

  // 1. Plant J1 OEE (~70%, 67-73%)
  const j1Oee = plantMetricsMonth["J1"]?.oee ?? 0;
  checks.push({
    name: "Plant J1 This Month OEE",
    expected: "67.0% - 73.0%",
    actual: `${j1Oee.toFixed(1)}%`,
    passed: j1Oee >= 66.5 && j1Oee <= 73.5,
  });

  // 2. Plant J2 OEE (~66%, 63-69%)
  const j2Oee = plantMetricsMonth["J2"]?.oee ?? 0;
  checks.push({
    name: "Plant J2 This Month OEE",
    expected: "63.0% - 69.0%",
    actual: `${j2Oee.toFixed(1)}%`,
    passed: j2Oee >= 63.0 && j2Oee <= 69.0,
  });

  // 3. Plant J4 OEE (~70%, 67-73%)
  const j4Oee = plantMetricsMonth["J4"]?.oee ?? 0;
  checks.push({
    name: "Plant J4 This Month OEE",
    expected: "67.0% - 73.0%",
    actual: `${j4Oee.toFixed(1)}%`,
    passed: j4Oee >= 66.5 && j4Oee <= 73.5,
  });

  // 4. Plant Availability (80-84%, tolerance +-3)
  const j2Avail = plantMetricsMonth["J2"]?.availability ?? 0;
  checks.push({
    name: "Plant J2 Availability",
    expected: "77.0% - 87.0%",
    actual: `${j2Avail.toFixed(1)}%`,
    passed: j2Avail >= 77.0 && j2Avail <= 87.0,
  });

  // 5. Plant Performance (83-86%, tolerance +-3)
  const j2Perf = plantMetricsMonth["J2"]?.performance ?? 0;
  checks.push({
    name: "Plant J2 Performance",
    expected: "80.0% - 89.0%",
    actual: `${j2Perf.toFixed(1)}%`,
    passed: j2Perf >= 80.0 && j2Perf <= 89.0,
  });

  // 6. Plant Quality (97.5-98.5%, tolerance +-1.5)
  const j2Qual = plantMetricsMonth["J2"]?.quality ?? 0;
  checks.push({
    name: "Plant J2 Quality",
    expected: "96.0% - 99.7%",
    actual: `${j2Qual.toFixed(1)}%`,
    passed: j2Qual >= 96.0 && j2Qual <= 99.7,
  });

  // 7. Zone OEEs (between 60% and 72% for J2)
  const j2ZoneA = zoneMetricsMonth["J2-A"] ?? 0;
  const j2ZoneB = zoneMetricsMonth["J2-B"] ?? 0;
  const j2ZoneC = zoneMetricsMonth["J2-C"] ?? 0;
  const zonesPassed = [j2ZoneA, j2ZoneB, j2ZoneC].every((z) => z >= 59.5 && z <= 72.5);
  checks.push({
    name: "Plant J2 Zone OEEs (A, B, C)",
    expected: "60.0% - 72.0%",
    actual: `A: ${j2ZoneA.toFixed(1)}%, B: ${j2ZoneB.toFixed(1)}%, C: ${j2ZoneC.toFixed(1)}%`,
    passed: zonesPassed,
  });

  // 8. BOP15 This Shift OEE (at most 50% since LCM is DOWN)
  const bop15Shift = getMetrics("J2", "line", "BOP15", "this-shift");
  const bop15Passed = bop15Shift.oee <= 50.0;
  checks.push({
    name: "BOP15 (LCM DOWN) This Shift OEE",
    expected: "<= 50.0%",
    actual: `${bop15Shift.oee.toFixed(1)}%`,
    passed: bop15Passed,
  });

  const overallPassed = checks.every((c) => c.passed);

  console.info("=== OEE CALIBRATION CHECK TABLE ===");
  console.table(
    checks.map((c) => ({
      Check: c.name,
      Target: c.expected,
      Result: c.actual,
      Status: c.passed ? "PASS" : "FAIL",
    })),
  );

  return {
    passed: overallPassed,
    thisMonth: {
      plants: plantMetricsMonth,
      zones: zoneMetricsMonth,
      lineDistribution: lineDistMonth,
    },
    thisShift: {
      bop15Oee: bop15Shift.oee,
      bop15Passed,
    },
    checks,
  };
}

if (typeof window !== "undefined") {
  (window as unknown as { runCalibrationCheck: typeof runCalibrationCheck }).runCalibrationCheck =
    runCalibrationCheck;
}
