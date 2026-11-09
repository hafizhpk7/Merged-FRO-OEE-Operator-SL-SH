import { getLine } from "./data";

export type RejectSlot = {
  slotId: string;
  rejectTypeId: string | null;
  rejectTypeName: string | null;
  assignedMachine: string | null;
  status: "Assigned" | "Unassigned";
  category?: "Reject" | "Rework";
};

export type L2Id = "RM" | "RP" | "RS";
export const L2_IDS: L2Id[] = ["RM", "RP", "RS"];

/** One reject L3 entry in the loss tree master (Quality > Reject > L2 > L3). */
export type RejectTypeItem = {
  /** Unique by path: "<l2 lower case>.<base>", e.g. "rm.reject-seal". "rework" has no L2. */
  id: string;
  name: string;
  category: "Reject" | "Rework";
  /** The one L2 this entry sits under (CR 1 review change: every L3 belongs to exactly one L2). */
  l2?: L2Id;
};

/** Reject labels of the mock master. A label needed under another L2 is a separate entry (own id). */
const REJECT_BASES: { base: string; name: string; l2: L2Id[] }[] = [
  { base: "reject-seal", name: "Reject seal", l2: ["RM", "RP", "RS"] },
  { base: "reject-leak", name: "Reject Leak", l2: ["RM"] },
  { base: "reject-cap", name: "Reject Cap", l2: ["RM", "RP"] },
  { base: "reject-label", name: "Reject Label", l2: ["RP", "RS"] },
  { base: "reject-print", name: "Reject Print", l2: ["RP"] },
  { base: "reject-dent", name: "Reject Dent", l2: ["RM"] },
  { base: "netto-kurang", name: "Netto kurang", l2: ["RP"] },
  { base: "penyok", name: "Penyok", l2: ["RM", "RS"] },
  { base: "baret", name: "Baret", l2: ["RP", "RS"] },
  { base: "bintik", name: "Bintik", l2: ["RP"] },
  { base: "miring", name: "Miring", l2: ["RM"] },
];

export const entryId = (l2: L2Id, base: string) => `${l2.toLowerCase()}.${base}`;

export const REJECT_TYPES: RejectTypeItem[] = [
  ...REJECT_BASES.flatMap((b) =>
    b.l2.map((l2) => ({ id: entryId(l2, b.base), name: b.name, category: "Reject" as const, l2 })),
  ),
  { id: "rework", name: "Rework", category: "Rework" },
];

/** Entries (Reject only) under one L2, for the Master Data picker (L2 first, then L3). */
export function getEntriesForL2(l2: L2Id): RejectTypeItem[] {
  return REJECT_TYPES.filter((t) => t.category === "Reject" && t.l2 === l2);
}

export function getEntry(id: string): RejectTypeItem | undefined {
  return REJECT_TYPES.find((t) => t.id === id);
}

/** Entry id -> { l2, base } even when the entry is no longer in the master (history). */
export function parseEntryId(id: string): { l2: L2Id; base: string } | null {
  const m = /^(rm|rp|rs).(.+)$/.exec(id);
  return m ? { l2: (m[1] as string).toUpperCase() as L2Id, base: m[2] as string } : null;
}

export function entryName(id: string): string {
  const e = getEntry(id);
  if (e) return e.name;
  const p = parseEntryId(id);
  if (p) return REJECT_BASES.find((b) => b.base === p.base)?.name ?? id;
  return REJECT_BASES.find((b) => b.base === id)?.name ?? id;
}

/**
 * Migration helper: a pre-review L3 id (one id bound to several L2s) becomes the entry under one L2.
 * Explicit l2 wins (history keeps it); else the single legacy binding; else null (ambiguous).
 */
export function migrateL3(id: string, l2?: L2Id | null): { id: string; l2: L2Id } | null {
  if (parseEntryId(id)) return { id, l2: parseEntryId(id)!.l2 };
  const b = REJECT_BASES.find((x) => x.base === id);
  if (!b) return null;
  if (l2) return { id: entryId(l2, b.base), l2 };
  const only = b.l2.length === 1 ? b.l2[0] : undefined;
  return only ? { id: entryId(only, b.base), l2: only } : null;
}

/** First legacy binding of an old id (read side for history that has no L2 at all). */
export function legacyFirstL2(id: string): L2Id {
  return REJECT_BASES.find((b) => b.base === id)?.l2[0] ?? "RM";
}

/** Old L3-only slot mocks (pre-review) use these base labels. */
export const LEGACY_SLOT_BASES = REJECT_BASES.map((b) => ({ id: b.base, name: b.name, l2: b.l2 }));

/** Mock operator master for the "Nama operator" picker (real list comes from Master Data). */
export const MOCK_OPERATORS: string[] = [
  "Ahmad Fauzi",
  "Budi Santoso",
  "Citra Dewi",
  "Dedi Kurniawan",
  "Eka Pratama",
];

export function getRejectSlots(plantId: string, lineId: string): RejectSlot[] {
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const machines = line?.machines || [
    { code: "LCM07", name: "Cartoning" },
    { code: "LBF01", name: "Filler" },
  ];
  const machineCodes = machines.map((m) => m.code);

  const activeRejectTypes = LEGACY_SLOT_BASES;

  return [
    {
      slotId: `${lineId}-slot-1`,
      rejectTypeId: activeRejectTypes[0]?.id || null,
      rejectTypeName: activeRejectTypes[0]?.name || null,
      assignedMachine: machineCodes[0] || "LCM07",
      status: "Assigned",
      category: "Reject",
    },
    {
      slotId: `${lineId}-slot-2`,
      rejectTypeId: activeRejectTypes[1]?.id || null,
      rejectTypeName: activeRejectTypes[1]?.name || null,
      assignedMachine: machineCodes[1] || machineCodes[0] || "LCM07",
      status: "Assigned",
      category: "Reject",
    },
    {
      slotId: `${lineId}-slot-3`,
      rejectTypeId: activeRejectTypes[2]?.id || null,
      rejectTypeName: activeRejectTypes[2]?.name || null,
      assignedMachine: machineCodes[2] || machineCodes[0] || "LCM07",
      status: "Assigned",
      category: "Reject",
    },
    {
      slotId: `${lineId}-slot-4`,
      rejectTypeId: activeRejectTypes[3]?.id || null,
      rejectTypeName: activeRejectTypes[3]?.name || null,
      assignedMachine: machineCodes[3] || machineCodes[0] || "LCM07",
      status: "Assigned",
      category: "Reject",
    },
    {
      slotId: `${lineId}-slot-5`,
      rejectTypeId: activeRejectTypes[4]?.id || null,
      rejectTypeName: activeRejectTypes[4]?.name || null,
      assignedMachine: machineCodes[0] || "LCM07",
      status: "Assigned",
      category: "Reject",
    },
    {
      slotId: `${lineId}-slot-6`,
      rejectTypeId: activeRejectTypes[5]?.id || null,
      rejectTypeName: activeRejectTypes[5]?.name || null,
      assignedMachine: machineCodes[1] || machineCodes[0] || "LCM07",
      status: "Assigned",
      category: "Reject",
    },
    {
      slotId: `${lineId}-slot-7`,
      rejectTypeId: null,
      rejectTypeName: null,
      assignedMachine: null,
      status: "Unassigned",
    },
  ];
}
