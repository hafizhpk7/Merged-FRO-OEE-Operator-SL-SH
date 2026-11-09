/**
 * CR 1 (Reject Category), review version: reject slot configuration per machine.
 * One slot = one (L2, L3) pair on one machine. Every L3 entry belongs to exactly ONE L2, so a label
 * needed under another L2 is a separate entry with its own id; to show it under RS and RM the user
 * configures two slots. The same (machine, L2, L3) never twice (Duplicate).
 */
import { getLine } from "./data";
import {
  entryName,
  getEntriesForL2,
  getEntry,
  getRejectSlots,
  L2_IDS,
  migrateL3,
  REJECT_TYPES,
  type L2Id,
  type RejectTypeItem,
} from "./rejectConfig";
import { getNowMs } from "./shiftClock";

export type { L2Id } from "./rejectConfig";

export const REJECT_L2: { id: L2Id; short: L2Id; name: string; chipLabel: string }[] = [
  { id: "RM", short: "RM", name: "Reject mesin", chipLabel: "Reject mesin (RM)" },
  { id: "RP", short: "RP", name: "Reject proses", chipLabel: "Reject proses (RP)" },
  { id: "RS", short: "RS", name: "Reject supply", chipLabel: "Reject supply (RS)" },
];

export function l3Name(l3Id: string): string {
  return entryName(l3Id);
}

/** L3 entries a slot of this L2 may pick (Master Data: L2 first, then L3 restricted to it). */
export function getL3Options(l2: L2Id): RejectTypeItem[] {
  return getEntriesForL2(l2);
}

export type SlotConfig = { slotNo: number; l2Id: L2Id | null; l3Id: string | null };
export type SlotStatus = "Assigned" | "Unassigned" | "Incomplete" | "Duplicate";

export type RejectCard = {
  /** L3 entry id (unique per L2). */
  l3Id: string;
  name: string;
  category: "Reject" | "Rework";
  /** The single L2 of the card. */
  l2: L2Id;
};

export type SlotAudit = {
  at: string;
  user: string;
  machineKey: string;
  before: SlotConfig[];
  after: SlotConfig[];
};

type Stored = { slots: Record<string, SlotConfig[]>; audit: SlotAudit[] };
const STORAGE_KEY = "fro-oee-reject-slot-config-v2";
const LEGACY_KEY = "fro-oee-reject-slot-config-v1";

/**
 * Review migration of one stored slot: explicit L2 is kept and the L3 becomes the entry under it;
 * a legacy slot without L2 takes the L2 of its single original binding, ambiguous ones become
 * Unassigned.
 */
export function migrateSlot(s: SlotConfig): SlotConfig {
  if (!s.l3Id) return s;
  const m = migrateL3(s.l3Id, s.l2Id);
  if (!m || !getEntry(m.id)) return { slotNo: s.slotNo, l2Id: null, l3Id: null };
  return { slotNo: s.slotNo, l2Id: m.l2, l3Id: m.id };
}

function read(): Stored {
  if (typeof window === "undefined") return { slots: {}, audit: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Stored>;
      return { slots: p.slots ?? {}, audit: p.audit ?? [] };
    }
    const old = localStorage.getItem(LEGACY_KEY);
    if (old) {
      const p = JSON.parse(old) as Partial<Stored>;
      const slots: Record<string, SlotConfig[]> = {};
      for (const [k, list] of Object.entries(p.slots ?? {})) slots[k] = list.map(migrateSlot);
      const migrated = { slots, audit: [] as SlotAudit[] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // ignore
  }
  return { slots: {}, audit: [] };
}

let cache: Stored = read();
const listeners = new Set<() => void>();

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
 * expanded to one slot per L2 it used to be bound to, each pointing at that L2's own entry.
 */
function defaultSlots(plantId: string, lineId: string, machineCode: string): SlotConfig[] {
  const out: SlotConfig[] = [];
  for (const old of getRejectSlots(plantId, lineId)) {
    if (old.status !== "Assigned" || !old.rejectTypeId || old.assignedMachine !== machineCode) continue;
    if (old.category === "Rework") continue;
    const l2s = REJECT_TYPES.filter((t) => t.category === "Reject" && t.id.endsWith(`.${old.rejectTypeId}`));
    for (const e of l2s) out.push({ slotNo: out.length + 1, l2Id: e.l2 ?? null, l3Id: e.id });
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

  /** One card per assigned slot (one L2 each). The same label under RM and RS is two cards. */
  getCards(plantId: string, lineId: string, machineCode: string): RejectCard[] {
    const seen = new Set<string>();
    const out: RejectCard[] = [];
    for (const s of this.getSlots(plantId, lineId, machineCode)) {
      if (!s.l2Id || !s.l3Id || seen.has(s.l3Id)) continue;
      seen.add(s.l3Id);
      out.push({
        l3Id: s.l3Id,
        name: l3Name(s.l3Id),
        category: getEntry(s.l3Id)?.category ?? "Reject",
        l2: s.l2Id,
      });
    }
    return out;
  },

  /** Per-slot status: Unassigned, Incomplete (L2 or L3 missing, or L3 not under the L2), Duplicate, Assigned. */
  validate(slots: SlotConfig[]): { slotNo: number; status: SlotStatus }[] {
    const seen = new Set<string>();
    return slots.map((s) => {
      if (!s.l2Id && !s.l3Id) return { slotNo: s.slotNo, status: "Unassigned" as const };
      if (!s.l2Id || !s.l3Id) return { slotNo: s.slotNo, status: "Incomplete" as const };
      if (getEntry(s.l3Id)?.l2 !== s.l2Id) return { slotNo: s.slotNo, status: "Incomplete" as const };
      const k = `${s.l2Id}|${s.l3Id}`;
      if (seen.has(k)) return { slotNo: s.slotNo, status: "Duplicate" as const };
      seen.add(k);
      return { slotNo: s.slotNo, status: "Assigned" as const };
    });
  },

  /** Saves all slots of a machine. Fails without writing on duplicates/incomplete slots. */
  saveSlots(
    plantId: string,
    lineId: string,
    machineCode: string,
    slots: SlotConfig[],
    user = "Operator",
  ): { ok: true } | { ok: false; errors: string[] } {
    const statuses = this.validate(slots);
    const errors = statuses
      .filter((s) => s.status === "Duplicate" || s.status === "Incomplete")
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

export { L2_IDS };
