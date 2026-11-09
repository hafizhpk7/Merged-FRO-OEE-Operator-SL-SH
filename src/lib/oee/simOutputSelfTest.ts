/**
 * Self-test for the simulation "Actual vs Target (%)" control. Run `runSimOutputSelfTest()` in the
 * browser console. Restores the simulation state when it is done.
 */
import { getRepresentativeAsset } from "./assetMaster";
import { getShiftTimeline } from "./machineEvents";
import { computeOperatorCardMetrics } from "./operatorCardEngine";
import { exportSimState, importSimState, resetOverrides } from "./simControls";
import { applyActualVsTarget, clearActualVsTarget } from "./simOutput";
import { getShiftInfo, SHIFT_SECONDS } from "./shiftClock";
import { simStore } from "./simStore";
import { srrStore } from "./srrStore";
import { getTargetSnapshot } from "./targetService";

type Check = { name: string; passed: boolean; detail?: string };
const PLANT = "J2";
const LINE = "BOP16";

export function runSimOutputSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });
  const backup = JSON.stringify(exportSimState());
  const savedMode = srrStore.get();
  const bn = getRepresentativeAsset(PLANT, LINE);

  try {
    resetOverrides();
    simStore.pause();
    const s0 = getShiftInfo();
    simStore.setSimNowMs(s0.startSec * 1000 + 4 * 3600_000);
    const sh = getShiftInfo();
    const snapOf = (mode: "LINE" | "SKU") => getTargetSnapshot(PLANT, LINE, mode);

    // ---- Hit now: 130 / 100 / 80 % for both SRR switches -----------------------------------------------------
    for (const mode of ["LINE", "SKU"] as const) {
      srrStore.set(mode);
      clearActualVsTarget(PLANT, LINE);
      const base = snapOf(mode).result.shift;
      for (const pct of [130, 100, 80]) {
        const r = applyActualVsTarget(PLANT, LINE, pct, "now");
        const sn = snapOf(mode).result.shift;
        const want = Math.round((pct / 100) * sn.target);
        check(`Hit now ${pct}% (${mode}): actual = ${pct}% x target (+-1 pcs)`, r.ok && sn.target === base.target && Math.abs(sn.actual - want) <= 1, `target ${sn.target}, actual ${sn.actual}, want ${want}`);
        if (pct === 130) check(`Hit now 130% (${mode}): GAP OUTPUT = +30% of target (+-1), positive`, Math.abs(sn.gap - Math.round(0.3 * sn.target)) <= 1 && sn.gap > 0, `gap ${sn.gap}`);
        if (pct === 80) check(`Hit now 80% (${mode}): GAP OUTPUT = -20% of target (+-1), negative`, Math.abs(sn.gap + Math.round(0.2 * sn.target)) <= 1 && sn.gap < 0, `gap ${sn.gap}`);
      }
      clearActualVsTarget(PLANT, LINE);
      const back = snapOf(mode).result.shift;
      check(`Natural restores the baseline exactly (${mode})`, JSON.stringify(back) === JSON.stringify(base), `${base.actual} -> ${back.actual}`);
    }
    srrStore.set("LINE");

    // ---- window rules, events and OEE A/P unchanged ---------------------------------------------------------------
    clearActualVsTarget(PLANT, LINE);
    const evSig = () =>
      getShiftTimeline(bn, getShiftInfo(), undefined, PLANT, "this-shift", LINE).events.map((e) => `${e.id}:${e.type}:${e.startSec}:${e.endSec}:${e.isTagged ? 1 : 0}`).join("|");
    const ap = () => {
      const m = computeOperatorCardMetrics(PLANT, LINE, false).lineMetrics;
      return `${m.availabilityPct.toFixed(4)}/${m.performancePct.toFixed(4)}`;
    };
    const evBefore = evSig();
    const apBefore = ap();
    applyActualVsTarget(PLANT, LINE, 130, "now");
    check("events, ids and tag state are unchanged after applying", evSig() === evBefore);
    check("OEE availability and performance are unchanged after applying", ap() === apBefore, `${apBefore} -> ${ap()}`);
    const tl = getShiftTimeline(bn, getShiftInfo(), undefined, PLANT, "this-shift", LINE);
    check("Minor Stop and Downtime windows keep zero output", tl.windows.filter((w) => w.type === "minor_stop" || w.type === "downtime").every((w) => w.output === 0));
    clearActualVsTarget(PLANT, LINE);
    check("events and OEE A/P are unchanged after reset", evSig() === evBefore && ap() === apBefore);

    // ---- past windows do not change when time moves -----------------------------------------------------------------
    applyActualVsTarget(PLANT, LINE, 120, "now");
    const first = snapOf("LINE").windows.map((w) => w.output);
    simStore.setSimNowMs(sh.startSec * 1000 + 4 * 3600_000 + 600_000);
    const later = snapOf("LINE").windows.map((w) => w.output);
    // the last 10 minutes before "now" belong to the generator's synthetic ongoing stop and fill in naturally as time advances
    const stable = first.length - 25;
    check("windows applied earlier keep their output when time advances (k is not recomputed)", first.slice(0, stable).every((v, i) => v === later[i]), `${stable} windows compared`);
    simStore.setSimNowMs(sh.startSec * 1000 + 4 * 3600_000);
    clearActualVsTarget(PLANT, LINE);

    // ---- From now on: windows after the apply time give pct x their own target ---------------------------------------------
    for (const pct of [130, 80]) {
      clearActualVsTarget(PLANT, LINE);
      simStore.setSimNowMs(sh.startSec * 1000 + 3 * 3600_000);
      const at = snapOf("LINE");
      const r = applyActualVsTarget(PLANT, LINE, pct, "marginal");
      const pastSame = JSON.stringify(snapOf("LINE").windows.map((w) => w.output)) === JSON.stringify(at.windows.map((w) => w.output));
      simStore.setSimNowMs(sh.endSec * 1000 - 1);
      const endSnap = snapOf("LINE");
      const end = endSnap.result.shift;
      const actualAfter = endSnap.windows.slice(at.windows.length).reduce((a, w) => a + w.output, 0);
      const ratio = (actualAfter / (end.target - at.result.shift.target)) * 100;
      check(`From now on ${pct}%: marginal ratio after the apply time = ${pct}% (+-0.5)`, r.ok && Math.abs(ratio - pct) <= 0.5, `ratio ${ratio.toFixed(2)}%`);
      check(`From now on ${pct}%: past windows stay as they were`, pastSame);
    }
    check("shift length is unchanged", SHIFT_SECONDS === 28800);
  } finally {
    try {
      resetOverrides();
      srrStore.set(savedMode);
      importSimState(JSON.parse(backup));
    } catch {
      // keep defaults
    }
  }
  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
  return { passed, results };
}

declare global {
  interface Window {
    runSimOutputSelfTest?: typeof runSimOutputSelfTest;
  }
}
if (typeof window !== "undefined") window.runSimOutputSelfTest = runSimOutputSelfTest;
