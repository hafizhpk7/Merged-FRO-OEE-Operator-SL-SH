/**
 * Simulation controls (used by the SimulationPanel and available as `window.sim`).
 * Everything goes through shared stores (simStore, shift clock, reject store, ...), so Dashboard,
 * Reject, Reason, Hourly, SL/SH and alarms stay consistent. Changing the event density resets tags,
 * corrections, QA counters and summarization, so it goes through a confirmation (SimDensityConfirm).
 */
import { useSyncExternalStore } from "react";
import { dashboardVersionStore } from "./dashboardVersionStore";
import { reasonTagStore } from "./reasonTagStore";
import { rejectStore } from "./rejectStore";
import { summarizationStore } from "./summarizationStore";
import { clearCurrentShiftCache } from "./machineShiftTotals";
import { clearMetricsCache } from "./metrics-engine";
import { simStore, type Density, type SimState, type TimeScale } from "./simStore";
import {
  getNowMs,
  getShiftInfo,
  getShiftStartMinuteOfDay,
  isShiftOverrideActive,
  jumpToShiftEnd,
  jumpToWibTime,
  setShiftStartOverrideMin,
  subscribeClock,
} from "./shiftClock";
import { viewShiftStore } from "./viewShiftStore";
import { setSrrLine } from "./assetMaster";
import { workOrderStore } from "./workOrderStore";
import { actualVsTargetNow, applyActualVsTarget, clearActualVsTarget } from "./simOutput";

export const SIM_RESET_EVENT = "fro-sim-reset";
export const SIM_QA_EVENT = "fro-sim-qa-alert";

// derived caches must not outlive a data-affecting change
if (typeof window !== "undefined") {
  let lastData = simStore.dataVersion();
  simStore.subscribe(() => {
    const v = simStore.dataVersion();
    if (v !== lastData) {
      lastData = v;
      clearCurrentShiftCache();
      clearMetricsCache();
    }
  });
}

/** Clears operator-entered data that is tied to the generated events. */
export function resetSimulationData(): void {
  reasonTagStore.resetDemoData();
  rejectStore.resetDemoData();
  summarizationStore.clear();
  clearCurrentShiftCache();
  clearMetricsCache();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SIM_RESET_EVENT));
}

// ---- density confirmation ------------------------------------------------------------------------
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

// ---- override status -----------------------------------------------------------------------------
/** True when any override differs from the live defaults (clock, output, SRR, density, scenarios, ...). */
export function isSimulationActive(): boolean {
  return simStore.isOverridden() || isShiftOverrideActive();
}

export function useSimulationActive(): boolean {
  const a = useSyncExternalStore(simStore.subscribe, () => simStore.version(), () => 0);
  const b = useSyncExternalStore(subscribeClock, () => (isShiftOverrideActive() ? 1 : 0), () => 0);
  void a;
  void b;
  return isSimulationActive();
}

// ---- time jumps ----------------------------------------------------------------------------------
export const jumps = {
  shiftStart: () => simStore.setSimNowMs(getShiftInfo().startSec * 1000 + 1000),
  plusMinutes: (min: number) => {
    const cur = getShiftInfo();
    simStore.setSimNowMs(Math.min(cur.endSec * 1000 - 1000, getNowMs() + min * 60000));
  },
  beforeEnd: (min: number) => jumpToShiftEnd(min),
  nextShift: () => simStore.setSimNowMs(getShiftInfo().endSec * 1000 + 1000),
  /** Back to the real clock (scale 1, running). */
  realTime: () => {
    simStore.setTimeScale(1);
    simStore.resume();
    simStore.setTimeOffsetMs(0);
  },
};

// ---- events and rejects ----------------------------------------------------------------------------
export type InjectKind = "downtime" | "minor_stop" | "speed_loss";

/** Injects an event for a machine at the current simulated time (30 s aligned). */
export function injectEvent(machineCode: string, kind: InjectKind, minutes: number, speedPct = 70) {
  const shift = getShiftInfo();
  // start at the last revealed window so the event is visible at once
  const startSec = Math.max(0, Math.floor(shift.elapsedSec / 30) * 30 - 30);
  const min = kind === "downtime" ? Math.max(11, minutes) : Math.max(1, minutes);
  const durationSec = Math.round(min * 2) * 30;
  return simStore.addInjected({
    shiftKey: shift.shiftKey,
    machineCode,
    type: kind,
    startSec,
    durationSec,
    ...(kind === "speed_loss" ? { speedPct } : {}),
  });
}

/** Adds `qty` rejects of one reject slot (entry id) at the current simulated time. */
export function rejectBurst(plantId: string, lineId: string, machineCode: string, l3Id: string, name: string, qty: number) {
  const shift = getShiftInfo();
  rejectStore.addQaReject({
    plantId,
    lineId,
    machineCode,
    rejectTypeId: l3Id,
    rejectTypeName: name,
    qty: Math.max(1, Math.round(qty)),
    at: Math.floor(getNowMs() / 1000),
    note: "Simulation reject burst",
    shiftKey: shift.shiftKey,
    source: "manual",
  });
}

