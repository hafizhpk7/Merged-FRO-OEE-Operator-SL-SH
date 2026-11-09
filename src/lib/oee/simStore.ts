/**
 * Simulation store (per browser tab, sessionStorage). The central clock (`getNow()` in shiftClock.ts)
 * reads simulated time from here: simulated time = real elapsed x timeScale from an anchor, or
 * frozen while paused. Also keeps the event density, PLC-mapped ratio, output settings and the SRR
 * Line overrides. No imports from other oee modules (the clock imports this file).
 */

export type Density = "normal" | "high" | "extreme";
export type TimeScale = 1 | 5 | 30 | 60 | 300;
export const TIME_SCALES: readonly TimeScale[] = [1, 5, 30, 60, 300];
export type OutputApplyMode = "future" | "whole-shift";

export type SimState = {
  /** Offset of simulated time against the real clock at the anchor (ms). */
  timeOffsetMs: number;
  timeScale: TimeScale;
  paused: boolean;
  /** Output factor in percent (100 = as generated). Stored here; the simulation panel applies it. */
  outputPct: number;
  outputApplyMode: OutputApplyMode;
  /** null = per-line default (EVENT_DENSITY in config). */
  density: Density | null;
  /** Share of alarms that are PLC-mapped (0..1). */
  plcMappedRatio: number;
  /** "<plant>:<line>" -> SRR Line override (null = forced missing). */
  srrOverrides: Record<string, number | null>;
  anchorRealMs: number;
  anchorSimMs: number;
};

const KEY = "fro_sim_state";
const LEGACY_OFFSET_KEY = "fro_demo_clock_offset_ms";
const SRR_KEY = "simOverrides.srrLine";
const listeners = new Set<() => void>();
let state: SimState | undefined;
let version = 0;

function fresh(): SimState {
  const real = Date.now();
  let offset = 0;
  const srr: Record<string, number | null> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(LEGACY_OFFSET_KEY);
      const n = raw === null ? 0 : Number(raw);
      offset = Number.isFinite(n) ? n : 0;
      const s = sessionStorage.getItem(SRR_KEY);
      if (s) Object.assign(srr, JSON.parse(s) as Record<string, number | null>);
    } catch {
      // ignore
    }
  }
  return {
    timeOffsetMs: offset,
    timeScale: 1,
    paused: false,
    outputPct: 100,
    outputApplyMode: "future",
    density: null,
    plcMappedRatio: 0.5,
    srrOverrides: srr,
    anchorRealMs: real,
    anchorSimMs: real + offset,
  };
}

function load(): SimState {
  if (state) return state;
  let s: SimState | undefined;
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) s = { ...fresh(), ...(JSON.parse(raw) as Partial<SimState>) };
    } catch {
      s = undefined;
    }
  }
  state = s ?? fresh();
  return state;
}

function commit(next: SimState) {
  state = next;
  version += 1;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
      sessionStorage.setItem(SRR_KEY, JSON.stringify(next.srrOverrides));
      // the legacy demo offset key is superseded by this store
      sessionStorage.removeItem(LEGACY_OFFSET_KEY);
    } catch {
      // ignore: the in-memory state still applies
    }
  }
  listeners.forEach((l) => l());
}

/** Simulated epoch ms: real elapsed x scale from the anchor, or frozen when paused. */
function simNowMs(s: SimState, realMs: number): number {
  if (s.paused) return s.anchorSimMs;
  return s.anchorSimMs + (realMs - s.anchorRealMs) * s.timeScale;
}

/** Pure helper for tests: simulated time for a given state and real time. */
export function computeSimNow(s: Pick<SimState, "paused" | "anchorSimMs" | "anchorRealMs" | "timeScale">, realMs: number): number {
  return s.paused ? s.anchorSimMs : s.anchorSimMs + (realMs - s.anchorRealMs) * s.timeScale;
}

export const simStore = {
  get(): SimState {
    return load();
  },
  /** Current simulated time (epoch ms). */
  nowMs(): number {
    return simNowMs(load(), Date.now());
  },
  version: () => version,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Moves simulated time to real time + offset from now on (keeps scale and paused). */
  setTimeOffsetMs(offsetMs: number) {
    const s = load();
    const real = Date.now();
    commit({ ...s, timeOffsetMs: offsetMs, anchorRealMs: real, anchorSimMs: real + offsetMs });
  },
  /** Sets simulated time to an absolute epoch ms. */
  setSimNowMs(ms: number) {
    const s = load();
    const real = Date.now();
    commit({ ...s, timeOffsetMs: ms - real, anchorRealMs: real, anchorSimMs: ms });
  },
  setTimeScale(scale: TimeScale) {
    const s = load();
    const real = Date.now();
    const now = simNowMs(s, real);
    commit({ ...s, timeScale: scale, anchorRealMs: real, anchorSimMs: now, timeOffsetMs: now - real });
  },
  pause() {
    const s = load();
    if (s.paused) return;
    const real = Date.now();
    commit({ ...s, paused: true, anchorSimMs: simNowMs(s, real), anchorRealMs: real });
  },
  resume() {
    const s = load();
    if (!s.paused) return;
    const real = Date.now();
    commit({ ...s, paused: false, anchorRealMs: real, timeOffsetMs: s.anchorSimMs - real });
  },
  setDensity(density: Density | null) {
    commit({ ...load(), density });
  },
  setPlcMappedRatio(ratio: number) {
    commit({ ...load(), plcMappedRatio: Math.max(0, Math.min(1, ratio)) });
  },
  setOutput(pct: number, mode?: OutputApplyMode) {
    const s = load();
    commit({ ...s, outputPct: Math.max(0, pct), outputApplyMode: mode ?? s.outputApplyMode });
  },
  setSrrOverride(key: string, value: number | null | undefined) {
    const s = load();
    const next = { ...s.srrOverrides };
    if (value === undefined) delete next[key];
    else next[key] = value;
    commit({ ...s, srrOverrides: next });
  },
  reset() {
    const real = Date.now();
    commit({ ...fresh(), timeOffsetMs: 0, anchorRealMs: real, anchorSimMs: real, srrOverrides: {} });
  },
};
