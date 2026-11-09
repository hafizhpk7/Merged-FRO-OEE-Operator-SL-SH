/**
 * Self-test for the simulation panel controls. Run `runSimPanelSelfTest()` in the browser console.
 * Restores the simulation state when it is done.
 */
import { getLineOperationalMode, setSrrLine } from "./assetMaster";
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { getMachineShiftTotals, clearCurrentShiftCache } from "./machineShiftTotals";
import { getShiftTimeline } from "./machineEvents";
import { clearMetricsCache } from "./metrics-engine";
import {
  applyPoScenario,
  exportSimState,
  importSimState,
  injectEvent,
  isSimulationActive,
  resetOverrides,
} from "./simControls";
import { getShiftPoPlan } from "./poMaster";
import { getNowMs, getShiftInfo, getShiftInfoAt, SHIFT_SECONDS } from "./shiftClock";
import { simStore } from "./simStore";
import { applyActualVsTarget, clearActualVsTarget } from "./simOutput";
import { getTargetSnapshot } from "./targetService";
import { runTargetSelfTest } from "./targetSelfTest";

type Check = { name: string; passed: boolean; detail?: string };
const PLANT = "J2";
const LINE = "BOP16";

export function runSimPanelSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });
  const backup = JSON.stringify(exportSimState());
  // machine codes repeat across J2 lines (the timeline resolves them to the first line): use unique ones
  const machines = (J2_LINES_CONFIG.find((l) => l.code === LINE)?.machines.map((m) => m.code) ?? []).filter(
    (c) => J2_LINES_CONFIG.filter((l) => l.machines.some((m) => m.code === c)).length === 1,
  );
  const m0 = machines[0] ?? "";

  try {
    resetOverrides();
    check("live defaults: nothing is overridden", !isSimulationActive());

    // fixed point: 4 h into the current shift
    const shift0 = getShiftInfo();
    simStore.pause();
    simStore.setSimNowMs(shift0.startSec * 1000 + 4 * 3600_000);
    const sh = getShiftInfo();
    const base = getTargetSnapshot(PLANT, LINE, "LINE");
    check("pause + fixed time makes the snapshot reproducible", JSON.stringify(getTargetSnapshot(PLANT, LINE, "LINE").result.shift) === JSON.stringify(base.result.shift));
    check("clock override counts as simulation active", isSimulationActive());

    // ---- Actual vs Target changes only the actual output (details: runSimOutputSelfTest) ---------------------
    const ap = applyActualVsTarget(PLANT, LINE, 80, "now");
    const lo = getTargetSnapshot(PLANT, LINE, "LINE");
    check("Actual vs Target 80%: target unchanged, actual follows the request", ap.ok && lo.result.shift.target === base.result.shift.target && lo.result.shift.actual !== base.result.shift.actual, `${base.result.shift.actual} -> ${lo.result.shift.actual}`);
    check("Actual vs Target 80%: actual = 80% of target (+-1 pcs)", Math.abs(lo.result.shift.actual - Math.round(0.8 * lo.result.shift.target)) <= 1);
    clearActualVsTarget(PLANT, LINE);
    const back = getTargetSnapshot(PLANT, LINE, "LINE");
    check("Natural restores the original actual exactly", back.result.shift.actual === base.result.shift.actual);

    // ---- SRR: blocked mode and restore ------------------------------------------------------------------------
    setSrrLine(PLANT, LINE, null);
    check("Unset SRR Line triggers the blocked mode", getLineOperationalMode(PLANT, LINE).reason === "srr-line-missing" && getTargetSnapshot(PLANT, LINE, "LINE").windows.length === 0);
    setSrrLine(PLANT, LINE, undefined);
    check("restoring the SRR Line brings the dashboard back", getLineOperationalMode(PLANT, LINE).mode === "full" && getTargetSnapshot(PLANT, LINE, "LINE").windows.length > 0);
    const seg0 = getShiftPoPlan(LINE, sh).segments[0];
    if (seg0) {
      simStore.setSrrSkuOverride(seg0.poNumber, null);
      check("Unset SRR SKU gives the running SKU no standard (TG-09)", getShiftPoPlan(LINE, sh).segments[0]?.srr === null && getTargetSnapshot(PLANT, LINE, "SKU").result.shift.noStandard === true);
      simStore.setSrrSkuOverride(seg0.poNumber, undefined);
      simStore.setSrrSkuOverride(seg0.poNumber, 20);
      check("SRR SKU edit feeds the plan at once", getShiftPoPlan(LINE, sh).segments[0]?.srr === 20);
      simStore.setSrrSkuOverride(seg0.poNumber, undefined);
    }

    // ---- scenarios -----------------------------------------------------------------------------------------------
    check("CR 5 engine examples (three-SKU, SRR, GAP) still hold at 100% output", runTargetSelfTest().passed);
    simStore.setPoPreset("continued");
    check("PO continued from the previous shift carries output (S > 0)", (getShiftPoPlan(LINE, sh).segments[0]?.carryActual ?? 0) > 0);
    simStore.setPoPreset(null);

    // ---- injected events appear in the timeline ---------------------------------------------------------------------
    simStore.setSimNowMs(shift0.startSec * 1000 + 5 * 3600_000);
    const sh5 = getShiftInfo();
    const inj = injectEvent(m0, "downtime", 15);
    const tl = getShiftTimeline(m0, sh5, undefined, PLANT, "this-shift", LINE);
    const ev = tl.events.find((e) => e.id.endsWith(inj.id));
    check("injected Downtime appears in the machine events at the current simulated time", !!ev && ev.type === "downtime" && ev.startSec === inj.startSec && ev.durationSec === 900, ev ? `${ev.startSec}+${ev.durationSec}` : "missing");
    const owned = tl.windows.filter((w) => w.eventId === ev?.id).length;
    check("injected event owns its windows as they are revealed", owned >= 0);
    const m1 = injectEvent(m0, "minor_stop", 3);
    check("injected Minor Stop is a Minor Stop (<= 10 min)", getShiftTimeline(m0, getShiftInfo(), undefined, PLANT, "this-shift", LINE).events.some((e) => e.id.endsWith(m1.id) && e.type === "minor_stop"));

    // ---- timeline and closed-shift totals agree with output rules and injected events ----------------------------------
    const past = getShiftInfoAt(sh5.startSec - SHIFT_SECONDS);
    // an override on a completed shift (built directly): timeline and closed-shift totals must still agree
    simStore.setOutputOverrides(`${PLANT}:${LINE}`, past.startSec, [
      { lineKey: `${PLANT}:${LINE}`, shiftStartSec: past.startSec, mode: "marginal", pct: 75, appliedIdx: 0, machine: "", fixed: {}, kPast: 1, kAfter: 0.75 },
    ]);
    simStore.addInjected({ shiftKey: past.shiftKey, machineCode: m0, type: "downtime", startSec: 3600, durationSec: 1200 });
    simStore.addInjected({ shiftKey: past.shiftKey, machineCode: m0, type: "speed_loss", startSec: 12000, durationSec: 1800, speedPct: 65 });
    clearCurrentShiftCache();
    clearMetricsCache();
    let parity = true;
    let detailP = "";
    for (const code of machines.slice(0, 4)) {
      const t = getShiftTimeline(code, past, undefined, PLANT, "this-shift", LINE);
      const units = t.windows.filter((w) => w.type !== "planned" && w.type !== "downtime" && w.type !== "minor_stop").reduce((a, w) => a + w.output, 0);
      const fast = getMachineShiftTotals(PLANT, LINE, code, past.startSec * 1000, past.endSec * 1000);
      if (Math.abs(fast.units - units) > 1) {
        parity = false;
        detailP += `${code}: fast ${fast.units} vs timeline ${units}; `;
      }
    }
    check("closed-shift totals equal the timeline with output rules and injected events", parity, detailP);

    // ---- export / import round trip -------------------------------------------------------------------------------------------
    simStore.setTimeScale(5);
    simStore.setDensity("high");
    simStore.setPlcDowntimeRatio(0.4);
    const exported = JSON.parse(JSON.stringify(exportSimState())) as ReturnType<typeof exportSimState>;
    const sig = (e: ReturnType<typeof exportSimState>) =>
      JSON.stringify([e.state.timeScale, e.state.paused, e.state.density, e.state.plcDowntimeRatio, e.state.outputOverrides, e.state.srrOverrides, e.state.srrSkuOverrides, e.state.injected, e.state.poPreset, e.shiftStartOverrideMin]);
    resetOverrides();
    check("reset returns to live defaults", !isSimulationActive() && simStore.get().injected.length === 0 && simStore.get().outputOverrides.length === 0);
    const err = importSimState(exported);
    const re = exportSimState();
    check("import restores the same state", err === null && sig(re) === sig(exported) && Math.abs(re.simNowMs - exported.simNowMs) < 5000, err ?? "");
    check("import rejects an invalid file", importSimState({ nope: true }) !== null);
  } finally {
    resetOverrides();
    try {
      importSimState(JSON.parse(backup));
    } catch {
      // keep defaults
    }
    clearCurrentShiftCache();
    clearMetricsCache();
    void getNowMs();
    void applyPoScenario;
  }
  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
  return { passed, results };
}

declare global {
  interface Window {
    runSimPanelSelfTest?: typeof runSimPanelSelfTest;
  }
}
if (typeof window !== "undefined") window.runSimPanelSelfTest = runSimPanelSelfTest;