export function triggerQaAlert(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SIM_QA_EVENT));
}

// ---- PO scenario presets ---------------------------------------------------------------------------
export type PoScenario = "single" | "three-sku" | "continued";
export function applyPoScenario(p: PoScenario): void {
  if (p === "three-sku") {
    simStore.setPoPreset(null);
    setShiftStartOverrideMin(390); // 06:30-14:30 as in the CR 5 mockup
    jumpToWibTime(10, 30);
    return;
  }
  setShiftStartOverrideMin(null);
  simStore.setPoPreset(p === "continued" ? "continued" : null);
}

export function currentPoScenario(): PoScenario {
  if (isShiftOverrideActive() && getShiftStartMinuteOfDay() === 390) return "three-sku";
  return simStore.get().poPreset === "continued" ? "continued" : "single";
}

// ---- reset / export / import ---------------------------------------------------------------------------
/** Back to live defaults: clock, output, SRR, density, PLC ratio, injected events, PO scenario, shift override. */
export function resetOverrides(): void {
  simStore.resetOverrides();
  setShiftStartOverrideMin(null);
  viewShiftStore.set(null);
  clearCurrentShiftCache();
  clearMetricsCache();
}

export type SimExport = {
  format: "fro-sim-state";
  version: 1;
  /** Simulated time at export (ms). */
  simNowMs: number;
  state: SimState;
  shiftStartOverrideMin: number | null;
  viewShiftStart: number | null;
  /** Main dashboard version ("old" legacy FRO view / "new" CR design); absent in older files. */
  dashboardVersion?: "old" | "new";
};

export function exportSimState(): SimExport {
  const s = simStore.get();
  return {
    format: "fro-sim-state",
    version: 1,
    simNowMs: getNowMs(),
    state: JSON.parse(JSON.stringify(s)) as SimState,
    shiftStartOverrideMin: isShiftOverrideActive() ? getShiftStartMinuteOfDay() : null,
    viewShiftStart: viewShiftStore.get(),
    dashboardVersion: dashboardVersionStore.get(),
  };
}

/** Restores an exported state; returns an error text when the file is not valid. */
export function importSimState(raw: unknown): string | null {
  const x = raw as Partial<SimExport> | null;
  if (!x || x.format !== "fro-sim-state" || x.version !== 1 || !x.state || typeof x.simNowMs !== "number") {
    return "Bukan file state simulasi yang valid.";
  }
  const st = x.state as SimState;
  if (typeof st.timeScale !== "number" || typeof st.paused !== "boolean") return "Isi file tidak lengkap.";
  setShiftStartOverrideMin(x.shiftStartOverrideMin ?? null);
  simStore.replace({ ...st, anchorSimMs: x.simNowMs });
  viewShiftStore.set(x.viewShiftStart ?? null);
  if (x.dashboardVersion === "old" || x.dashboardVersion === "new") dashboardVersionStore.set(x.dashboardVersion);
  clearCurrentShiftCache();
  clearMetricsCache();
  return null;
}

export const sim = {
  state: () => simStore.get(),
  setTimeScale: (s: TimeScale) => simStore.setTimeScale(s),
  pause: () => simStore.pause(),
  resume: () => simStore.resume(),
  setTimeOffsetMs: (ms: number) => simStore.setTimeOffsetMs(ms),
  setSimNowMs: (ms: number) => simStore.setSimNowMs(ms),
  requestDensity,
  setPlcMappedRatio: (r: number) => {
    simStore.setPlcMappedRatio(r);
    simStore.setPlcDowntimeRatio(r);
  },
  /** "Actual vs Target (%)": total actual = pct x total target (mode "now" = Hit now, "marginal" = From now on). */
  setActualVsTarget: (plantId: string, lineId: string, pct: number, mode: "now" | "marginal" = "now") =>
    applyActualVsTarget(plantId, lineId, pct, mode),
  clearActualVsTarget,
  actualVsTargetNow,
  setSrrLine,
  injectEvent,
  rejectBurst,
  triggerQaAlert,
  applyPoScenario,
  jumps,
  setDashboardVersion: (v: "old" | "new") => dashboardVersionStore.set(v),
  exportState: exportSimState,
  importState: importSimState,
  resetOverrides,
  resetDemoData: resetSimulationData,
  resetWorkOrders: () => workOrderStore.reset(),
  reset: () => {
    resetOverrides();
    resetSimulationData();
  },
};

declare global {
  interface Window {
    sim?: typeof sim;
  }
}
if (typeof window !== "undefined") window.sim = sim;
