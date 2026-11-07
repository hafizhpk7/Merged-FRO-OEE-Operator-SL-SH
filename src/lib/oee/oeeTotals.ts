/**
 * OEE Totals & Aggregation Engine
 * Follows CR docx ("Perumusan Detail Perhitungan OEE Mesin")
 * and URS PDF pages 24-32 (§2.3 - §2.6)
 */

export type MachineTotals = {
  calendarMin: number;
  naMin: number;
  usMin: number;
  pdMin: number;
  dMin: number;
  msMin: number;
  slPosMin: number;
  slNegMin: number;
  units: number;
  reject: number;
  rework: number;
  runningMin: number;
  stops: number;
};

export type OeeMetricsResult = {
  calendarTimeMin: number;
  scheduledTimeMin: number;
  grossOperatingTimeMin: number;
  netOperatingTimeMin: number;
  slNetMin: number;
  availabilityPct: number;
  performancePct: number;
  qualityPct: number;
  oeePct: number;
};

/**
 * Standard machine weights for zone/plant aggregation (URS §2.5 & §2.6).
 * Default weight is 100 per machine, editable.
 */
export const MACHINE_WEIGHTS: Record<string, number> = {
  // Configurable per machine code if needed (e.g. LBF01: 100, LBF02: 70)
};

export function getMachineWeight(machineCode: string): number {
  return MACHINE_WEIGHTS[machineCode] ?? 100;
}

/**
 * Computes Availability, Performance, Quality, and OEE from a MachineTotals record.
 * Implements the CR formulas exactly:
 * - SPT = max(0, calendar - NA - US - PD)
 * - GOT = max(0, SPT - D)
 * - NOT = GOT - MS - (slPos - slNeg)
 * - Availability = GOT / SPT (0 if SPT === 0)
 * - Performance = NOT / GOT (0 if GOT === 0, may exceed 100%)
 * - Quality = (units - reject - rework) / units (100% if units === 0)
 * - OEE = Availability * Performance * Quality (may exceed 100%)
 */
export function computeOeeFromTotals(totals: MachineTotals): OeeMetricsResult {
  const calendar = Math.max(0, totals.calendarMin);
  const na = Math.max(0, totals.naMin);
  const us = Math.max(0, totals.usMin);
  const pd = Math.max(0, totals.pdMin);
  const d = Math.max(0, totals.dMin);
  const ms = Math.max(0, totals.msMin);
  const slPos = Math.max(0, totals.slPosMin);
  const slNeg = Math.max(0, totals.slNegMin);
  const slNet = slPos - slNeg;

  const spt = Math.max(0, calendar - na - us - pd);
  const got = Math.max(0, spt - d);
  const not = got - ms - slNet;

  const availability = spt > 0 ? (got / spt) * 100 : 0;
  const performance = got > 0 ? (not / got) * 100 : 0;

  const units = totals.units;
  const reject = totals.reject;
  const rework = totals.rework;
  const goodUnits = Math.max(0, units - reject - rework);
  const quality = units > 0 ? (goodUnits / units) * 100 : 100;

  const oee = (availability * performance * quality) / 10000;

  return {
    calendarTimeMin: Math.round(calendar * 100) / 100,
    scheduledTimeMin: Math.round(spt * 100) / 100,
    grossOperatingTimeMin: Math.round(got * 100) / 100,
    netOperatingTimeMin: Math.round(not * 100) / 100,
    slNetMin: Math.round(slNet * 100) / 100,
    availabilityPct: Math.round(availability * 100) / 100,
    performancePct: Math.round(performance * 100) / 100,
    qualityPct: Math.round(quality * 100) / 100,
    oeePct: Math.round(oee * 100) / 100,
  };
}

/**
 * Aggregates machine totals for Zone, Plant, or Group per URS §2.5 & §2.6:
 * - Availability = sum(GOT * w) / sum(SPT * w)
 * - Performance = sum(NOT * w) / sum(GOT * w)
 * - Quality = sum((units - reject - rework) * w) / sum(units * w)
 * - OEE = Availability * Performance * Quality
 */
export function aggregateTotals(
  items: { totals: MachineTotals; weight?: number }[],
  defaultWeight: number = 100,
): OeeMetricsResult {
  if (items.length === 0) {
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

  let sumGotW = 0;
  let sumSptW = 0;
  let sumNotW = 0;
  let sumUnitsW = 0;
  let sumGoodW = 0;
  let totalCalendar = 0;

  for (const item of items) {
    const w = item.weight ?? defaultWeight;
    const t = item.totals;
    const spt = Math.max(0, t.calendarMin - t.naMin - t.usMin - t.pdMin);
    const got = Math.max(0, spt - t.dMin);
    const slNet = t.slPosMin - t.slNegMin;
    const not = got - t.msMin - slNet;
    const goodUnits = Math.max(0, t.units - t.reject - t.rework);

    sumSptW += spt * w;
    sumGotW += got * w;
    sumNotW += not * w;
    sumUnitsW += t.units * w;
    sumGoodW += goodUnits * w;
    totalCalendar += t.calendarMin;
  }

  const availability = sumSptW > 0 ? (sumGotW / sumSptW) * 100 : 0;
  const performance = sumGotW > 0 ? (sumNotW / sumGotW) * 100 : 0;
  const quality = sumUnitsW > 0 ? (sumGoodW / sumUnitsW) * 100 : 100;
  const oee = (availability * performance * quality) / 10000;

  return {
    calendarTimeMin: Math.round(totalCalendar * 100) / 100,
    scheduledTimeMin: Math.round(sumSptW * 100) / 100,
    grossOperatingTimeMin: Math.round(sumGotW * 100) / 100,
    netOperatingTimeMin: Math.round(sumNotW * 100) / 100,
    slNetMin: 0,
    availabilityPct: Math.round(availability * 100) / 100,
    performancePct: Math.round(performance * 100) / 100,
    qualityPct: Math.round(quality * 100) / 100,
    oeePct: Math.round(oee * 100) / 100,
  };
}

/**
 * Combines multiple MachineTotals into a single MachineTotals by summing components.
 */
export function combineMachineTotals(list: MachineTotals[]): MachineTotals {
  const result: MachineTotals = {
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

  for (const t of list) {
    result.calendarMin += t.calendarMin;
    result.naMin += t.naMin;
    result.usMin += t.usMin;
    result.pdMin += t.pdMin;
    result.dMin += t.dMin;
    result.msMin += t.msMin;
    result.slPosMin += t.slPosMin;
    result.slNegMin += t.slNegMin;
    result.units += t.units;
    result.reject += t.reject;
    result.rework += t.rework;
    result.runningMin += t.runningMin;
    result.stops += t.stops;
  }

  return result;
}
