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

/** An event injected for a machine at a simulated time (demo control). */
export type InjectedEvent = {
  id: string;
  shiftKey: string;
  machineCode: string;
  type: "downtime" | "minor_stop" | "speed_loss";
  /** Seconds from the shift start (30 s aligned). */
  startSec: number;
  durationSec: number;
  speedPct?: number;
};

/** Output factor rule: windows of a shift from `fromSec` on use `pct` (the latest matching rule wins). */
export type OutputRule = { shiftStartSec: number; fromSec: number; pct: number };

export type PoPreset = "single" | "three-sku" | "continued";

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
  /** "<PO number>" -> SRR SKU override (null = forced missing). */
  srrSkuOverrides: Record<string, number | null>;
  /** Output factor history (see OutputRule); `outputPct` is the value shown on the slider. */
  outputRules: OutputRule[];
  injected: InjectedEvent[];
  /** null = the line's PO master; "continued" = the PO carries output from the previous shift. */
  poPreset: PoPreset | null;
  /** PLC-mapped share of Downtime alarms (0..1); null = the default pattern of the event generator. */
  plcDowntimeRatio: number | null;
  anchorRealMs: number;
  anchorSimMs: number;
};

const KEY = "fro_sim_state";
const LEGACY_OFFSET_KEY = "fro_demo_clock_offset_ms";
const SRR_KEY = "simOverrides.srrLine";
const listeners = new Set<() => void>();
let state: SimState | undefined;
let version = 0;
let dataVer = 0;

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
    srrSkuOverrides: {},
    outputRules: [],
    injected: [],
    poPreset: null,
    plcDowntimeRatio: null,
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
  /** Bumped by every change that alters generated data (not by clock moves); part of cache keys. */
  dataVersion: () => dataVer,
  setDensity(density: Density | null) {
    dataVer += 1;
    commit({ ...load(), density });
  },
  setPlcMappedRatio(ratio: number) {
    dataVer += 1;
    commit({ ...load(), plcMappedRatio: Math.max(0, Math.min(1, ratio)) });
  },
  setPlcDowntimeRatio(ratio: number | null) {
    dataVer += 1;
    commit({ ...load(), plcDowntimeRatio: ratio === null ? null : Math.max(0, Math.min(1, ratio)) });
  },
  /**
   * Output vs target (%). "future": windows from `ctx.fromSec` (seconds from the shift start, the
   * current simulated time) on; "whole-shift": every window of the shift.
   */
  setOutput(pct: number, mode?: OutputApplyMode, ctx?: { shiftStartSec: number; fromSec: number }) {
    const s = load();
    const m = mode ?? s.outputApplyMode;
    let rules = s.outputRules;
    if (ctx) {
      const fromSec = m === "whole-shift" ? 0 : Math.max(0, Math.floor(ctx.fromSec / 30) * 30);
      rules = [...rules.filter((r) => !(r.shiftStartSec === ctx.shiftStartSec && r.fromSec >= fromSec)), { shiftStartSec: ctx.shiftStartSec, fromSec, pct }];
      // keep only the newest rules of the newest shifts
      rules = rules.slice(-60);
    }
    dataVer += 1;
    commit({ ...s, outputPct: Math.max(0, pct), outputApplyMode: m, outputRules: rules });
  },
  setSrrOverride(key: string, value: number | null | undefined) {
    const s = load();
    const next = { ...s.srrOverrides };
    if (value === undefined) delete next[key];
    else next[key] = value;
    dataVer += 1;
    commit({ ...s, srrOverrides: next });
  },
  setSrrSkuOverride(poNumber: string, value: number | null | undefined) {
    const s = load();
    const next = { ...s.srrSkuOverrides };
    if (value === undefined) delete next[poNumber];
    else next[poNumber] = value;
    dataVer += 1;
    commit({ ...s, srrSkuOverrides: next });
  },
  setPoPreset(p: PoPreset | null) {
    dataVer += 1;
    commit({ ...load(), poPreset: p });
  },
  addInjected(e: Omit<InjectedEvent, "id">): InjectedEvent {
    const s = load();
    const ev: InjectedEvent = { ...e, id: `INJ-${s.injected.length + 1}-${e.startSec}` };
    dataVer += 1;
    commit({ ...s, injected: [...s.injected, ev].slice(-100) });
    return ev;
  },
  clearInjected() {
    dataVer += 1;
    commit({ ...load(), injected: [] });
  },
  /** Back to live defaults of every override (clock, output, SRR, density, PLC ratio, injected events, preset). */
  resetOverrides() {
    const real = Date.now();
    dataVer += 1;
    commit({ ...fresh(), timeOffsetMs: 0, anchorRealMs: real, anchorSimMs: real, srrOverrides: {} });
  },
  reset() {
    this.resetOverrides();
  },
  /** Replaces the whole state (import); re-anchors a running clock at the imported simulated time. */
  replace(next: SimState) {
    const real = Date.now();
    dataVer += 1;
    commit({ ...fresh(), ...next, anchorRealMs: real, anchorSimMs: next.anchorSimMs, timeOffsetMs: next.anchorSimMs - real });
  },
  /** True when any override differs from the live defaults (the clock counts as an override). */
  isOverridden(): boolean {
    const s = load();
    return (
      s.timeScale !== 1 ||
      s.paused ||
      Math.abs(s.timeOffsetMs) > 1000 ||
      s.density !== null ||
      s.plcDowntimeRatio !== null ||
      s.outputRules.some((r) => r.pct !== 100) ||
      s.outputPct !== 100 ||
      Object.keys(s.srrOverrides).length > 0 ||
      Object.keys(s.srrSkuOverrides).length > 0 ||
      s.injected.length > 0 ||
      (s.poPreset !== null && s.poPreset !== "single")
    );
  },
};

/** Output multiplier (1 = as generated) of the window starting `wStartSec` seconds into the shift. */
export function outputMultiplier(shiftStartSec: number, wStartSec: number): number {
  const rules = simStore.get().outputRules;
  let pct = 100;
  for (const r of rules) if (r.shiftStartSec === shiftStartSec && r.fromSec <= wStartSec) pct = r.pct;
  return pct / 100;
}
