/**
 * Dev self-test for CR 1 part B (reject L2 flag and filter). Run `runRejectL2SelfTest()` in the
 * browser console. It purges everything it writes (corrections, test configuration, snapshots).
 */
import { clearCurrentShiftCache, getMachineShiftTotals } from "./machineShiftTotals";
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { getShiftTimeline } from "./machineEvents";
import { clearMetricsCache, getMetrics } from "./metrics-engine";
import { getL3Bindings, getLineMachineCodesForConfig, rejectConfigStore, type L2Id } from "./rejectConfigStore";
import { _forgetSlotSnapshot, rejectStore } from "./rejectStore";
import { getNowMs, getShiftInfo } from "./shiftClock";

type Check = { name: string; passed: boolean; detail?: string };

const PILOT_LINES = ["TUP01", "TUP13", "TUP14", "BOP15", "BOP16"];
const PLANT = "J2";
const L2S: L2Id[] = ["RM", "RP", "RS"];

export function runRejectL2SelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });

  const shift = getShiftInfo();
  const shiftKey = shift.shiftKey;
  const pastKey = "2000-01-01:A"; // never a real shift: used for the history check
  const touchedCorrections: { line: string; machine: string; l3: string }[] = [];
  let configTouched: { line: string; machine: string } | null = null;

  try {
    // ---- configuration: one slot per (L2, L3), unique per machine (MD-01, MD-08, MD-09) --------
    let multiSeen = false;
    let singleSeen = false;
    let allUnique = true;
    let allAssigned = true;
    let bindingsMatch = true;
    for (const line of PILOT_LINES) {
      for (const m of getLineMachineCodesForConfig(PLANT, line)) {
        const slots = rejectConfigStore.getSlots(PLANT, line, m);
        const statuses = rejectConfigStore.validate(slots);
        if (statuses.some((s) => s.status === "Duplikat")) allUnique = false;
        if (statuses.some((s) => s.status !== "Assigned")) allAssigned = false;
        for (const c of rejectConfigStore.getCards(PLANT, line, m)) {
          if (c.l2.length > 1) multiSeen = true;
          else singleSeen = true;
          if (c.l2.join() !== getL3Bindings(c.l3Id).join()) bindingsMatch = false;
        }
      }
    }
    check("slots are unique per (L2, L3) on every pilot machine", allUnique);
    check("every default slot is Assigned (L2 and L3 complete)", allAssigned);
    check("a reason bound to several L2s gets one slot per L2", multiSeen && bindingsMatch);
    check("single-L2 reasons exist too", singleSeen);
    check(
      "duplicate (L2, L3) and half-filled slots are rejected on save (MD-06, MD-08)",
      (() => {
        const dup = rejectConfigStore.saveSlots(PLANT, PILOT_LINES[0] ?? "TUP01", "ZZ", [
          { slotNo: 1, l2Id: "RM", l3Id: "reject-seal" },
          { slotNo: 2, l2Id: "RM", l3Id: "reject-seal" },
        ]);
        const half = rejectConfigStore.saveSlots(PLANT, PILOT_LINES[0] ?? "TUP01", "ZZ", [
          { slotNo: 1, l2Id: null, l3Id: "reject-seal" },
        ]);
        return !dup.ok && !half.ok;
      })(),
    );

    // ---- sensor input split by slot ----------------------------------------------------------
    let splitMachine: { line: string; machine: string; l3: string; l2: L2Id[] } | null = null;
    for (const line of PILOT_LINES) {
      for (const m of getLineMachineCodesForConfig(PLANT, line)) {
        const multi = rejectConfigStore.getCards(PLANT, line, m).find((c) => c.l2.length > 1);
        if (multi && !splitMachine) splitMachine = { line, machine: m, l3: multi.l3Id, l2: multi.l2 };
      }
    }
    check("a machine with a multi-L2 reason exists", !!splitMachine);
    if (splitMachine) {
      const logs = rejectStore
        .getAllLogs(PLANT, splitMachine.line, pastKey)
        .filter((l) => l.machineCode === splitMachine!.machine && l.l3Id === splitMachine!.l3);
      const byL2: Record<L2Id, number> = { RM: 0, RP: 0, RS: 0 };
      for (const l of logs) byL2[l.l2Id] += l.qty;
      const used = L2S.filter((k) => byL2[k] > 0);
      check(
        "sensor entries carry l2Id/l3Id and only land in bound L2s",
        logs.length > 0 && logs.every((l) => !!l.l2Id && l.l3Id === splitMachine!.l3 && splitMachine!.l2.includes(l.l2Id)),
      );
      check(
        "multi-L2 reason splits its sensor input across slots (>= 2 categories used)",
        used.length >= 2,
        `RM ${byL2.RM} | RP ${byL2.RP} | RS ${byL2.RS}`,
      );
      check(
        "split adds up to the reason total",
        byL2.RM + byL2.RP + byL2.RS === logs.reduce((a, l) => a + l.qty, 0),
      );

      // ---- history is frozen when the configuration changes (3.1) --------------------------
      const before = JSON.stringify(
        rejectStore.getAllLogs(PLANT, splitMachine.line, pastKey).map((l) => [l.id, l.l2Id, l.qty]),
      );
      configTouched = { line: splitMachine.line, machine: splitMachine.machine };
      const only = rejectConfigStore.getSlots(PLANT, splitMachine.line, splitMachine.machine).filter(
        (s) => !(s.l3Id === splitMachine!.l3 && s.l2Id !== "RM"),
      );
      const saved = rejectConfigStore.saveSlots(PLANT, splitMachine.line, splitMachine.machine, only);
      const after = JSON.stringify(
        rejectStore.getAllLogs(PLANT, splitMachine.line, pastKey).map((l) => [l.id, l.l2Id, l.qty]),
      );
      check("configuration change saved", saved.ok);
      check("historical (closed shift) entries do not change when the configuration changes", before === after);
      const cardNow = rejectConfigStore
        .getCards(PLANT, splitMachine.line, splitMachine.machine)
        .find((c) => c.l3Id === splitMachine!.l3);
      check("the live card follows the new configuration (single L2 now)", cardNow?.l2.join() === "RM");
      rejectConfigStore._resetForTest();
      configTouched = null;
    }

    // ---- chips, cards and KPIs agree everywhere (OP-01..OP-08, parity) ---------------------
    // machine codes repeat across lines (LBF, LBC, SHR, ...): metrics-engine resolves a machine
    // code to its first line, so it is only compared on that owner line.
    const owner = new Map<string, string>();
    for (const l of J2_LINES_CONFIG) for (const mm of l.machines) if (mm.code && !owner.has(mm.code)) owner.set(mm.code, l.code);
    let metricsSkipped = 0;
    // These caches are cleared by a store subscription in the browser only; clear them for Node runs.
    clearCurrentShiftCache();
    clearMetricsCache();
    let machinesChecked = 0;
    let chipsOk = true;
    let cardsOk = true;
    let kpiOk = true;
    let kpiDetail = "";
    const nowMs = getNowMs();
    for (const line of PILOT_LINES) {
      for (const m of getLineMachineCodesForConfig(PLANT, line)) {
        machinesChecked += 1;
        const t = rejectStore.getCategoryTotals(PLANT, line, shiftKey, m);
        const totalReject = rejectStore.getTotals(PLANT, line, shiftKey, m).totalReject;
        if (t.byL2.RM + t.byL2.RP + t.byL2.RS !== t.total || t.total !== totalReject) chipsOk = false;
        const cardSum = Object.values(t.byL3).reduce((a, r) => a + r.RM + r.RP + r.RS, 0) + t.otherTotal;
        if (cardSum !== t.total) cardsOk = false;
        for (const c of rejectConfigStore.getCards(PLANT, line, m)) {
          const series = rejectStore.getHourlySeries(PLANT, line, shiftKey, c.l3Id, m);
          const row = t.byL3[c.l3Id] ?? { RM: 0, RP: 0, RS: 0 };
          const cardTotal = row.RM + row.RP + row.RS;
          if (series.current.reduce((a, b) => a + b, 0) !== cardTotal) cardsOk = false;
          // OP-07 total is the sum over bound categories only (no stray category)
          const stray = L2S.filter((k) => !c.l2.includes(k)).reduce((a, k) => a + row[k], 0);
          if (stray !== 0) cardsOk = false;
        }
        if (totalReject > 0) {
          const tl = getShiftTimeline(m, shift, undefined, PLANT, "this-shift", line);
          const slsh = getMachineShiftTotals(PLANT, line, m, shift.startSec * 1000, nowMs).reject;
          const isOwner = owner.get(m) === line;
          const metrics = isOwner ? getMetrics(PLANT, "machine", m, "this-shift").outputReject : totalReject;
          if (!isOwner) metricsSkipped += 1;
          if (tl.snapshot.rejects !== totalReject || slsh !== totalReject || metrics !== totalReject) {
            kpiOk = false;
            kpiDetail = `${line}/${m}: chips ${totalReject}, operator ${tl.snapshot.rejects}, SL/SH ${slsh}, metrics ${metrics}`;
          }
        }
      }
    }
    check("pilot machines covered", machinesChecked >= 5, `${machinesChecked} machines`);
    check("chip totals add up (RM + RP + RS = Semua = machine total reject)", chipsOk);
    check("card totals add up (sum of cards + Reject lain = Semua; card = bound categories)", cardsOk);
    check(
      "KPI parity: Reason/OEE strip, SL/SH Machine Output and metrics use the same total",
      kpiOk,
      kpiDetail || `metrics-engine skipped on ${metricsSkipped} non-owner duplicate machine code(s)`,
    );

    // ---- a correction on one L2 moves only that L2 ----------------------------------------------
    outer: for (const line of PILOT_LINES) {
      for (const m of getLineMachineCodesForConfig(PLANT, line)) {
        const card = rejectConfigStore.getCards(PLANT, line, m).find((c) => c.l2.length > 1);
        if (!card) continue;
        const by = rejectStore.getHourlyByL2(PLANT, line, shiftKey, card.l3Id, m);
        const target = card.l2.find((l2) => by.current[l2].some((v, h) => v >= 1 && h < 7));
        if (!target) continue;
        const hour = by.current[target].findIndex((v, h) => v >= 1 && h < 7);
        const t0 = rejectStore.getCategoryTotals(PLANT, line, shiftKey, m);
        const kpi0 = rejectStore.getTotals(PLANT, line, shiftKey, m).totalReject;
        rejectStore.saveCorrections({
          plantId: PLANT,
          lineId: line,
          shiftKey,
          machineCode: m,
          l3Id: card.l3Id,
          l3Name: card.name,
          category: "Reject",
          operator: "Self-test",
          reason: "Self-test",
          leader: "Self-test",
          changes: [{ hourIdx: hour, minute: 0, l2Id: target, after: -1 }],
        });
        touchedCorrections.push({ line, machine: m, l3: card.l3Id });
        const t1 = rejectStore.getCategoryTotals(PLANT, line, shiftKey, m);
        const kpi1 = rejectStore.getTotals(PLANT, line, shiftKey, m).totalReject;
        const others = L2S.filter((k) => k !== target);
        check(
          "correction on one L2 lowers only that L2 chip",
          t1.byL2[target] === t0.byL2[target] - 1 && others.every((k) => t1.byL2[k] === t0.byL2[k]),
          `${target}: ${t0.byL2[target]} -> ${t1.byL2[target]}`,
        );
        check("the same correction lowers the card total and the KPI total by 1", kpi1 === kpi0 - 1 &&
          (t1.byL3[card.l3Id] ? Object.values(t1.byL3[card.l3Id]!).reduce((a, b) => a + b, 0) : 0) ===
            Object.values(t0.byL3[card.l3Id] ?? {}).reduce((a, b) => a + b, 0) - 1);
        const stored = rejectStore.getCorrections(PLANT, line, shiftKey, card.l3Id, m).filter((c) => c.operator === "Self-test");
        check("the correction stores its L2 explicitly", stored.length === 1 && stored[0]?.l2Id === target);
        break outer;
      }
    }
    check("a multi-L2 card with data exists for the correction check", touchedCorrections.length > 0);
  } finally {
    if (touchedCorrections.length) rejectStore._purgeByOperator("Self-test");
    if (configTouched) rejectConfigStore._resetForTest();
    for (const line of PILOT_LINES) _forgetSlotSnapshot(PLANT, line, pastKey);
  }

  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") {
    console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
    console.info("[CR1-B] Reject L2 Self-Test Passed:", passed);
  }
  return { passed, results };
}

declare global {
  interface Window {
    runRejectL2SelfTest?: typeof runRejectL2SelfTest;
  }
}

if (typeof window !== "undefined") {
  window.runRejectL2SelfTest = runRejectL2SelfTest;
}
