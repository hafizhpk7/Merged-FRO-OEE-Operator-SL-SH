import { useSyncExternalStore } from "react";
import { REJECT_TYPES } from "./rejectConfig";
import { l3Name, rejectConfigStore, type L2Id } from "./rejectConfigStore";
import { makeRng, rand } from "./rng";
import { formatTimeWib, getShiftInfo } from "./shiftClock";
import { getNow, getNowMs } from "./shiftClock";

export type RejectLogSource = "sensor" | "manual" | "qa" | "correction";

export type RejectLog = {
  id: string;
  plantId: string;
  lineId: string;
  machineCode: string;
  /** L3 (reject reason). Same value as l3Id; kept for older readers. */
  rejectTypeId: string;
  rejectTypeName: string;
  /** CR 1: L2 (RM/RP/RS) is stored explicitly so later configuration changes never rewrite history. */
  l2Id: L2Id;
  l3Id: string;
  qty: number;
  source: RejectLogSource;
  at: number; // timestamp in seconds
  note?: string;
  createdAt: number;
  category: "Reject" | "Rework";
  shiftKey: string;
};

/**
 * Operator correction of a reject bucket (Reject page, "Konfigurasi Detail").
 * `delta` is applied on top of the actual (sensor) value at one minute of one hourly bucket;
 * negative values reduce the actual.
 */
export type RejectCorrection = {
  id: string;
  plantId: string;
  lineId: string;
  machineCode: string;
  rejectTypeId: string;
  rejectTypeName: string;
  /** L2 the correction belongs to (older stored corrections have none: default L2 applies). */
  l2Id?: L2Id;
  /** Confirmation captured with the save (CR 1 OP-16/OP-17). Older entries have none. */
  reason?: string;
  leader?: string;
  category: "Reject" | "Rework";
  shiftKey: string;
  hourIdx: number; // 0..7 from shift start
  minute: number; // 0..59
  delta: number; // non-zero integer
  operator: string;
  createdAt: number;
};

/** CR 1 OP-19: one row per changed (hour, minute, L2) of a save. before/after/delta are correction values. */
export type CorrectionAudit = {
  id: string;
  savedAt: number; // epoch ms
  operator: string;
  reason: string;
  leader: string;
  plantId: string;
  lineId: string;
  shiftKey: string;
  machineCode: string;
  l3Id: string;
  l3Name: string;
  l2Id: L2Id;
  hourIdx: number;
  minute: number;
  before: number;
  after: number;
  delta: number;
  /** Current (reject pcs) of the whole hour for this reason before and after the save. */
  hourCurrentBefore: number;
  hourCurrentAfter: number;
};

export type CorrectionChange = { hourIdx: number; minute: number; l2Id: L2Id; after: number };

type RejectStoreSchema = {
  userLogs: RejectLog[];
  removedLogIds: string[];
  corrections: RejectCorrection[];
  audit: CorrectionAudit[];
};

const EMPTY_STATE = (): RejectStoreSchema => ({
  userLogs: [],
  removedLogIds: [],
  corrections: [],
  audit: [],
});
const AUDIT_LIMIT = 500;
let correctionSeq = 0;
let entrySeq = 0; // deterministic counter for entry ids (no random ids in this project)

const STORAGE_KEY = "fro-oee-reject-logs-v1";

type StoreListener = () => void;
const listeners = new Set<StoreListener>();

// Without browser storage (Node self-tests) this memory copy is the store.
let memState: RejectStoreSchema = EMPTY_STATE();

function getStoredState(): RejectStoreSchema {
  if (typeof window === "undefined") {
    return {
      userLogs: [...memState.userLogs],
      removedLogIds: [...memState.removedLogIds],
      corrections: [...memState.corrections],
      audit: [...memState.audit],
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE();
    const parsed = JSON.parse(raw) as Partial<RejectStoreSchema>;
    return {
      userLogs: parsed.userLogs ?? [],
      removedLogIds: parsed.removedLogIds ?? [],
      corrections: parsed.corrections ?? [],
      audit: parsed.audit ?? [],
    };
  } catch {
    return EMPTY_STATE();
  }
}

function saveStoredState(state: RejectStoreSchema): void {
  if (typeof window === "undefined") {
    memState = state;
    emitChange();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emitChange();
  } catch {
    // ignore
  }
}

let currentCache = getStoredState();

function emitChange() {
  currentCache = getStoredState();
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      emitChange();
    }
  });
}

