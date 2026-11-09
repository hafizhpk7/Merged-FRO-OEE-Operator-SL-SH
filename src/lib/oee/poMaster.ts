
import { getNow } from "./shiftClock";/**
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
