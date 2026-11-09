/**
 * Work order state of a line in a shift (CR 5 TG-04, TG-10).
 * - Pause Work Order is a mock: paused time still counts as running time, so it changes nothing
 *   in the target calculation.
 * - Finish Work Order freezes the PO and shift target values at the moment it was confirmed.
 */
import { useSyncExternalStore } from "react";
import { getNowMs } from "./shiftClock";

export type WorkOrderState = {
  status: "running" | "paused" | "finished";
  /** When Finish Work Order was confirmed (epoch seconds); target values are frozen at this time. */
  finishedAtSec?: number;
  pausedAtSec?: number;
};

const KEY = "fro_work_order_state";
const RUNNING: WorkOrderState = { status: "running" };
const listeners = new Set<() => void>();
let cache: Record<string, WorkOrderState> | undefined;
let version = 0;

function load(): Record<string, WorkOrderState> {
  if (cache) return cache;
  let v: Record<string, WorkOrderState> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) v = JSON.parse(raw) as Record<string, WorkOrderState>;
    } catch {
      v = {};
    }
  }
  cache = v;
  return v;
}

function save(next: Record<string, WorkOrderState>) {
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

const key = (lineId: string, shiftKey: string) => `${lineId}:${shiftKey}`;

export const workOrderStore = {
  get(lineId: string, shiftKey: string): WorkOrderState {
    return load()[key(lineId, shiftKey)] ?? RUNNING;
  },
  pause(lineId: string, shiftKey: string) {
    save({ ...load(), [key(lineId, shiftKey)]: { status: "paused", pausedAtSec: Math.floor(getNowMs() / 1000) } });
  },
  resume(lineId: string, shiftKey: string) {
    save({ ...load(), [key(lineId, shiftKey)]: { status: "running" } });
  },
  finish(lineId: string, shiftKey: string) {
    save({
      ...load(),
      [key(lineId, shiftKey)]: { status: "finished", finishedAtSec: Math.floor(getNowMs() / 1000) },
    });
  },
  /** Demo helper: forget all work order states. */
  reset() {
    save({});
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  version: () => version,
};

export function useWorkOrder(lineId: string, shiftKey: string): WorkOrderState {
  useSyncExternalStore(workOrderStore.subscribe, workOrderStore.version, () => 0);
  return workOrderStore.get(lineId, shiftKey);
}
