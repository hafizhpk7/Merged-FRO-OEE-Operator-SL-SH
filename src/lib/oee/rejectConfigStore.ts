/**
 * CR 1 (Reject Category): reject slot configuration per machine.
 * One slot = one (L2, L3) pair on one machine (MD-01); the same pair never twice on a machine
 * (MD-08). A reason (L3) bound to several L2s is filled in separate slots, one per L2 (MD-09).
 *
 * Part A (the Master Data screen) is not built yet; this store is the read side the Operator
 * Reject page needs, plus save/validate/audit so the screen can be added on top of it.
 */
import { getLine } from "./data";
import { getRejectSlots, REJECT_TYPES } from "./rejectConfig";
import { getNowMs } from "./shiftClock";

export type L2Id = "RM" | "RP" | "RS";

export const REJECT_L2: { id: L2Id; short: L2Id; name: string; chipLabel: string }[] = [
  { id: "RM", short: "RM", name: "Reject mesin", chipLabel: "Reject mesin (RM)" },
  { id: "RP", short: "RP", name: "Reject proses", chipLabel: "Reject proses (RP)" },
  { id: "RS", short: "RS", name: "Reject supply", chipLabel: "Reject supply (RS)" },
];

const L2_ORDER: L2Id[] = ["RM", "RP", "RS"];

/**
 * Which L2(s) each reject reason (L3) is bound to. Mock of Issue Management (per plant/zone in the
 * real system). A reason can sit under several L2s, e.g. "Reject seal" under RM, RP and RS.
 */
const L3_BINDINGS: Record<string, L2Id[]> = {
  "reject-seal": ["RM", "RP", "RS"],
  "reject-leak": ["RM"],
  "reject-cap": ["RM", "RP"],
  "reject-label": ["RP", "RS"],
  "reject-print": ["RP"],
  "reject-dent": ["RM"],
  "netto-kurang": ["RP"],
  penyok: ["RM", "RS"],
  baret: ["RP", "RS"],
  bintik: ["RP"],
  miring: ["RM"],
};

export function getL3Bindings(l3Id: string): L2Id[] {
  return L3_BINDINGS[l3Id] ?? [];
}

export function l3Name(l3Id: string): string {
  return REJECT_TYPES.find((t) => t.id === l3Id)?.name ?? l3Id;
}

export type SlotConfig = { slotNo: number; l2Id: L2Id | null; l3Id: string | null };

export type RejectCard = {
  l3Id: string;
  name: string;
  category: "Reject" | "Rework";
  /** L2s this reason is bound to on this machine (from the slots), ordered RM, RP, RS. */
  l2: L2Id[];
};

export type SlotAudit = {
  at: string;
  user: string;
  machineKey: string;
  before: SlotConfig[];
  after: SlotConfig[];
};

type Stored = { slots: Record<string, SlotConfig[]>; audit: SlotAudit[] };
const STORAGE_KEY = "fro-oee-reject-slot-config-v1";
let cache: Stored = read();
const listeners = new Set<() => void>();

function read(): Stored {
  if (typeof window === "undefined") return { slots: {}, audit: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Stored>;
      return { slots: p.slots ?? {}, audit: p.audit ?? [] };
    }
  } catch {
    // ignore
  }
  return { slots: {}, audit: [] };
}

function write() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

const key = (plantId: string, lineId: string, machineCode: string) =>
  `${plantId}:${lineId}:${machineCode}`;

export function getLineMachineCodesForConfig(plantId: string, lineId: string): string[] {
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  return (line?.machines ?? []).map((m) => m.code || m.id);
}

/**
 * Default slots (migration of the old L3-only slots): every old slot assigned to this machine is
 * expanded to one slot per bound L2 (L2 filled automatically when only one, MD-05/MD-09).
 */
function defaultSlots(plantId: string, lineId: string, machineCode: string): SlotConfig[] {
  const out: SlotConfig[] = [];
  for (const old of getRejectSlots(plantId, lineId)) {
    if (old.status !== "Assigned" || !old.rejectTypeId || old.assignedMachine !== machineCode) continue;
    if (old.category === "Rework") continue;
    const l2s = getL3Bindings(old.rejectTypeId);
    for (const l2 of l2s.length ? l2s : (["RM"] as L2Id[])) {
      out.push({ slotNo: out.length + 1, l2Id: l2, l3Id: old.rejectTypeId });
    }
  }
  return out;
}

