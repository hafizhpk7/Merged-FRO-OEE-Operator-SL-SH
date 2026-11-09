/**
 * CR 3 Summarization Kemas store + minimal Rekonsiliasi All Batch state.
 *
 * OI-3.1 default: one cumulative record per PO FG (per line). Operators update the same record across
 * shifts; every save also appends a snapshot with shift and "Lanjutan" id (segmented history).
 * Reconcile prefill = the latest saved values (SM-11). Confirming reconcile locks it (SM-15).
 * localStorage + in-memory, same pattern as the other stores.
 */
import { useSyncExternalStore } from "react";
import { getNowMs, getShiftInfo } from "./shiftClock";
import { getFlowType, getPoBom, validateQty, type BomItem, type FlowType } from "./summarizationMock";

export type RejectMode = "only" | "bulk";

/** Editable values per packaging item code. */
export type SumItemData = {
  /** Sample QC, Retain, RND dan PIV, PID Marketing Comm */
  sample: [number, number, number, number];
  /** Reject packaging only: Supply, Mesin, Proses */
  pack: [number, number, number];
  /** Reject with bulk: layak Mesin, layak Proses, tidak layak Mesin, tidak layak Proses */
  bulk: [number, number, number, number];
};
export type SumData = Record<string, SumItemData>;

export type SumStatus = "draft" | "saved" | "locked";

export type SumSnapshot = {
  shiftKey: string;
  lanjutan: number;
  savedAt: number;
  savedBy: string;
  data: SumData;
};
export type SumAudit = { at: number; user: string; action: string; shiftKey: string };

export type SumRecord = {
  id: string;
  plantId: string;
  lineId: string;
  poNumber: string;
  flow: FlowType;
  status: SumStatus;
  /** Working copy (draft autosave). */
  data: SumData;
  rejectMode: RejectMode;
  /** Last explicitly saved values (what reconcile reads). */
  saved: SumData | null;
  savedAt?: number;
  savedBy?: string;
  updatedAt: number;
  updatedBy: string;
  snapshots: SumSnapshot[];
  audit: SumAudit[];
  /** Reconcile (mock). */
  reconcile?: ReconcileState;
};

/** Reconcile columns: Return (never prefilled) plus the six summarization columns. */
export const RECON_COLS = ["return", "qc", "retain", "rnd", "pid", "packOnly", "bulk"] as const;
export type ReconCol = (typeof RECON_COLS)[number];
export const RECON_LABELS: Record<ReconCol, string> = {
  return: "Return",
  qc: "Sample QC",
  retain: "Retain",
  rnd: "RND dan PIV",
  pid: "PID Marketing Comm",
  packOnly: "Reject packaging only",
  bulk: "Reject with bulk",
};
export type ReconcileState = {
  values: Record<string, Partial<Record<ReconCol, number>>>;
  /** Cells whose value was prefilled from summarization (and not changed away from it). */
  confirmedAt?: number;
  confirmedBy?: string;
  /** Which summarization save the prefill came from. */
  sourceSavedAt?: number;
  sourceSavedBy?: string;
};

const KEY = "fro_summarization_v1";
const listeners = new Set<() => void>();
let cache: Record<string, SumRecord> | undefined;
let version = 0;

function load(): Record<string, SumRecord> {
  if (cache) return cache;
  let v: Record<string, SumRecord> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) v = JSON.parse(raw) as Record<string, SumRecord>;
    } catch {
      v = {};
    }
  }
  cache = v;
  return v;
}
function persist(next: Record<string, SumRecord>) {
  cache = next;
  version += 1;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  listeners.forEach((l) => l());
}

export const sumId = (lineId: string, poNumber: string) => `${lineId}:${poNumber}`;

