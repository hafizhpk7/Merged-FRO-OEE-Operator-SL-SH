/**
 * CR 3 mock data: PO FG packaging BOM, flow type per line and quantity validation (SM-04..SM-10).
 * Deterministic (seeded). The real BOM comes from SAP later.
 */
import { rand } from "./rng";
import { getPoForLine, PO_MASTERS } from "./poMaster";

export type FlowType = "KEMAS_1" | "KEMAS_2" | "KEMAS_PUSAT";

/** Flow label constant (CR 3 section 3.2). Generic for Kemas 1, Kemas 2 and Kemas Pusat. */
export const FLOW_LABELS: Record<FlowType, string> = {
  KEMAS_1: "Kemas 1",
  KEMAS_2: "Kemas 2",
  KEMAS_PUSAT: "Kemas Pusat",
};

const FLOW_BY_LINE: Record<string, FlowType> = {
  TUP01: "KEMAS_1",
  TUP13: "KEMAS_1",
  TUP14: "KEMAS_1",
  BOP15: "KEMAS_2",
  BOP16: "KEMAS_PUSAT",
};

export function getFlowType(lineId: string): FlowType {
  return FLOW_BY_LINE[lineId] ?? "KEMAS_1";
}

export type BomItem = { code: string; name: string; uom: "PC" | "ROLL"; supply: number };

const BOM_TEMPLATE: { code: string; name: string; uom: "PC" | "ROLL" }[] = [
  { code: "2000004747", name: "PLUG GRACE CS REFRESHING DAY GEL 30 DP W", uom: "PC" },
  { code: "2000005684", name: "SPATULA HR GEL W", uom: "PC" },
  { code: "2000023306", name: "CAP GRACE GEL MOISTURIZER RV DP 30 W", uom: "PC" },
  { code: "2000041465", name: "DUS TRANEXAMIC A-A + 5% DSCGM 30 R5 W", uom: "PC" },
  { code: "2000051220", name: "LABEL SHRINK ROLL 40MM", uom: "ROLL" },
];

/** Whether the line has an active PO FG (SM-03). Lines without PO master get the placeholder. */
export function hasActivePo(lineId: string): boolean {
  return Boolean(PO_MASTERS[lineId]);
}

/** Deterministic packaging BOM of the PO FG with the quantity supplied to the line. */
export function getPoBom(poNumber: string): BomItem[] {
  return BOM_TEMPLATE.map((t) => ({
    ...t,
    supply:
      t.uom === "ROLL"
        ? rand(`bom:${poNumber}:${t.code}`, 8, 20, 1)
        : rand(`bom:${poNumber}:${t.code}`, 20000, 40000),
  }));
}

export function getPoFgInfo(lineId: string) {
  const po = getPoForLine(lineId);
  return { poNumber: po.poNumber, material: `${po.materialNumber} ${po.skuName}`, user: po.activeOperator };
}

/** Read-only "Reject unboxing" seed (Supply, Mesin, Proses) per item, deterministic. */
export function getUnboxingSeed(poNumber: string, item: BomItem): [number, number, number] {
  const f = (k: string) =>
    item.uom === "ROLL"
      ? rand(`unb:${poNumber}:${item.code}:${k}`, 0, 1, 1)
      : rand(`unb:${poNumber}:${item.code}:${k}`, 0, 40);
  return [f("s"), f("m"), f("p")];
}

/** SM-10: non-negative integers; decimals only for UoM Roll. Returns an error text or null. */
export function validateQty(value: number, uom: "PC" | "ROLL"): string | null {
  if (!Number.isFinite(value)) return "Nilai tidak valid";
  if (value < 0) return "Tidak boleh negatif";
  if (uom !== "ROLL" && !Number.isInteger(value)) return "Harus bilangan bulat";
  if (uom === "ROLL" && Math.abs(value * 10 - Math.round(value * 10)) > 1e-9) return "Maks. 1 desimal";
  return null;
}