// ---- configuration snapshot per shift ---------------------------------------------------
// Sensor entries are generated from the slot configuration. To keep history stable when the
// configuration changes (CR 1 3.1), a shift that is no longer current uses the configuration it
// last had while it was current (frozen at first sight when it was never seen live).
type LineSlots = ReturnType<typeof rejectConfigStore.getLineSlots>;
const SNAPSHOT_KEY = "fro-oee-reject-baseline-config-v1";
const slotSnapshots: Record<string, LineSlots> = (() => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LineSlots>) : {};
  } catch {
    return {};
  }
})();

function persistSnapshots() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(slotSnapshots));
  } catch {
    // ignore
  }
}

function slotsForShift(plantId: string, lineId: string, shiftKey: string, isCurrent: boolean): LineSlots {
  const k = `${plantId}:${lineId}:${shiftKey}`;
  const live = rejectConfigStore.getLineSlots(plantId, lineId);
  const existing = slotSnapshots[k];
  if (isCurrent) {
    if (!existing || JSON.stringify(existing) !== JSON.stringify(live)) {
      slotSnapshots[k] = live;
      persistSnapshots();
    }
    return live;
  }
  if (existing) return existing;
  slotSnapshots[k] = live;
  persistSnapshots();
  return live;
}

/** Test helper: forget the frozen configuration of one shift. */
export function _forgetSlotSnapshot(plantId: string, lineId: string, shiftKey: string) {
  delete slotSnapshots[`${plantId}:${lineId}:${shiftKey}`];
  persistSnapshots();
}

/**
 * Sensor baseline per machine and reason (L3), split over the machine's slots of that L3: a reason
 * bound to several L2s gets one slot per L2 and its sensor input is spread across them (CR 1).
 * Deterministic: seeded by plant, line, shift, machine and L3.
 */
function generateBaselineLogs(plantId: string, lineId: string, shiftKey: string): RejectLog[] {
  const logs: RejectLog[] = [];
  const shiftInfo = getShiftInfo();
  const shiftStartSec = shiftInfo.startSec;
  const nowSec = Math.floor(getNowMs() / 1000);

  const groups = new Map<string, { machineCode: string; l3Id: string; l2s: L2Id[] }>();
  for (const slot of slotsForShift(plantId, lineId, shiftKey, shiftKey === shiftInfo.shiftKey)) {
    const k = `${slot.machineCode}|${slot.l3Id}`;
    const g = groups.get(k) ?? { machineCode: slot.machineCode, l3Id: slot.l3Id, l2s: [] };
    if (!g.l2s.includes(slot.l2Id)) g.l2s.push(slot.l2Id);
    groups.set(k, g);
  }

  for (const g of groups.values()) {
    const rng = makeRng(`${plantId}:${lineId}:${shiftKey}:${g.machineCode}:${g.l3Id}`);
    const name = l3Name(g.l3Id);
    const category = REJECT_TYPES.find((t) => t.id === g.l3Id)?.category ?? "Reject";

    for (let h = 0; h < 8; h++) {
      const hourStartSec = shiftStartSec + h * 3600;
      if (shiftKey === shiftInfo.shiftKey && hourStartSec > nowSec) {
        continue;
      }

      const count = Math.floor(rng() * 3) + 1;
      for (let c = 0; c < count; c++) {
        const offsetMin = Math.floor(rng() * 60);
        const atSec = hourStartSec + offsetMin * 60;
        const qty = Math.floor(rng() * 3) + 1;
        // which slot (L2) this sensor entry lands in
        const l2Id = g.l2s[Math.floor(rng() * g.l2s.length)] ?? "RM";
        logs.push({
          id: `sensor-${lineId}-${g.machineCode}-${g.l3Id}-${l2Id}-h${h}-c${c}`,
          plantId,
          lineId,
          machineCode: g.machineCode,
          rejectTypeId: g.l3Id,
          rejectTypeName: name,
          l2Id,
          l3Id: g.l3Id,
          qty,
          source: "sensor",
          at: atSec,
          createdAt: atSec * 1000,
          category,
          shiftKey,
        });
      }
    }
  }

  return logs;
}

