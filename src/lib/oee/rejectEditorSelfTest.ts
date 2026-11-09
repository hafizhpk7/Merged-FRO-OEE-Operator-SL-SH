/**
 * Dev self-test for CR 1 part C (Konfigurasi detail; single-L2 review version). Run `runRejectEditorSelfTest()`
 * in the browser console. Everything it writes carries the operator name below and is purged.
 */
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { clearCurrentShiftCache, getMachineShiftTotals } from "./machineShiftTotals";
import { clearMetricsCache } from "./metrics-engine";
import { getShiftTimeline } from "./machineEvents";
import { getLineMachineCodesForConfig, rejectConfigStore, type L2Id } from "./rejectConfigStore";
import { rejectStore } from "./rejectStore";
import { getNowMs, getShiftInfo } from "./shiftClock";

type Check = { name: string; passed: boolean; detail?: string };
type Candidate = {
  line: string;
  m: string;
  l3: string;
  name: string;
  hour: number;
  actual: number;
  l2: L2Id;
};

const PLANT = "J2";
const PILOT_LINES = ["TUP01", "TUP13", "TUP14", "BOP15", "BOP16"];
const OP = "Self-test-editor";

export function runRejectEditorSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });

  const shift = getShiftInfo();
  const shiftKey = shift.shiftKey;
  const nowMs = getNowMs();
  let wrote = false;

  const base = (line: string, m: string, l3Id: string, l3Name: string) => ({
    plantId: PLANT,
    lineId: line,
    shiftKey,
    machineCode: m,
    l3Id,
    l3Name,
    category: "Reject" as const,
    operator: OP,
    reason: "Self-test",
    leader: "Leader Test",
  });

  const kpi = (line: string, m: string) => {
    // The browser clears this cache through a store subscription; under Node it must be cleared here.
    clearCurrentShiftCache();
    clearMetricsCache();
    const tl = getShiftTimeline(m, shift, undefined, PLANT, "this-shift", line);
    return {
      total: rejectStore.getTotals(PLANT, line, shiftKey, m).totalReject,
      rejects: tl.snapshot.rejects,
      good: tl.snapshot.goodOutput,
      output: tl.snapshot.totalOutput,
      slsh: getMachineShiftTotals(PLANT, line, m, shift.startSec * 1000, nowMs).reject,
    };
  };

  try {
    // pick a machine / reason / hour that has actual reject
    let pick = null as Candidate | null;
    for (const line of PILOT_LINES) {
      for (const m of getLineMachineCodesForConfig(PLANT, line)) {
        if (kpi(line, m).output < 200) continue; // needs output so Good (= output - reject) can move
        for (const card of rejectConfigStore.getCards(PLANT, line, m)) {
          const by = rejectStore.getHourly(PLANT, line, shiftKey, card.l3Id, m);
          for (let h = 0; h < 8; h++) {
            const actual = by.actual[h] ?? 0;
            const cand = { line, m, l3: card.l3Id, name: card.name, hour: h, actual, l2: card.l2 };
            if (actual >= 2 && (!pick || actual > pick.actual)) pick = cand;
          }
        }
      }
    }
    check("a reason with actual reject in an hour exists", !!pick);

    // ---- validation (OP-15..OP-18) ------------------------------------------------------------
    if (pick) {
      const p = pick;
      const b = base(p.line, p.m, p.l3, p.name);
      const l2 = p.l2;
      const corrBefore = rejectStore.getCorrections(PLANT, p.line, shiftKey, p.l3, p.m).length;
      const auditBefore = rejectStore.getAudit(PLANT, p.line, p.m, p.l3).length;
      const bad = [
        { ...b, operator: "", changes: [{ hourIdx: p.hour, minute: 1, after: -1 }] },
        { ...b, reason: "   ", changes: [{ hourIdx: p.hour, minute: 1, after: -1 }] },
        { ...b, leader: "", changes: [{ hourIdx: p.hour, minute: 1, after: -1 }] },
        { ...b, changes: [{ hourIdx: p.hour, minute: 1, after: -1.5 }] },
        { ...b, changes: [{ hourIdx: p.hour, minute: 1, after: -(p.actual + 1) }] },
        { ...b, changes: [] },
      ].map((x) => rejectStore.saveCorrections(x));
      check("save is refused without operator, reason, leader, integer qty, or any change", bad.every((r) => !r.ok));
      check(
        "refused saves write nothing (no corrections, no audit entry)",
        rejectStore.getCorrections(PLANT, p.line, shiftKey, p.l3, p.m).length === corrBefore &&
          rejectStore.getAudit(PLANT, p.line, p.m, p.l3).length === auditBefore,
      );
      const over = rejectStore.saveCorrections({
        ...b,
        changes: [{ hourIdx: p.hour, minute: 1, after: -(p.actual + 1) }],
      });
      check(
        "reducing below the hour's actual is refused with the hour named",
        !over.ok && /melebihi/.test(over.errors.join(" ")),
        over.ok ? "unexpectedly ok" : over.errors.join(" "),
      );

      // ---- the worked example: -k on a reason with `actual` in an hour --------------------------
      const k = Math.min(6, p.actual);
      const t0 = rejectStore.getL2Totals(PLANT, p.line, shiftKey, p.m);
      const k0 = kpi(p.line, p.m);
      const hourCur0 = rejectStore.getHourlySeries(PLANT, p.line, shiftKey, p.l3, p.m).current[p.hour] ?? 0;
      const res = rejectStore.saveCorrections({
        ...b,
        changes: [{ hourIdx: p.hour, minute: 10, after: -k }],
      });
      wrote = true;
      check("worked example saves", res.ok);
      const series = rejectStore.getHourlySeries(PLANT, p.line, shiftKey, p.l3, p.m);
      check(
        `hour keeps Actual ${p.actual} and Current becomes ${p.actual} - ${k}`,
        series.actual[p.hour] === p.actual && series.current[p.hour] === hourCur0 - k,
        `actual ${series.actual[p.hour]}, current ${series.current[p.hour]}`,
      );
      const t1 = rejectStore.getL2Totals(PLANT, p.line, shiftKey, p.m);
      const k1 = kpi(p.line, p.m);
      const cardSum = (t: typeof t0) => t.byL3[p.l3] ?? 0;
      check("card total drops by k", cardSum(t1) === cardSum(t0) - k, `${cardSum(t0)} -> ${cardSum(t1)}`);
      check("chip totals drop by k (category and Semua)", t1.byL2[l2] === t0.byL2[l2] - k && t1.total === t0.total - k);
      check(
        "Reason/OEE strip total reject and SL/SH reject follow the correction",
        k1.total === k0.total - k && k1.rejects === k0.rejects - k && k1.slsh === k0.slsh - k,
        `total ${k0.total}->${k1.total}, operator ${k0.rejects}->${k1.rejects}, SL/SH ${k0.slsh}->${k1.slsh}`,
      );
      check(
        "SL/SH Machine Output sub-line: Good goes up by k",
        k0.output > k0.rejects && k1.good === k0.good + k,
        `output ${k0.output}, good ${k0.good} -> ${k1.good}`,
      );
      check("corrections carry source 'correction'", rejectStore.getTotals(PLANT, p.line, shiftKey, p.m).correction === -k);

      const a1 = rejectStore.getAudit(PLANT, p.line, p.m, p.l3).filter((a) => a.operator === OP);
      const first = a1[0];
      check(
        "audit row: operator, reason, leader, time, hour, minute, L2, L3, machine, before, after, delta",
        !!first &&
          first.operator === OP &&
          first.reason === "Self-test" &&
          first.leader === "Leader Test" &&
          first.savedAt > 0 &&
          first.hourIdx === p.hour &&
          first.minute === 10 &&
          first.l2Id === l2 &&
          first.l3Id === p.l3 &&
          first.machineCode === p.m &&
          first.before === 0 &&
          first.after === -k &&
          first.delta === -k,
      );

      // edit the saved row, then delete it
      const edit = rejectStore.saveCorrections({
        ...b,
        reason: "Edit",
        changes: [{ hourIdx: p.hour, minute: 10, after: -(k - 1) }],
      });
      const aEdit = rejectStore.getAudit(PLANT, p.line, p.m, p.l3).filter((a) => a.operator === OP)[0];
      check(
        "editing a saved row records before -k, after -(k-1), delta +1",
        edit.ok && !!aEdit && aEdit.before === -k && aEdit.after === -(k - 1) && aEdit.delta === 1,
      );
      check("audit lists newest first", (() => {
        const list = rejectStore.getAudit(PLANT, p.line, p.m, p.l3);
        return list.every((a, i) => i === 0 || list[i - 1]!.savedAt >= a.savedAt);
      })());
      const del = rejectStore.saveCorrections({ ...b, reason: "Hapus", changes: [{ hourIdx: p.hour, minute: 10, after: 0 }] });
      const afterDel = rejectStore.getHourlySeries(PLANT, p.line, shiftKey, p.l3, p.m);
      check(
        "deleting the row restores Current to the original and logs after 0",
        del.ok &&
          afterDel.current[p.hour] === hourCur0 &&
          rejectStore.getCorrections(PLANT, p.line, shiftKey, p.l3, p.m).filter((c) => c.operator === OP).length === 0 &&
          rejectStore.getAudit(PLANT, p.line, p.m, p.l3).filter((a) => a.operator === OP)[0]?.after === 0,
      );
    }

    // ---- review version: one Qty per row, extra-reject card removed -----------------------------------------
    const cs = rejectConfigStore as unknown as Record<string, unknown>;
    check("the extra-reject card API (getOtherL3Options) is gone from the config store", cs["getOtherL3Options"] === undefined);
    if (pick) {
      const p = pick;
      const b = base(p.line, p.m, p.l3, p.name);
      const t0 = rejectStore.getL2Totals(PLANT, p.line, shiftKey, p.m);
      const r = rejectStore.saveCorrections({ ...b, changes: [{ hourIdx: p.hour, minute: 20, after: 2 }] });
      wrote = true;
      const t1 = rejectStore.getL2Totals(PLANT, p.line, shiftKey, p.m);
      const rows = rejectStore.getAudit(PLANT, p.line, p.m, p.l3).filter((x) => x.operator === OP && x.minute === 20);
      check("an increase (+2) saves one audit row with the card's single L2", r.ok && rows.length === 1 && rows[0]?.l2Id === p.l2 && rows[0]?.delta === 2);
      check("it raises the card, its L2 chip and Semua by 2", (t1.byL3[p.l3] ?? 0) === (t0.byL3[p.l3] ?? 0) + 2 && t1.byL2[p.l2] === t0.byL2[p.l2] + 2 && t1.total === t0.total + 2);
    }

    // ---- Stage 3 add/remove paths are gone --------------------------------------------------------------------
    const store = rejectStore as unknown as Record<string, unknown>;
    check(
      "Stage 3 add/remove reject code paths are removed",
      store["addManualReject"] === undefined && store["removeLogs"] === undefined && store["applyCorrections"] === undefined,
    );
    void J2_LINES_CONFIG;
  } finally {
    if (wrote) rejectStore._purgeByOperator(OP);
  }

  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") {
    console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
    console.info("[CR1-C] Reject Editor Self-Test Passed:", passed);
  }
  return { passed, results };
}

declare global {
  interface Window {
    runRejectEditorSelfTest?: typeof runRejectEditorSelfTest;
  }
}

if (typeof window !== "undefined") {
  window.runRejectEditorSelfTest = runRejectEditorSelfTest;
}