export function emptyItem(): SumItemData {
  return { sample: [0, 0, 0, 0], pack: [0, 0, 0], bulk: [0, 0, 0, 0] };
}
export function emptyData(bom: BomItem[]): SumData {
  const d: SumData = {};
  for (const b of bom) d[b.code] = emptyItem();
  return d;
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const sum = (a: readonly number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 10) / 10;

/** Per item resume row: Sample x4, Reject packaging only, Reject with bulk. */
export function resumeRow(d: SumItemData): Record<Exclude<ReconCol, "return">, number> {
  return {
    qc: d.sample[0],
    retain: d.sample[1],
    rnd: d.sample[2],
    pid: d.sample[3],
    packOnly: sum(d.pack),
    bulk: sum(d.bulk),
  };
}

/** SM-10 over a whole data set; returns error list (item code + field). */
export function validateData(data: SumData, bom: BomItem[]): string[] {
  const errs: string[] = [];
  for (const b of bom) {
    const d = data[b.code];
    if (!d) continue;
    for (const [grp, arr] of [["sample", d.sample], ["pack", d.pack], ["bulk", d.bulk]] as const) {
      arr.forEach((v, i) => {
        const e = validateQty(v, b.uom);
        if (e) errs.push(`${b.code}.${grp}.${i}: ${e}`);
      });
    }
  }
  return errs;
}

/** Lanjutan id: 1-based index of the shift among the shifts this PO FG has been saved in. */
function lanjutanFor(rec: SumRecord | undefined, shiftKey: string): number {
  const keys: string[] = [];
  for (const s of rec?.snapshots ?? []) if (!keys.includes(s.shiftKey)) keys.push(s.shiftKey);
  const i = keys.indexOf(shiftKey);
  return i >= 0 ? i + 1 : keys.length + 1;
}

function base(plantId: string, lineId: string, poNumber: string, user: string): SumRecord {
  const bom = getPoBom(poNumber);
  return {
    id: sumId(lineId, poNumber),
    plantId,
    lineId,
    poNumber,
    flow: getFlowType(lineId),
    status: "draft",
    data: emptyData(bom),
    rejectMode: "only",
    saved: null,
    updatedAt: getNowMs(),
    updatedBy: user,
    snapshots: [],
    audit: [],
  };
}

export type Ctx = { plantId: string; lineId: string; poNumber: string; user: string };

export const summarizationStore = {
  get(lineId: string, poNumber: string): SumRecord | undefined {
    return load()[sumId(lineId, poNumber)];
  },
  /** Current Lanjutan number a save made now would get. */
  currentLanjutan(lineId: string, poNumber: string): number {
    return lanjutanFor(load()[sumId(lineId, poNumber)], getShiftInfo().shiftKey);
  },
  /** Autosave draft (on step change). Refuses when locked. */
  saveDraft(ctx: Ctx, data: SumData, rejectMode: RejectMode): { ok: boolean; reason?: string } {
    const all = load();
    const id = sumId(ctx.lineId, ctx.poNumber);
    const rec = all[id] ?? base(ctx.plantId, ctx.lineId, ctx.poNumber, ctx.user);
    if (rec.status === "locked") return { ok: false, reason: "Summarization terkunci" };
    const errs = validateData(data, getPoBom(ctx.poNumber));
    if (errs.length) return { ok: false, reason: errs[0] ?? "Nilai tidak valid" };
    const now = getNowMs();
    persist({
      ...all,
      [id]: {
        ...rec,
        data: clone(data),
        rejectMode,
        status: "draft",
        updatedAt: now,
        updatedBy: ctx.user,
      },
    });
    return { ok: true };
  },
  /** "Simpan summarization": saved values + snapshot with shift and Lanjutan + audit. */
  save(ctx: Ctx, data: SumData, rejectMode: RejectMode): { ok: boolean; reason?: string } {
    const all = load();
    const id = sumId(ctx.lineId, ctx.poNumber);
    const rec = all[id] ?? base(ctx.plantId, ctx.lineId, ctx.poNumber, ctx.user);
    if (rec.status === "locked") return { ok: false, reason: "Summarization terkunci" };
    const errs = validateData(data, getPoBom(ctx.poNumber));
    if (errs.length) return { ok: false, reason: errs[0] ?? "Nilai tidak valid" };
    const now = getNowMs();
    const shiftKey = getShiftInfo().shiftKey;
    const lanjutan = lanjutanFor(rec, shiftKey);
    persist({
      ...all,
      [id]: {
        ...rec,
        data: clone(data),
        rejectMode,
        saved: clone(data),
        savedAt: now,
        savedBy: ctx.user,
        status: "saved",
        updatedAt: now,
        updatedBy: ctx.user,
        snapshots: [...rec.snapshots, { shiftKey, lanjutan, savedAt: now, savedBy: ctx.user, data: clone(data) }],
        audit: [...rec.audit, { at: now, user: ctx.user, action: "Simpan summarization", shiftKey }],
      },
    });
    return { ok: true };
  },

  // ---- Reconcile (mock) --------------------------------------------------------------------
  /** SM-11/12/14: prefill values from the latest saved summarization; Return stays empty. */
  prefill(rec: SumRecord | undefined): ReconcileState["values"] {
    const out: ReconcileState["values"] = {};
    if (!rec?.saved) return out;
    for (const [code, d] of Object.entries(rec.saved)) out[code] = { ...resumeRow(d) };
    return out;
  },
  getReconcile(lineId: string, poNumber: string): ReconcileState | undefined {
    return load()[sumId(lineId, poNumber)]?.reconcile;
  },
  saveReconcile(ctx: Ctx, values: ReconcileState["values"]) {
    const all = load();
    const id = sumId(ctx.lineId, ctx.poNumber);
    const rec = all[id] ?? base(ctx.plantId, ctx.lineId, ctx.poNumber, ctx.user);
    if (rec.reconcile?.confirmedAt) return;
    persist({
      ...all,
      [id]: {
        ...rec,
        reconcile: {
          ...(rec.reconcile ?? { values: {} }),
          values: clone(values),
          ...(rec.savedAt ? { sourceSavedAt: rec.savedAt } : {}),
          ...(rec.savedBy ? { sourceSavedBy: rec.savedBy } : {}),
        },
      },
    });
  },
  /** SM-15: confirming reconcile locks the summarization (read-only history). */
  confirmReconcile(ctx: Ctx, values: ReconcileState["values"]) {
    const all = load();
    const id = sumId(ctx.lineId, ctx.poNumber);
    const rec = all[id] ?? base(ctx.plantId, ctx.lineId, ctx.poNumber, ctx.user);
    const now = getNowMs();
    const shiftKey = getShiftInfo().shiftKey;
    persist({
      ...all,
      [id]: {
        ...rec,
        status: rec.saved ? "locked" : rec.status,
        reconcile: {
          values: clone(values),
          confirmedAt: now,
          confirmedBy: ctx.user,
          ...(rec.savedAt ? { sourceSavedAt: rec.savedAt } : {}),
          ...(rec.savedBy ? { sourceSavedBy: rec.savedBy } : {}),
        },
        audit: [...rec.audit, { at: now, user: ctx.user, action: "Konfirmasi reconcile (mock)", shiftKey }],
      },
    });
  },
  /** Demo helper / self-test cleanup. */
  clear(lineId?: string, poNumber?: string) {
    if (!lineId || !poNumber) return persist({});
    const { [sumId(lineId, poNumber)]: _gone, ...rest } = load();
    void _gone;
    persist(rest);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  version: () => version,
};

export function useSummarization(lineId: string, poNumber: string): SumRecord | undefined {
  useSyncExternalStore(summarizationStore.subscribe, summarizationStore.version, () => 0);
  return summarizationStore.get(lineId, poNumber);
}