/** Entries stored before CR 1 have no L2: give them the machine's default L2 (read side only). */
function withL2(log: RejectLog): RejectLog {
  if (log.l2Id && log.l3Id) return log;
  const l3Id = log.l3Id ?? log.rejectTypeId;
  const l2Id =
    log.l2Id ?? rejectConfigStore.defaultL2(log.plantId, log.lineId, log.machineCode, l3Id);
  return { ...log, l3Id, l2Id };
}

const L2_KEYS: L2Id[] = ["RM", "RP", "RS"];
const emptyByL2 = (): Record<L2Id, number> => ({ RM: 0, RP: 0, RS: 0 });
const emptyHoursByL2 = (): Record<L2Id, number[]> => ({
  RM: new Array(8).fill(0),
  RP: new Array(8).fill(0),
  RS: new Array(8).fill(0),
});

export const rejectStore = {
  subscribe(listener: StoreListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): RejectStoreSchema {
    return currentCache;
  },

  getAllLogs(plantId: string, lineId: string, shiftKey: string): RejectLog[] {
    const state = currentCache;
    const baseline = generateBaselineLogs(plantId, lineId, shiftKey);
    const shiftStartSec = getShiftInfo().startSec;
    const correctionLogs: RejectLog[] = state.corrections
      .filter((c) => c.plantId === plantId && c.lineId === lineId && c.shiftKey === shiftKey)
      .map((c) => ({
        id: c.id,
        plantId: c.plantId,
        lineId: c.lineId,
        machineCode: c.machineCode,
        rejectTypeId: c.rejectTypeId,
        rejectTypeName: c.rejectTypeName,
        l3Id: c.rejectTypeId,
        l2Id:
          c.l2Id ??
          rejectConfigStore.defaultL2(c.plantId, c.lineId, c.machineCode, c.rejectTypeId),
        qty: c.delta,
        source: "correction" as const,
        at: shiftStartSec + c.hourIdx * 3600 + c.minute * 60,
        note: `Koreksi ${c.operator}`,
        createdAt: c.createdAt,
        category: c.category,
        shiftKey: c.shiftKey,
      }));
    const combined = [...baseline, ...state.userLogs.map(withL2), ...correctionLogs];
    return combined.filter((log) => !state.removedLogIds.includes(log.id));
  },

  getTotals(plantId: string, lineId: string, shiftKey: string, machineCode?: string) {
    const logs = this.getAllLogs(plantId, lineId, shiftKey).filter(
      (l) => !machineCode || l.machineCode === machineCode,
    );
    let totalReject = 0;
    let totalRework = 0;
    let sensor = 0;
    let manual = 0;
    let qa = 0;
    let correction = 0;

    for (const log of logs) {
      if (log.category === "Rework") {
        totalRework += log.qty;
      } else {
        totalReject += log.qty;
      }
      if (log.source === "sensor") sensor += log.qty;
      else if (log.source === "manual") manual += log.qty;
      else if (log.source === "qa") qa += log.qty;
      else if (log.source === "correction") correction += log.qty;
    }

    return {
      totalReject,
      totalRework,
      sensor,
      manual,
      qa,
      correction,
    };
  },

  /**
   * Hourly Actual (sensor baseline) and Current (after manual entries and corrections) for one L3
   * on one machine, per L2. Not clamped: Current + corrections are exactly what getTotals sums.
   */
  getHourlyByL2(
    plantId: string,
    lineId: string,
    shiftKey: string,
    rejectTypeId: string,
    machineCode?: string,
  ) {
    const state = currentCache;
    const baseline = generateBaselineLogs(plantId, lineId, shiftKey);
    const removed = state.removedLogIds;
    const shiftStartSec = getShiftInfo().startSec;
    const actual = emptyHoursByL2();
    const current = emptyHoursByL2();
    const match = (l: RejectLog) =>
      l.rejectTypeId === rejectTypeId &&
      (!machineCode || l.machineCode === machineCode) &&
      !removed.includes(l.id);

    for (const log of baseline.filter(match)) {
      const h = Math.floor((log.at - shiftStartSec) / 3600);
      if (h >= 0 && h < 8) actual[log.l2Id][h] = (actual[log.l2Id][h] ?? 0) + log.qty;
    }
    for (const raw of [...baseline, ...state.userLogs].filter(match)) {
      const log = withL2(raw);
      const h = Math.floor((log.at - shiftStartSec) / 3600);
      if (h >= 0 && h < 8) current[log.l2Id][h] = (current[log.l2Id][h] ?? 0) + log.qty;
    }
    for (const c of state.corrections) {
      if (
        c.plantId === plantId &&
        c.lineId === lineId &&
        c.shiftKey === shiftKey &&
        c.rejectTypeId === rejectTypeId &&
        (!machineCode || c.machineCode === machineCode) &&
        c.hourIdx >= 0 &&
        c.hourIdx < 8
      ) {
        const l2 =
          c.l2Id ?? rejectConfigStore.defaultL2(c.plantId, c.lineId, c.machineCode, c.rejectTypeId);
        current[l2][c.hourIdx] = (current[l2][c.hourIdx] ?? 0) + c.delta;
      }
    }
    return { actual, current };
  },

  /** Hourly series for the chart (bars = Current, dashed = Actual), optionally for one L2. */
  getHourlySeries(
    plantId: string,
    lineId: string,
    shiftKey: string,
    rejectTypeId: string,
    machineCode?: string,
    l2Id?: L2Id,
  ) {
    const by = this.getHourlyByL2(plantId, lineId, shiftKey, rejectTypeId, machineCode);
    const keys = l2Id ? [l2Id] : L2_KEYS;
    const sum = (src: Record<L2Id, number[]>, clamp: boolean) =>
      Array.from({ length: 8 }, (_, h) => {
        const total = keys.reduce((acc, k) => acc + (src[k][h] ?? 0), 0);
        return clamp ? Math.max(0, total) : total;
      });
    return { actual: sum(by.actual, false), current: sum(by.current, true) };
  },

  /**
   * Reject (not rework) Current per L2 and per L3 for one machine, straight from the same logs
   * getTotals uses, so chips, cards and every KPI agree. "other" = L3 without a card.
   */
  getCategoryTotals(plantId: string, lineId: string, shiftKey: string, machineCode: string) {
    const logs = this.getAllLogs(plantId, lineId, shiftKey).filter(
      (l) => l.machineCode === machineCode && l.category !== "Rework",
    );
    const cardIds = new Set(
      rejectConfigStore.getCards(plantId, lineId, machineCode).map((c) => c.l3Id),
    );
    const byL2 = emptyByL2();
    const byL3: Record<string, Record<L2Id, number>> = {};
    const other = emptyByL2();
    const otherByL3: Record<string, { name: string; total: number; byL2: Record<L2Id, number> }> = {};
    for (const l of logs) {
      byL2[l.l2Id] += l.qty;
      if (cardIds.has(l.l3Id)) {
        const row = byL3[l.l3Id] ?? emptyByL2();
        row[l.l2Id] += l.qty;
        byL3[l.l3Id] = row;
      } else {
        other[l.l2Id] += l.qty;
        const o = otherByL3[l.l3Id] ?? { name: l.rejectTypeName, total: 0, byL2: emptyByL2() };
        o.total += l.qty;
        o.byL2[l.l2Id] += l.qty;
        otherByL3[l.l3Id] = o;
      }
    }
    const total = byL2.RM + byL2.RP + byL2.RS;
    return {
      byL2,
      byL3,
      other,
      otherByL3,
      otherTotal: other.RM + other.RP + other.RS,
      total,
    };
  },

  getCorrections(
    plantId: string,
    lineId: string,
    shiftKey: string,
    rejectTypeId: string,
    machineCode: string,
  ): RejectCorrection[] {
    return currentCache.corrections
      .filter(
        (c) =>
          c.plantId === plantId &&
          c.lineId === lineId &&
          c.shiftKey === shiftKey &&
          c.rejectTypeId === rejectTypeId &&
          c.machineCode === machineCode,
      )
      .sort((a, b) => a.hourIdx - b.hourIdx || a.minute - b.minute);
  },

  /**
   * Saves the operator's correction edits for one reason (L3) on one machine (CR 1 OP-10..OP-19).
   * `changes` give the NEW correction value for each (hour, minute, L2): 0 removes it. Only values
   * that differ from what is stored are written, and every written value gets an audit row with
   * before, after and delta. Fails without writing when the confirmation fields are blank, a value
   * is not an integer, an hour would drop below 0, or nothing changed.
   */
  saveCorrections(payload: {
    plantId: string;
    lineId: string;
    shiftKey: string;
    machineCode: string;
    l3Id: string;
    l3Name: string;
    category: "Reject" | "Rework";
    operator: string;
    reason: string;
    leader: string;
    changes: CorrectionChange[];
  }): { ok: true; audit: CorrectionAudit[] } | { ok: false; errors: string[] } {
    const errors: string[] = [];
    if (!payload.operator.trim()) errors.push("Nama operator wajib dipilih.");
    if (!payload.reason.trim()) errors.push("Alasan perubahan wajib diisi.");
    if (!payload.leader.trim()) errors.push("Nama leader / superior wajib diisi.");
    for (const c of payload.changes) {
      if (!Number.isInteger(c.after)) errors.push("Qty harus bilangan bulat.");
      if (!Number.isInteger(c.hourIdx) || c.hourIdx < 0 || c.hourIdx > 7) errors.push("Jam di luar shift.");
      if (!Number.isInteger(c.minute) || c.minute < 0 || c.minute > 59) errors.push("Menit tidak valid.");
    }
    if (errors.length) return { ok: false, errors };

    const state = getStoredState();
    const sameScope = (c: RejectCorrection) =>
      c.plantId === payload.plantId &&
      c.lineId === payload.lineId &&
      c.shiftKey === payload.shiftKey &&
      c.machineCode === payload.machineCode &&
      c.rejectTypeId === payload.l3Id;
    const l2Of = (c: RejectCorrection): L2Id =>
      c.l2Id ?? rejectConfigStore.defaultL2(c.plantId, c.lineId, c.machineCode, c.rejectTypeId);
    const keyOf = (h: number, m: number, l2: L2Id) => `${h}|${m}|${l2}`;

    const beforeMap = new Map<string, number>();
    for (const c of state.corrections.filter(sameScope)) {
      const k = keyOf(c.hourIdx, c.minute, l2Of(c));
      beforeMap.set(k, (beforeMap.get(k) ?? 0) + c.delta);
    }
    const wanted = new Map<string, CorrectionChange>();
    for (const c of payload.changes) wanted.set(keyOf(c.hourIdx, c.minute, c.l2Id), c);
    const effective = [...wanted.entries()]
      .map(([k, c]) => ({ k, c, before: beforeMap.get(k) ?? 0 }))
      .filter((e) => e.c.after !== e.before);
    if (effective.length === 0) return { ok: false, errors: ["Tidak ada perubahan nilai."] };

    // OP-15: actual + all corrections of an hour never below 0
    const by = this.getHourlyByL2(payload.plantId, payload.lineId, payload.shiftKey, payload.l3Id, payload.machineCode);
    const hourBefore: Record<number, number> = {};
    const hourAfter: Record<number, number> = {};
    for (const e of effective) {
      const h = e.c.hourIdx;
      if (hourBefore[h] === undefined) {
        hourBefore[h] = L2_KEYS.reduce((acc, k) => acc + (by.current[k][h] ?? 0), 0);
        hourAfter[h] = hourBefore[h];
      }
      hourAfter[h] = (hourAfter[h] ?? 0) + (e.c.after - e.before);
    }
    const shiftStartSec = getShiftInfo().startSec;
    for (const [h, v] of Object.entries(hourAfter)) {
      if (v < 0) {
        const label = formatTimeWib(shiftStartSec + Number(h) * 3600);
        return { ok: false, errors: [`Pengurangan melebihi nilai actual pada ${label}.`] };
      }
    }

    const touched = new Set(effective.map((e) => e.k));
    state.corrections = state.corrections.filter(
      (c) => !(sameScope(c) && touched.has(keyOf(c.hourIdx, c.minute, l2Of(c)))),
    );
    const now = getNowMs();
    const audit: CorrectionAudit[] = [];
    for (const e of effective) {
      correctionSeq += 1;
      if (e.c.after !== 0) {
        state.corrections.push({
          id: `corr-${payload.shiftKey}-${payload.l3Id}-${payload.machineCode}-${e.c.hourIdx}-${e.c.minute}-${e.c.l2Id}-${correctionSeq}`,
          plantId: payload.plantId,
          lineId: payload.lineId,
          machineCode: payload.machineCode,
          rejectTypeId: payload.l3Id,
          rejectTypeName: payload.l3Name,
          l2Id: e.c.l2Id,
          category: payload.category,
          shiftKey: payload.shiftKey,
          hourIdx: e.c.hourIdx,
          minute: e.c.minute,
          delta: e.c.after,
          operator: payload.operator.trim(),
          reason: payload.reason.trim(),
          leader: payload.leader.trim(),
          createdAt: now,
        });
      }
      audit.push({
        id: `aud-${payload.shiftKey}-${correctionSeq}`,
        savedAt: now,
        operator: payload.operator.trim(),
        reason: payload.reason.trim(),
        leader: payload.leader.trim(),
        plantId: payload.plantId,
        lineId: payload.lineId,
        shiftKey: payload.shiftKey,
        machineCode: payload.machineCode,
        l3Id: payload.l3Id,
        l3Name: payload.l3Name,
        l2Id: e.c.l2Id,
        hourIdx: e.c.hourIdx,
        minute: e.c.minute,
        before: e.before,
        after: e.c.after,
        delta: e.c.after - e.before,
        hourCurrentBefore: hourBefore[e.c.hourIdx] ?? 0,
        hourCurrentAfter: hourAfter[e.c.hourIdx] ?? 0,
      });
    }
    state.audit = [...state.audit, ...audit].slice(-AUDIT_LIMIT);
    saveStoredState(state);
    return { ok: true, audit };
  },

  /** Audit trail (newest first), optionally narrowed to one machine and reason. */
  getAudit(plantId: string, lineId: string, machineCode?: string, l3Id?: string): CorrectionAudit[] {
    return currentCache.audit
      .filter(
        (a) =>
          a.plantId === plantId &&
          a.lineId === lineId &&
          (!machineCode || a.machineCode === machineCode) &&
          (!l3Id || a.l3Id === l3Id),
      )
      .sort((a, b) => b.savedAt - a.savedAt || (a.id < b.id ? 1 : -1));
  },

  /** Test helper: drop corrections and audit rows written under one operator name. */
  _purgeByOperator(operator: string) {
    const state = getStoredState();
    state.corrections = state.corrections.filter((c) => c.operator !== operator);
    state.audit = state.audit.filter((a) => a.operator !== operator);
    saveStoredState(state);
  },

  getDailyTrend(plantId: string, lineId: string, rejectTypeIds: string[]) {
    const days = 7;
    const result: { dateLabel: string; total: number }[] = [];
    const now = getNow();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateLabel = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const dateKeyStr = d.toISOString().split("T")[0];

      let dayTotal = 0;
      for (const rId of rejectTypeIds) {
        const seed = `${plantId}:${lineId}:${dateKeyStr}:${rId}`;
        dayTotal += Math.floor(rand(seed, 8, 35));
      }
      result.push({ dateLabel, total: dayTotal });
    }
    return result;
  },

  addQaReject(payload: {
    plantId: string;
    lineId: string;
    machineCode: string;
    rejectTypeId: string;
    rejectTypeName: string;
    qty: number;
    at: number;
    note?: string;
    shiftKey: string;
    l2Id?: L2Id;
  }) {
    const state = getStoredState();
    entrySeq += 1;
    const newLog: RejectLog = {
      id: `qa-${Date.now()}-${entrySeq}`,
      plantId: payload.plantId,
      lineId: payload.lineId,
      machineCode: payload.machineCode,
      rejectTypeId: payload.rejectTypeId,
      rejectTypeName: payload.rejectTypeName,
      l3Id: payload.rejectTypeId,
      l2Id:
        payload.l2Id ??
        rejectConfigStore.defaultL2(
          payload.plantId,
          payload.lineId,
          payload.machineCode,
          payload.rejectTypeId,
        ),
      qty: payload.qty,
      source: "qa",
      at: payload.at,
      ...(payload.note ? { note: payload.note } : {}),
      createdAt: Date.now(),
      category: "Reject",
      shiftKey: payload.shiftKey,
    };
    state.userLogs.push(newLog);
    saveStoredState(state);
  },

  resetDemoData() {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      emitChange();
    } catch {
      // ignore
    }
  },
};

export function useRejectStore(plantId: string, lineId: string, shiftKey: string) {
  const store = useSyncExternalStore(
    rejectStore.subscribe,
    rejectStore.getSnapshot,
    rejectStore.getSnapshot,
  );
  return {
    logs: rejectStore.getAllLogs(plantId, lineId, shiftKey),
    totals: rejectStore.getTotals(plantId, lineId, shiftKey),
  };
}