export const rejectConfigStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  /** All slots of one machine (empty slots included when the machine was configured). */
  getSlots(plantId: string, lineId: string, machineCode: string): SlotConfig[] {
    return cache.slots[key(plantId, lineId, machineCode)] ?? defaultSlots(plantId, lineId, machineCode);
  },

  /** Assigned slots (L2 and L3 complete) of every machine of the line. */
  getLineSlots(plantId: string, lineId: string) {
    const out: { machineCode: string; slotNo: number; l2Id: L2Id; l3Id: string }[] = [];
    for (const m of getLineMachineCodesForConfig(plantId, lineId)) {
      for (const s of this.getSlots(plantId, lineId, m)) {
        if (s.l2Id && s.l3Id) out.push({ machineCode: m, slotNo: s.slotNo, l2Id: s.l2Id, l3Id: s.l3Id });
      }
    }
    return out;
  },

  /** One card per L3 on the machine, with all L2s it is bound to (OP-06). */
  getCards(plantId: string, lineId: string, machineCode: string): RejectCard[] {
    const order: string[] = [];
    const map = new Map<string, Set<L2Id>>();
    for (const s of this.getSlots(plantId, lineId, machineCode)) {
      if (!s.l2Id || !s.l3Id) continue;
      if (!map.has(s.l3Id)) {
        map.set(s.l3Id, new Set());
        order.push(s.l3Id);
      }
      map.get(s.l3Id)?.add(s.l2Id);
    }
    return order.map((l3Id) => ({
      l3Id,
      name: l3Name(l3Id),
      category: REJECT_TYPES.find((t) => t.id === l3Id)?.category ?? "Reject",
      l2: L2_ORDER.filter((l2) => map.get(l3Id)?.has(l2)),
    }));
  },

  /** L2 a reject box / QA input goes to when none is given: first configured slot of that L3. */
  defaultL2(plantId: string, lineId: string, machineCode: string, l3Id: string): L2Id {
    const slot = this.getSlots(plantId, lineId, machineCode).find((s) => s.l3Id === l3Id && s.l2Id);
    return slot?.l2Id ?? getL3Bindings(l3Id)[0] ?? "RM";
  },

  /**
   * "Reject lain" candidates (CR 1 OP-20): reasons bound to the chosen L2, available in the zone of
   * the line, that have no card yet on this machine. Zone scoping is a mock: every reject reason
   * with a binding is available in every zone until Issue Management provides per-zone lists.
   */
  getOtherL3Options(
    plantId: string,
    lineId: string,
    machineCode: string,
    l2Id: L2Id,
  ): { l3Id: string; name: string; category: "Reject" | "Rework" }[] {
    const line =
      getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
    void line?.zoneId; // zone the reasons are scoped to (mock: all zones share the list)
    const hasCard = new Set(this.getCards(plantId, lineId, machineCode).map((c) => c.l3Id));
    return REJECT_TYPES.filter(
      (t) => t.category === "Reject" && getL3Bindings(t.id).includes(l2Id) && !hasCard.has(t.id),
    ).map((t) => ({ l3Id: t.id, name: t.name, category: t.category }));
  },

  /** MD-06/MD-08/MD-10 checks used by the (future) Master Data screen and by saveSlots. */
  validate(slots: SlotConfig[]): { slotNo: number; status: "Assigned" | "Unassigned" | "Pilih kategori" | "Duplikat" }[] {
    const seen = new Set<string>();
    return slots.map((s) => {
      if (!s.l2Id && !s.l3Id) return { slotNo: s.slotNo, status: "Unassigned" as const };
      if (s.l3Id && !s.l2Id) return { slotNo: s.slotNo, status: "Pilih kategori" as const };
      if (s.l2Id && !s.l3Id) return { slotNo: s.slotNo, status: "Pilih kategori" as const };
      const k = `${s.l2Id}|${s.l3Id}`;
      if (seen.has(k)) return { slotNo: s.slotNo, status: "Duplikat" as const };
      seen.add(k);
      return { slotNo: s.slotNo, status: "Assigned" as const };
    });
  },

  /** Saves all slots of a machine (MD-13). Fails without writing on duplicates/incomplete slots. */
  saveSlots(
    plantId: string,
    lineId: string,
    machineCode: string,
    slots: SlotConfig[],
    user = "Operator",
  ): { ok: true } | { ok: false; errors: string[] } {
    const statuses = this.validate(slots);
    const errors = statuses
      .filter((s) => s.status === "Duplikat" || s.status === "Pilih kategori")
      .map((s) => `Slot ${s.slotNo}: ${s.status}`);
    if (errors.length) return { ok: false, errors };
    const k = key(plantId, lineId, machineCode);
    const before = this.getSlots(plantId, lineId, machineCode);
    cache = {
      slots: { ...cache.slots, [k]: slots },
      audit: [
        ...cache.audit,
        { at: new Date(getNowMs()).toISOString(), user, machineKey: k, before, after: slots },
      ].slice(-200),
    };
    write();
    listeners.forEach((l) => l());
    return { ok: true };
  },

  getAudit(): SlotAudit[] {
    return cache.audit.slice();
  },

  /** Test helper. */
  _resetForTest() {
    cache = { slots: {}, audit: [] };
    write();
    listeners.forEach((l) => l());
  },
};
