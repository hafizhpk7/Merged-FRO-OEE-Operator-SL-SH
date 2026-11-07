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

type StoreListener = () => void;
const listeners = new Set<StoreListener>();

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
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      emitChange();
    }
  });
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
      taggedAt: new Date().toISOString(),
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
