import { getLine } from "./data";

export type RejectSlot = {
  slotId: string;
  rejectTypeId: string | null;
  rejectTypeName: string | null;
  assignedMachine: string | null;
  status: "Assigned" | "Unassigned";
  category?: "Reject" | "Rework";
};

export type RejectTypeItem = {
  id: string;
  name: string;
  category: "Reject" | "Rework";
};

export const REJECT_TYPES: RejectTypeItem[] = [
  { id: "reject-seal", name: "Reject seal", category: "Reject" },
  { id: "reject-leak", name: "Reject Leak", category: "Reject" },
  { id: "reject-cap", name: "Reject Cap", category: "Reject" },
  { id: "reject-label", name: "Reject Label", category: "Reject" },
  { id: "reject-print", name: "Reject Print", category: "Reject" },
  { id: "reject-dent", name: "Reject Dent", category: "Reject" },
  { id: "netto-kurang", name: "Netto kurang", category: "Reject" },
  { id: "penyok", name: "Penyok", category: "Reject" },
  { id: "baret", name: "Baret", category: "Reject" },
  { id: "bintik", name: "Bintik", category: "Reject" },
  { id: "miring", name: "Miring", category: "Reject" },
  { id: "rework", name: "Rework", category: "Rework" },
];

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

  const activeRejectTypes = REJECT_TYPES.filter((t) => t.category === "Reject");

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
