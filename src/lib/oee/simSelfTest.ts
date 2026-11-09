/**
 * Self-test for the real-time simulation core. Run `runSimSelfTest()` in the browser console.
 * Covers: time scale math, pause, shift rollover, determinism, completed-shift completeness, event
 * density (same loss per type, short alternating events, rules) and render cost of dense data.
 * It restores the simulation state when it is done.
 */
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { clearCurrentShiftCache, getMachineShiftTotals } from "./machineShiftTotals";
import { DOWNTIME_THRESHOLD_SEC, getShiftTimeline, type ShiftTimelineResult } from "./machineEvents";
import { clearMetricsCache } from "./metrics-engine";
import { computeSimNow, simStore, TIME_SCALES, type Density } from "./simStore";
import { getNowMs, getShiftInfo, getShiftInfoAt, getShiftInfoByKey, SHIFT_SECONDS } from "./shiftClock";

type Check = { name: string; passed: boolean; detail?: string };
const PLANT = "J2";
const LINES = ["TUP01", "TUP13", "TUP14", "BOP15", "BOP16"];

const machinesOf = (line: string) => J2_LINES_CONFIG.find((l) => l.code === line)?.machines.map((m) => m.code) ?? [];

function typeCounts(tl: ShiftTimelineResult) {
  const c: Record<string, number> = {};
  for (const w of tl.windows) {
    const k = w.type === "run" && w.output > w.targetOutput * 1.2 ? "nsl" : w.type;
    c[k] = (c[k] ?? 0) + 1;
  }
  return c;
}

