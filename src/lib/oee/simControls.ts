/**
 * Simulation controls (dev helpers for the later simulation panel): `window.sim`.
 * Changing the event density resets tags, corrections, QA counters and summarization data, so it
 * goes through a confirmation dialog (SimDensityConfirm) via requestDensity().
 */
import { useSyncExternalStore } from "react";
import { reasonTagStore } from "./reasonTagStore";
import { rejectStore } from "./rejectStore";
import { summarizationStore } from "./summarizationStore";
import { clearCurrentShiftCache } from "./machineShiftTotals";
import { clearMetricsCache } from "./metrics-engine";
import { simStore, type Density, type TimeScale } from "./simStore";

export const SIM_RESET_EVENT = "fro-sim-reset";

/** Clears operator-entered data that is tied to the generated events. */
export function resetSimulationData(): void {
  reasonTagStore.resetDemoData();
  rejectStore.resetDemoData();
  summarizationStore.clear();
  clearCurrentShiftCache();
  clearMetricsCache();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SIM_RESET_EVENT));
}

let pending: Density | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const simConfirmStore = {
  get: () => pending,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  cancel() {
    pending = null;
    emit();
  },
  confirm() {
    if (pending) {
      const d = pending;
      pending = null;
      simStore.setDensity(d);
      resetSimulationData();
    }
    emit();
  },
};

/** Asks for confirmation before changing the density (it resets tags, corrections, QA, summarization). */
export function requestDensity(d: Density): void {
  if ((simStore.get().density ?? null) === d) return;
  pending = d;
  emit();
}

export function usePendingDensity(): Density | null {
  return useSyncExternalStore(simConfirmStore.subscribe, simConfirmStore.get, () => null);
}

export const sim = {
  state: () => simStore.get(),
  setTimeScale: (s: TimeScale) => simStore.setTimeScale(s),
  pause: () => simStore.pause(),
  resume: () => simStore.resume(),
  setTimeOffsetMs: (ms: number) => simStore.setTimeOffsetMs(ms),
  setSimNowMs: (ms: number) => simStore.setSimNowMs(ms),
  requestDensity,
  setPlcMappedRatio: (r: number) => simStore.setPlcMappedRatio(r),
  setOutput: (pct: number, mode?: "future" | "whole-shift") => simStore.setOutput(pct, mode),
  reset: () => {
    simStore.reset();
    resetSimulationData();
  },
};

declare global {
  interface Window {
    sim?: typeof sim;
  }
}
if (typeof window !== "undefined") window.sim = sim;
