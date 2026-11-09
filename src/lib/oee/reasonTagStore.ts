import { getNow, getNowMs } from "./shiftClock";
import { useSyncExternalStore } from "react";

export type ReasonTag = {
  eventKey: string;
  l2Category: string;
  l3Reason: string;
  notes?: string;
  taggedAt: string;
  operatorName?: string;
};

const STORAGE_KEY = "fro-oee-reason-tags-v1";
const CAUSES_KEY = "fro-oee-reason-causes-v1";

/**
 * Operator cause committed against one loss event (Reason page "Classify").
 * Times are seconds from the shift start, same axis as MachineEvent.startSec/endSec.
 */
export type TaggedCause = {
  id: string;
  startSec: number;
  endSec: number;
  l1Parent: string;
  l2CategoryId: string;
  l2CategoryName: string;
  l3ReasonId: string;
  l3ReasonName: string;
  description?: string;
  operatorName?: string;
  taggedAt: string;
  /** CR 2: set on every cause written by a group save (also kept for single saves as undefined). */
  groupId?: string;
  mode?: "single" | "group";
};

/** CR 2 §3.3 audit row: one per window per save. */
export type ClassificationAudit = {
  id: string;
  at: string;
  user: string;
  mode: "single" | "group";
  groupId: string;
  windowKey: string;
  before: TaggedCause[];
  after: TaggedCause[];
};

export type CauseTemplate = Pick<
  TaggedCause,
  "l1Parent" | "l2CategoryId" | "l2CategoryName" | "l3ReasonId" | "l3ReasonName" | "description"
>;

export type SaveResult =
  | { ok: true; groupId: string; saved: string[] }
  | { ok: false; conflicts: string[]; message: string };

type StoreListener = () => void;
const listeners = new Set<StoreListener>();

type Meta = { versions: Record<string, number>; audit: ClassificationAudit[] };
const META_KEY = "fro-oee-reason-meta-v1";
const AUDIT_LIMIT = 500;

// In memory is authoritative (works without a browser, e.g. dev self-tests); localStorage mirrors it.
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore, in-memory state stays consistent
  }
}

function getStoredCauses(): Record<string, TaggedCause[]> {
  return readJson<Record<string, TaggedCause[]>>(CAUSES_KEY, {});
}

let causesCache = getStoredCauses();
let metaCache: Meta = readJson<Meta>(META_KEY, { versions: {}, audit: [] });
let causesSeq = 0;
let groupSeq = 0;

function getStoredTags(): Record<string, ReasonTag> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredTags(tags: Record<string, ReasonTag>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
    emitChange();
  } catch {
    // ignore
  }
}

let currentCache = getStoredTags();

function emitChange() {
  currentCache = getStoredTags();
  if (typeof window !== "undefined") {
    causesCache = getStoredCauses();
    metaCache = readJson<Meta>(META_KEY, { versions: {}, audit: [] });
  }
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === CAUSES_KEY || event.key === META_KEY) {
      emitChange();
    }
  });
}

/**
 * Commits a full set of window -> causes changes in one step. Callers validate first, so the
 * write itself cannot fail half way (all-or-nothing, CR 2 GR-10).
 */
function commitWindows(
  changes: { key: string; after: TaggedCause[] }[],
  user: string,
  mode: "single" | "group",
  groupId: string,
) {
  const nextCauses = { ...causesCache };
  const nextMeta: Meta = { versions: { ...metaCache.versions }, audit: [...metaCache.audit] };
  const at = getNow().toISOString();
  for (const ch of changes) {
    const before = causesCache[ch.key] ?? [];
    if (ch.after.length === 0) delete nextCauses[ch.key];
    else nextCauses[ch.key] = ch.after;
    nextMeta.versions[ch.key] = (nextMeta.versions[ch.key] ?? 0) + 1;
    nextMeta.audit.push({
      id: `AU-${groupId}-${nextMeta.audit.length}`,
      at,
      user,
      mode,
      groupId,
      windowKey: ch.key,
      before,
      after: ch.after,
    });
  }
  if (nextMeta.audit.length > AUDIT_LIMIT) nextMeta.audit = nextMeta.audit.slice(-AUDIT_LIMIT);
  causesCache = nextCauses;
  metaCache = nextMeta;
  writeJson(CAUSES_KEY, nextCauses);
  writeJson(META_KEY, nextMeta);
  // New snapshot identity so useSyncExternalStore subscribers re-render on cause changes.
  currentCache = { ...currentCache };
  listeners.forEach((listener) => listener());
}

function findConflicts(keys: string[], expected: Record<string, number>): string[] {
  return keys.filter((k) => (metaCache.versions[k] ?? 0) !== (expected[k] ?? 0));
}