export function runSimSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });
  const saved = { ...simStore.get() };
  const savedNow = getNowMs();

  try {
    // ---- time scale math, pause ----------------------------------------------------------------
    const base = { anchorRealMs: 1_000_000, anchorSimMs: 5_000_000, paused: false };
    check(
      "time scale math: simulated = anchor + real elapsed x scale",
      TIME_SCALES.every((sc) => computeSimNow({ ...base, timeScale: sc }, 1_000_000 + 10_000) === 5_000_000 + 10_000 * sc),
      TIME_SCALES.join("/"),
    );
    check("paused clock is frozen", computeSimNow({ ...base, timeScale: 60, paused: true }, 9_999_999) === 5_000_000);

    simStore.setTimeScale(1);
    simStore.resume();
    simStore.setSimNowMs(Date.UTC(2026, 10, 9, 0, 0, 0) - 7 * 3600_000 + 9 * 3600_000); // 09:00 WIB
    const t0 = getNowMs();
    simStore.setTimeScale(60);
    const a = getNowMs();
    const spin = Date.now() + 120;
    while (Date.now() < spin) {
      // wait ~120 ms of real time
    }
    const b = getNowMs();
    check("scale 60: 120 ms real time moves the clock by about 7.2 s", b - a > 5000 && b - a < 12000 && a >= t0, `${b - a} ms`);
    simStore.pause();
    const p1 = getNowMs();
    const spin2 = Date.now() + 60;
    while (Date.now() < spin2) {
      // wait
    }
    check("pause freezes the clock", getNowMs() === p1);
    simStore.resume();
    simStore.setTimeScale(1);

    // ---- shift rollover ----------------------------------------------------------------------------
    const cur = getShiftInfo();
    simStore.setSimNowMs(cur.endSec * 1000 - 60_000);
    const before = getShiftInfo();
    simStore.setSimNowMs(cur.endSec * 1000 + 60_000);
    const after = getShiftInfo();
    check("rollover: new shift becomes current, old one shows full data", before.shiftKey !== after.shiftKey && getShiftInfoByKey(before.shiftKey).elapsedSec === SHIFT_SECONDS && !getShiftInfoByKey(before.shiftKey).isCurrent);
    check("rollover across midnight: shift keys are unique and contiguous", (() => {
      simStore.setSimNowMs(Date.UTC(2026, 10, 9, 0, 0, 0) - 7 * 3600_000 + 23.5 * 3600_000); // 23:30 WIB
      const c = getShiftInfo();
      simStore.setSimNowMs(c.endSec * 1000 + 3600_000);
      const n = getShiftInfo();
      return c.endSec === n.startSec && c.shiftKey !== n.shiftKey;
    })());

    // ---- completed shift: complete data, no gaps -------------------------------------------------------
    simStore.setSimNowMs(Date.UTC(2026, 10, 9, 0, 0, 0) - 7 * 3600_000 + 12 * 3600_000);
    const now = getShiftInfo();
    const past = getShiftInfoAt(now.startSec - SHIFT_SECONDS);
    check("past shift info: until = shift end", past.elapsedSec === SHIFT_SECONDS && !past.isCurrent);
    let complete = true;
    let gaps = 0;
    let detail = "";
    for (const line of LINES) {
      for (const m of machinesOf(line)) {
        const tl = getShiftTimeline(m, past, undefined, PLANT, "this-shift", line);
        if (tl.windows.length !== SHIFT_SECONDS / 30) {
          complete = false;
          detail = `${line}/${m}: ${tl.windows.length} windows`;
        }
        tl.windows.forEach((w, i) => {
          if (w.startSec !== i * 30 || w.endSec !== i * 30 + 30) gaps += 1;
        });
      }
    }
    check("completed shift: windows = shift length / 30 s and no gaps", complete && gaps === 0, detail || `${LINES.length} lines`);

    // ---- determinism ---------------------------------------------------------------------------------
    const sig = (line: string, m: string, sh = past) =>
      getShiftTimeline(m, sh, undefined, PLANT, "this-shift", line).events.map((e) => `${e.id}:${e.startSec}:${e.type}`).join("|");
    const m1 = machinesOf("TUP01")[0] ?? "LTR01";
    check("deterministic: same state gives identical event and window ids", sig("TUP01", m1) === sig("TUP01", m1));

    // ---- density: same loss per type, shorter events -----------------------------------------------------
    const dens: Density[] = ["normal", "high", "extreme"];
    const perDensity: Record<string, { counts: Record<string, number>; events: number; totals: string; ids: string }[]> = {};
    for (const d of dens) {
      simStore.setDensity(d);
      clearCurrentShiftCache();
      clearMetricsCache();
      perDensity[d] = [];
      for (const line of LINES) {
        for (const m of machinesOf(line)) {
          const tl = getShiftTimeline(m, past, undefined, PLANT, "this-shift", line);
          const t = getMachineShiftTotals(PLANT, line, m, past.startSec * 1000, past.endSec * 1000);
          perDensity[d]!.push({
            counts: typeCounts(tl),
            events: tl.events.filter((e) => e.type === "minor_stop" || e.type === "speed_loss").length,
            totals: [t.pdMin, t.dMin, t.msMin, t.slPosMin.toFixed(3), t.slNegMin.toFixed(3), t.units].join(","),
            ids: tl.events.map((e) => e.id).join(","),
          });
        }
      }
    }
    const keyCounts = (c: Record<string, number>) => ["planned", "downtime", "minor_stop", "speed_loss", "run"].map((k) => `${k}:${c[k] ?? 0}`).join(",");
    let sameCounts = true;
    let sameTotals = true;
    let detailC = "";
    (perDensity["normal"] ?? []).forEach((n, i) => {
      for (const d of ["high", "extreme"] as const) {
        const o = perDensity[d]?.[i];
        if (!o) continue;
        if (keyCounts(o.counts) !== keyCounts(n.counts)) {
          sameCounts = false;
          detailC = `${d} #${i}: ${keyCounts(o.counts)} vs ${keyCounts(n.counts)}`;
        }
        if (o.totals !== n.totals) {
          sameTotals = false;
          detailC = `${d} #${i}: totals ${o.totals} vs ${n.totals}`;
        }
      }
    });
    check("density keeps the same windows per type (timeline) as normal", sameCounts, detailC);
    check("density keeps the same closed-shift totals (PD/D/MS/SL/units) as normal", sameTotals, detailC);
    const nMS = (perDensity["normal"] ?? []).reduce((a, x) => a + x.events, 0);
    const hMS = (perDensity["high"] ?? []).reduce((a, x) => a + x.events, 0);
    const eMS = (perDensity["extreme"] ?? []).reduce((a, x) => a + x.events, 0);
    check("high and extreme produce more, shorter Minor Stop / Speed Loss events", hMS > nMS * 2 && eMS >= hMS, `normal ${nMS}, high ${hMS}, extreme ${eMS}`);

    // rules + ids on one dense machine
    simStore.setDensity("high");
    const tlh = getShiftTimeline(m1, past, undefined, PLANT, "this-shift", "TUP01");
    const ids = tlh.events.map((e) => e.id);
    check("event ids are unique and deterministic per density", new Set(ids).size === ids.length && sig("TUP01", m1) === sig("TUP01", m1));
    check(
      "rules: Minor Stop <= 10 min, Downtime > 10 min",
      tlh.events.every((e) => (e.type !== "minor_stop" || e.durationSec <= DOWNTIME_THRESHOLD_SEC) && (e.type !== "downtime" || e.durationSec > DOWNTIME_THRESHOLD_SEC)),
    );
    const piece = tlh.events.filter((e) => e.type === "minor_stop" || e.type === "speed_loss");
    check("high: pieces last 1-3 minutes (30-180 s)", piece.length > 0 && piece.every((e) => e.durationSec >= 30 && e.durationSec <= 180), `${piece.length} pieces`);
    // alternation inside an hour (best hour over all pilot machines)
    let best = { n: 0, alternating: false, where: "" };
    for (const line of LINES) {
      for (const m of machinesOf(line)) {
        const evs = getShiftTimeline(m, past, undefined, PLANT, "this-shift", line).events.filter((e) => e.type === "minor_stop" || e.type === "speed_loss");
        for (let h = 0; h < 8; h++) {
          const inHour = evs.filter((e) => e.startSec >= h * 3600 && e.startSec < (h + 1) * 3600);
          let flips = 0;
          inHour.forEach((e, i) => {
            if (i > 0 && inHour[i - 1]!.type !== e.type) flips += 1;
          });
          if (flips >= 3 && inHour.length > best.n) best = { n: inHour.length, alternating: true, where: `${line}/${m} h${h}` };
        }
      }
    }
    check("an hour shows many events alternating Minor Stop and Speed Loss", best.alternating && best.n >= 6, `${best.n} events (${best.where})`);
    simStore.setDensity("extreme");
    const tle = getShiftTimeline(m1, past, undefined, PLANT, "this-shift", "TUP01");
    const pe = tle.events.filter((e) => e.type === "minor_stop" || e.type === "speed_loss");
    check("extreme: pieces last 30-60 s", pe.length > 0 && pe.every((e) => e.durationSec >= 30 && e.durationSec <= 60), `${pe.length} pieces`);

    // ---- live shift: the timeline grows window by window ------------------------------------------------------
    simStore.setDensity("high");
    simStore.setSimNowMs(now.startSec * 1000 + 4 * 3600_000);
    const live1 = getShiftTimeline(m1, getShiftInfo(), undefined, PLANT, "this-shift", "TUP01");
    const reveal1 = live1.windows.filter((w) => w.output > 0 || w.type !== "run").length;
    simStore.setSimNowMs(now.startSec * 1000 + 4 * 3600_000 + 5 * 60_000);
    const live2 = getShiftTimeline(m1, getShiftInfo(), undefined, PLANT, "this-shift", "TUP01");
    const reveal2 = live2.windows.filter((w) => w.output > 0 || w.type !== "run").length;
    check("live shift: 5 simulated minutes reveal 10 more windows", reveal2 - reveal1 >= 9 && reveal2 - reveal1 <= 11, `${reveal1} -> ${reveal2}`);
    const stable = live1.windows.slice(0, 455).every((w, i) => {
      const o = live2.windows[i];
      return !!o && o.type === w.type && o.output === w.output;
    });
    check("history does not change while time grows (windows before the ongoing event)", stable);

    // ---- render cost with 150+ events per shift -----------------------------------------------------------------------
    simStore.setDensity("extreme");
    const t1 = performance.now();
    const big = getShiftTimeline(m1, past, undefined, PLANT, "this-shift", "TUP01");
    const ms = performance.now() - t1;
    check("dense shift (150+ events) builds in acceptable time", big.events.length >= 150 && ms < 400, `${big.events.length} events, ${ms.toFixed(1)} ms`);
  } finally {
    simStore.setDensity(saved.density);
    simStore.setTimeScale(saved.timeScale);
    simStore.setSimNowMs(savedNow);
    if (saved.paused) simStore.pause();
    else simStore.resume();
    clearCurrentShiftCache();
    clearMetricsCache();
  }
  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
  return { passed, results };
}

declare global {
  interface Window {
    runSimSelfTest?: typeof runSimSelfTest;
  }
}
if (typeof window !== "undefined") window.runSimSelfTest = runSimSelfTest;
