
import { getNow, isShiftOverrideActive, SHIFT_SECONDS, type ShiftInfo } from "./shiftClock";

/**
 * Process Order (PO) Master Data per Line (§3.1)
 */

export type ProcessOrderInfo = {
  poNumber: string;
  batch: string;
  materialNumber: string;
  skuName: string;
  sediaan: string;
  mpq: number;
  skuStandardRunRate: number; // pcs/min
  unitsPerInnerBox: number;
  unitsPerCartonBox: number;
  unitsPerPallet: number;
  startTimeSec: number; // timestamp in seconds
  operators: string[];
  activeOperator: string;
};

const DEFAULT_PO: ProcessOrderInfo = {
  poNumber: "210000040323",
  batch: "LN15A",
  materialNumber: "4000008428",
  skuName: "LABORE SENSITIVE SKIN CARE GENTLEBIOME MILD CLEANSER 2X225ML",
  sediaan: "L",
  mpq: 404100,
  skuStandardRunRate: 110,
  unitsPerInnerBox: 12,
  unitsPerCartonBox: 220,
  unitsPerPallet: 13,
  startTimeSec: Math.floor(getNow().setHours(7, 0, 0, 0) / 1000),
  operators: ["FTRI", "ADQI", "YUAB", "JRWO", "GSTI", "INDH", "BRHN", "ANDI", "ICAK"],
  activeOperator: "FTRI",
};

export const PO_MASTERS: Record<string, ProcessOrderInfo> = {
  TUP01: { ...DEFAULT_PO, poNumber: "210000040323", skuName: "KAHF FACIAL WASH 100ML" },
  TUP13: {
    ...DEFAULT_PO,
    poNumber: "210000040324",
    skuName: "WARDAH LIGHTENING FACIAL WASH 100ML",
  },
  TUP14: { ...DEFAULT_PO, poNumber: "210000040325", skuName: "EMINA BRIGHT STUFF FACE WASH 50ML" },
  BOP15: { ...DEFAULT_PO, poNumber: "210000040326", skuName: "BIODERMA SENSIBIO H2O 250ML" },
  BOP16: { ...DEFAULT_PO, poNumber: "210000040327", skuName: "SCARLETT WHITENING BODY LOTION" },
};

export function getPoForLine(lineId: string): ProcessOrderInfo {
  return PO_MASTERS[lineId] || DEFAULT_PO;
}

// ---- Several POs per shift (CR 5) ---------------------------------------------------------------

/** One PO/SKU run inside a shift. Times are seconds from the shift start (FRO keeps them to the second). */
export type PoSegment = {
  key: string;
  /** Short label used in tables ("SKU 1"). */
  skuLabel: string;
  poNumber: string;
  skuName: string;
  mpq: number;
  /** SRR SKU in pcs/min; null = no standard defined for this SKU (TG-09). */
  srr: number | null;
  startSec: number;
  stopSec: number;
  /** Total output of this PO from earlier shifts (S for a continued PO, TG-02). 0 for a new PO. */
  carryActual: number;
};

export type ShiftPoPlan = {
  shiftKey: string;
  scenario: "default" | "multi-sku-0630";
  segments: PoSegment[];
  /** Planned Downtime known from the plan (e.g. a break); the window engine's PD windows add to it. */
  plannedBreaks: { startSec: number; endSec: number }[];
  /** SRR Line in pcs/min; null = take the line standard from the engine. */
  srrLine: number | null;
};

const HM = (h: number, m: number, base: { h: number; m: number }) => (h * 60 + m - (base.h * 60 + base.m)) * 60;

/**
 * Demo scenario from the CR 5 mockup: shift 06:30-14:30. SKU 1 10 ppm 06:30-09:30, changeover
 * 09:30-09:45 (no PO = Unscheduled), SKU 2 12 ppm 09:45-12:45, SKU 3 14 ppm 12:45-14:30,
 * planned break 12:00-12:30, SRR Line 14 ppm.
 */
export function buildMultiSkuScenario(shift: ShiftInfo): ShiftPoPlan {
  const base = { h: 6, m: 30 };
  return {
    shiftKey: shift.shiftKey,
    scenario: "multi-sku-0630",
    srrLine: 14,
    plannedBreaks: [{ startSec: HM(12, 0, base), endSec: HM(12, 30, base) }],
    segments: [
      {
        key: "sku1",
        skuLabel: "SKU 1",
        poNumber: "21000006470",
        skuName: "LABORE SENSITIVE SKIN CARE GENTLEBIOME MILD CLEANSER",
        mpq: 2000,
        srr: 10,
        startSec: HM(6, 30, base),
        stopSec: HM(9, 30, base),
        carryActual: 0,
      },
      {
        key: "sku2",
        skuLabel: "SKU 2",
        poNumber: "21000006481",
        skuName: "LABORE HYDRA BALANCE CREAM 50G",
        mpq: 3000,
        srr: 12,
        startSec: HM(9, 45, base),
        stopSec: HM(12, 45, base),
        carryActual: 0,
      },
      {
        key: "sku3",
        skuLabel: "SKU 3",
        poNumber: "21000006492",
        skuName: "LABORE NIGHT REPAIR SERUM 30G",
        mpq: 1800,
        srr: 14,
        startSec: HM(12, 45, base),
        stopSec: HM(14, 30, base),
        carryActual: 0,
      },
    ],
  };
}

/**
 * PO plan of a line for a shift. Standard shifts run one PO for the whole shift (the line's PO
 * master); with the 06:30 shift override the multi-SKU demo scenario runs instead.
 */
export function getShiftPoPlan(lineId: string, shift: ShiftInfo): ShiftPoPlan {
  if (isShiftOverrideActive() && shift.startMinuteOfDay === 6 * 60 + 30) return buildMultiSkuScenario(shift);
  const po = getPoForLine(lineId);
  return {
    shiftKey: shift.shiftKey,
    scenario: "default",
    srrLine: null,
    plannedBreaks: [],
    segments: [
      {
        key: "po",
        skuLabel: "SKU",
        poNumber: po.poNumber,
        skuName: po.skuName,
        mpq: po.mpq,
        srr: po.skuStandardRunRate,
        startSec: 0,
        stopSec: SHIFT_SECONDS,
        carryActual: 0,
      },
    ],
  };
}