export const reasonTagStore = {
  subscribe(listener: StoreListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): Record<string, ReasonTag> {
    return currentCache;
  },

  getTags(eventKey: string): ReasonTag | undefined {
    return currentCache[eventKey];
  },

  addTags(
    eventKey: string,
    payload: { l2Category: string; l3Reason: string; notes?: string; operatorName?: string },
  ) {
    const tags = getStoredTags();
    tags[eventKey] = {
      eventKey,
      l2Category: payload.l2Category,
      l3Reason: payload.l3Reason,
      ...(payload.notes ? { notes: payload.notes } : {}),
      taggedAt: getNow().toISOString(),
      operatorName: payload.operatorName || "Operator",
    };
    saveStoredTags(tags);
  },

  replaceTags(
    eventKey: string,
    payload: { l2Category: string; l3Reason: string; notes?: string; operatorName?: string },
  ) {
    this.addTags(eventKey, payload);
  },

  /** Causes the operator committed for an event. Key = `${shiftKey}:${machineCode}:${eventId}`. */
  getCauses(causeKey: string): TaggedCause[] {
    return causesCache[causeKey] ?? [];
  },

  nextCauseId(causeKey: string): string {
    causesSeq += 1;
    return `OC-${causeKey}-${(causesCache[causeKey]?.length ?? 0) + causesSeq}`;
  },

  /** Monotonic per-window version; bumped by every save that touches the window. */
  getVersion(windowKey: string): number {
    return metaCache.versions[windowKey] ?? 0;
  },

  getVersions(windowKeys: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const k of windowKeys) out[k] = metaCache.versions[k] ?? 0;
    return out;
  },

  getAudit(windowKey?: string): ClassificationAudit[] {
    return windowKey
      ? metaCache.audit.filter((a) => a.windowKey === windowKey)
      : metaCache.audit.slice();
  },

  /**
   * Single mode save (one window, one or more causes). Fails without writing when the window
   * changed since the modal was opened. Pass an empty list to clear the window's causes.
   */
  saveSingle(
    windowKey: string,
    causes: TaggedCause[],
    expectedVersion: number,
    user = "Operator",
  ): SaveResult {
    const conflicts = findConflicts([windowKey], { [windowKey]: expectedVersion });
    if (conflicts.length > 0) {
      return {
        ok: false,
        conflicts,
        message: "Window sudah berubah sejak modal dibuka. Tidak ada yang disimpan.",
      };
    }
    groupSeq += 1;
    const groupId = `CL-S${groupSeq}-${getNowMs().toString(36)}`;
    const stamped = causes.map((c) => ({
      ...c,
      mode: "single" as const,
      operatorName: user,
      groupId,
    }));
    commitWindows([{ key: windowKey, after: stamped }], user, "single", groupId);
    return { ok: true, groupId, saved: [windowKey] };
  },

  /**
   * Group mode save (CR 2 GR-08/GR-10): one cause applied to the full duration of every window.
   * All-or-nothing: if any window changed since the modal opened (version mismatch) nothing is
   * written and the offending window keys are returned.
   */
  saveGroup(
    windows: { id: string; startSec: number; endSec: number }[],
    cause: CauseTemplate,
    expectedVersions: Record<string, number>,
    user = "Operator",
  ): SaveResult {
    if (windows.length === 0) {
      return { ok: false, conflicts: [], message: "Tidak ada window yang dipilih." };
    }
    const conflicts = findConflicts(
      windows.map((w) => w.id),
      expectedVersions,
    );
    if (conflicts.length > 0) {
      return {
        ok: false,
        conflicts,
        message: "Sebagian window sudah berubah. Tidak ada window yang disimpan.",
      };
    }
    groupSeq += 1;
    const groupId = `CL-G${groupSeq}-${getNowMs().toString(36)}`;
    const taggedAt = getNow().toISOString();
    const changes = windows.map((w, i) => ({
      key: w.id,
      after: [
        {
          ...cause,
          id: `OC-${groupId}-${i + 1}`,
          startSec: w.startSec,
          endSec: w.endSec,
          operatorName: user,
          taggedAt,
          groupId,
          mode: "group" as const,
        },
      ],
    }));
    commitWindows(changes, user, "group", groupId);
    return { ok: true, groupId, saved: windows.map((w) => w.id) };
  },

  /** Test helper: drop causes, versions and audit rows for the given window keys. */
  _purgeForTest(windowKeys: string[]) {
    const nextCauses = { ...causesCache };
    const nextVersions = { ...metaCache.versions };
    for (const k of windowKeys) {
      delete nextCauses[k];
      delete nextVersions[k];
    }
    causesCache = nextCauses;
    metaCache = {
      versions: nextVersions,
      audit: metaCache.audit.filter((a) => !windowKeys.includes(a.windowKey)),
    };
    writeJson(CAUSES_KEY, causesCache);
    writeJson(META_KEY, metaCache);
    currentCache = { ...currentCache };
    listeners.forEach((listener) => listener());
  },

  classificationState(eventKey: string): {
    isTagged: boolean;
    l2Category?: string;
    l3Reason?: string;
  } {
    const tag = currentCache[eventKey];
    if (tag) {
      return {
        isTagged: true,
        l2Category: tag.l2Category,
        l3Reason: tag.l3Reason,
      };
    }
    return { isTagged: false };
  },

  pendingSummary(lineId?: string) {
    const all = Object.values(currentCache);
    const lineTags = lineId ? all.filter((t) => t.eventKey.includes(lineId)) : all;
    return {
      taggedCount: lineTags.length,
    };
  },

  resetDemoData() {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CAUSES_KEY);
      localStorage.removeItem(META_KEY);
      emitChange();
    } catch {
      // ignore
    }
  },
};

export function useReasonTags() {
  return useSyncExternalStore(
    reasonTagStore.subscribe,
    reasonTagStore.getSnapshot,
    reasonTagStore.getSnapshot,
  );
}
