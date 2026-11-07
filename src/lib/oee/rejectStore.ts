import { useSyncExternalStore } from "react";
import { getRejectSlots } from "./rejectConfig";
import { makeRng, rand } from "./rng";
import { getShiftInfo } from "./shiftClock";

export type RejectLogSource = "sensor" | "manual" | "qa";

export type RejectLog = {
  id: string;
  plantId: string;
  lineId: string;
  machineCode: string;
  rejectTypeId: string;
  rejectTypeName: string;
  qty: number;
  source: RejectLogSource;
  at: number; // timestamp in seconds
  note?: string;
  createdAt: number;
  category: "Reject" | "Rework";
  shiftKey: string;
};

type RejectStoreSchema = {
  userLogs: RejectLog[];
  removedLogIds: string[];
};

const STORAGE_KEY = "fro-oee-reject-logs-v1";

type StoreListener = () => void;
const listeners = new Set<StoreListener>();

function getStoredState(): RejectStoreSchema {
  if (typeof window === "undefined") return { userLogs: [], removedLogIds: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { userLogs: [], removedLogIds: [] };
  } catch {
    return { userLogs: [], removedLogIds: [] };
  }
}

function saveStoredState(state: RejectStoreSchema): void {
  if (typeof window === "undefined") return;
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

function generateBaselineLogs(plantId: string, lineId: string, shiftKey: string): RejectLog[] {
  const slots = getRejectSlots(plantId, lineId).filter((s) => s.status === "Assigned");
  const logs: RejectLog[] = [];
  const shiftInfo = getShiftInfo();
  const shiftStartSec = shiftInfo.startSec;

  slots.forEach((slot) => {
    if (!slot.rejectTypeId || !slot.rejectTypeName || !slot.assignedMachine) return;
    const rngSeed = `${plantId}:${lineId}:${shiftKey}:${slot.slotId}`;
    const rng = makeRng(rngSeed);

    for (let h = 0; h < 8; h++) {
      const hourStartSec = shiftStartSec + h * 3600;
      const nowSec = Math.floor(Date.now() / 1000);
      if (shiftKey === shiftInfo.shiftKey && hourStartSec > nowSec) {
        continue;
      }

      const count = Math.floor(rng() * 3) + 1;
      for (let c = 0; c < count; c++) {
        const offsetMin = Math.floor(rng() * 60);
        const atSec = hourStartSec + offsetMin * 60;
        const qty = Math.floor(rng() * 3) + 1;
        logs.push({
          id: `sensor-${lineId}-${slot.slotId}-h${h}-c${c}`,
          plantId,
          lineId,
          machineCode: slot.assignedMachine,
          rejectTypeId: slot.rejectTypeId,
          rejectTypeName: slot.rejectTypeName,
          qty,
          source: "sensor",
          at: atSec,
          createdAt: atSec * 1000,
          category: slot.category || "Reject",
          shiftKey,
        });
      }
    }
  });

  return logs;
}

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
    const combined = [...baseline, ...state.userLogs];
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

    for (const log of logs) {
      if (log.category === "Rework") {
        totalRework += log.qty;
      } else {
        totalReject += log.qty;
      }
      if (log.source === "sensor") sensor += log.qty;
      else if (log.source === "manual") manual += log.qty;
      else if (log.source === "qa") qa += log.qty;
    }

    return {
      totalReject,
      totalRework,
      sensor,
      manual,
      qa,
    };
  },

  getHourlySeries(
    plantId: string,
    lineId: string,
    shiftKey: string,
    rejectTypeId: string,
    machineCode?: string,
  ) {
    const state = currentCache;
    const baseline = generateBaselineLogs(plantId, lineId, shiftKey);
    const userLogs = state.userLogs;
    const removed = state.removedLogIds;

    const shiftInfo = getShiftInfo();
    const shiftStartSec = shiftInfo.startSec;

    const actualHours = new Array(8).fill(0);
    const currentHours = new Array(8).fill(0);

    const actualLogs = baseline.filter(
      (l) =>
        l.rejectTypeId === rejectTypeId &&
        (!machineCode || l.machineCode === machineCode) &&
        !removed.includes(l.id),
    );
    for (const log of actualLogs) {
      const hIdx = Math.floor((log.at - shiftStartSec) / 3600);
      if (hIdx >= 0 && hIdx < 8) {
        actualHours[hIdx] += log.qty;
      }
    }

    const currentLogs = [...baseline, ...userLogs].filter(
      (l) =>
        l.rejectTypeId === rejectTypeId &&
        (!machineCode || l.machineCode === machineCode) &&
        !removed.includes(l.id),
    );
    for (const log of currentLogs) {
      const hIdx = Math.floor((log.at - shiftStartSec) / 3600);
      if (hIdx >= 0 && hIdx < 8) {
        currentHours[hIdx] += log.qty;
      }
    }

    return {
      actual: actualHours,
      current: currentHours,
    };
  },

  getDailyTrend(plantId: string, lineId: string, rejectTypeIds: string[]) {
    const days = 7;
    const result: { dateLabel: string; total: number }[] = [];
    const now = new Date();

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

  addManualReject(payload: {
    plantId: string;
    lineId: string;
    machineCode: string;
    rejectTypeId: string;
    rejectTypeName: string;
    qty: number;
    at: number;
    note?: string;
    category: "Reject" | "Rework";
    shiftKey: string;
  }) {
    const state = getStoredState();
    const newLog: RejectLog = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      plantId: payload.plantId,
      lineId: payload.lineId,
      machineCode: payload.machineCode,
      rejectTypeId: payload.rejectTypeId,
      rejectTypeName: payload.rejectTypeName,
      qty: payload.qty,
      source: "manual",
      at: payload.at,
      ...(payload.note ? { note: payload.note } : {}),
      createdAt: Date.now(),
      category: payload.category,
      shiftKey: payload.shiftKey,
    };
    state.userLogs.push(newLog);
    saveStoredState(state);
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
  }) {
    const state = getStoredState();
    const newLog: RejectLog = {
      id: `qa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      plantId: payload.plantId,
      lineId: payload.lineId,
      machineCode: payload.machineCode,
      rejectTypeId: payload.rejectTypeId,
      rejectTypeName: payload.rejectTypeName,
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

  removeLogs(logIds: string[]) {
    const state = getStoredState();
    for (const id of logIds) {
      if (!state.removedLogIds.includes(id)) {
        state.removedLogIds.push(id);
      }
    }
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
