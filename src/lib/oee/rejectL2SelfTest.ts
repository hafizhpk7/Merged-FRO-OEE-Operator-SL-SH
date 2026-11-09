/**
 * Dev self-test for the reject category model (CR 1, review version: every L3 entry belongs to one L2).
 * Run `runRejectL2SelfTest()` in the browser console. It purges everything it writes.
 */
import { clearCurrentShiftCache, getMachineShiftTotals } from "./machineShiftTotals";
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { getShiftTimeline } from "./machineEvents";
import { clearMetricsCache, getMetrics } from "./metrics-engine";
import { entryId, getEntriesForL2, getEntry, migrateL3, REJECT_TYPES } from "./rejectConfig";
import {
  getLineMachineCodesForConfig,
  migrateSlot,
  rejectConfigStore,
  type L2Id,
} from "./rejectConfigStore";
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
  let correctionsTouched = false;
  let configTouched = false;

  try {
    // ---- master: one L2 per entry, unique ids, same label separate entries ----------------------
    const ids = REJECT_TYPES.map((t) => t.id);
    check("entry ids are unique", new Set(ids).size === ids.length);
    check(
      "every Reject entry has exactly one L2 and its id carries it",
      REJECT_TYPES.filter((t) => t.category === "Reject").every((t) => !!t.l2 && t.id.startsWith(`${t.l2!.toLowerCase()}.`)),
    );
    const labelL2s = new Map<string, Set<L2Id>>();
    for (const t of REJECT_TYPES) if (t.l2) (labelL2s.get(t.name) ?? labelL2s.set(t.name, new Set()).get(t.name)!).add(t.l2);
    const multiLabels = [...labelL2s.entries()].filter(([, s]) => s.size > 1).map(([n]) => n);
    check("labels needed under several L2s are separate entries (same label, different ids)", multiLabels.length >= 3, multiLabels.join(", "));
    check("L3 picker is restricted to the chosen L2", L2S.every((l2) => getEntriesForL2(l2).every((e) => e.l2 === l2)));

    // ---- configuration -------------------------------------------------------------------------
    let allUnique = true;
    let allAssigned = true;
    let oneL2 = true;
    for (const line of PILOT_LINES) {
      for (const m of getLineMachineCodesForConfig(PLANT, line)) {
        const slots = rejectConfigStore.getSlots(PLANT, line, m);
        const statuses = rejectConfigStore.validate(slots);
        if (statuses.some((s) => s.status === "Duplicate")) allUnique = false;
        if (statuses.some((s) => s.status !== "Assigned")) allAssigned = false;
        for (const c of rejectConfigStore.getCards(PLANT, line, m)) if (getEntry(c.l3Id)?.l2 !== c.l2) oneL2 = false;
      }
    }
    check("default slots are unique per (machine, L2, L3) and Assigned", allUnique && allAssigned);
    check("every card has one L2 matching its entry", oneL2);

    const L = PILOT_LINES[0] ?? "TUP01";
    const dup = rejectConfigStore.saveSlots(PLANT, L, "ZZ", [
      { slotNo: 1, l2Id: "RM", l3Id: entryId("RM", "reject-seal") },
      { slotNo: 2, l2Id: "RM", l3Id: entryId("RM", "reject-seal") },
    ]);
    const half = rejectConfigStore.saveSlots(PLANT, L, "ZZ", [{ slotNo: 1, l2Id: null, l3Id: entryId("RM", "reject-seal") }]);
    const wrongL2 = rejectConfigStore.saveSlots(PLANT, L, "ZZ", [{ slotNo: 1, l2Id: "RS", l3Id: entryId("RM", "reject-seal") }]);
    check("duplicates, half-filled and wrong-L2 slots are rejected on save", !dup.ok && !half.ok && !wrongL2.ok);
    check(
      "duplicate slot is reported with status Duplicate",
      rejectConfigStore.validate([
        { slotNo: 1, l2Id: "RM", l3Id: entryId("RM", "reject-seal") },
        { slotNo: 2, l2Id: "RM", l3Id: entryId("RM", "reject-seal") },
      ])[1]?.status === "Duplicate",
    );

    // ---- same label under RM and RS = two slots, two entries, two cards -------------------------
    const mc = getLineMachineCodesForConfig(PLANT, L)[0] ?? "LCM07";
    configTouched = true;
    const two = rejectConfigStore.saveSlots(PLANT, L, mc, [
      { slotNo: 1, l2Id: "RM", l3Id: entryId("RM", "penyok") },
      { slotNo: 2, l2Id: "RS", l3Id: entryId("RS", "penyok") },
    ]);
    const cards = rejectConfigStore.getCards(PLANT, L, mc);
    check("two slots with the same label under RM and RS give two cards", two.ok && cards.length === 2 && cards[0]?.name === cards[1]?.name && cards[0]?.l3Id !== cards[1]?.l3Id);
    const t = rejectStore.getL2Totals(PLANT, L, shiftKey, mc);
    const a = cards[0]?.l3Id ?? "";
    const b = cards[1]?.l3Id ?? "";
    check("each card has its own total", (t.byL3[a] ?? 0) + (t.byL3[b] ?? 0) === t.total);

    // correction on one card does not touch the sibling
    const sa = rejectStore.getHourly(PLANT, L, shiftKey, a, mc);
    const hour = sa.current.findIndex((v, h) => v >= 1 && h < 7);
    if (hour >= 0) {
      const sibBefore = rejectStore.getHourly(PLANT, L, shiftKey, b, mc).current.join();
      const res = rejectStore.saveCorrections({
        plantId: PLANT, lineId: L, shiftKey, machineCode: mc, l3Id: a, l3Name: cards[0]?.name ?? "",
        category: "Reject", operator: "Self-test", reason: "Self-test", leader: "Self-test",
        changes: [{ hourIdx: hour, minute: 0, after: -1 }],
      });
      correctionsTouched = true;
      const t1 = rejectStore.getL2Totals(PLANT, L, shiftKey, mc);
      check("correction saves", res.ok);
      check("a correction on one card does not change the sibling card of the same label", rejectStore.getHourly(PLANT, L, shiftKey, b, mc).current.join() === sibBefore && (t1.byL3[b] ?? 0) === (t.byL3[b] ?? 0));
      check("the corrected card and its L2 chip drop by 1", (t1.byL3[a] ?? 0) === (t.byL3[a] ?? 0) - 1 && t1.byL2[cards[0]!.l2] === t.byL2[cards[0]!.l2] - 1);
      const stored = rejectStore.getCorrections(PLANT, L, shiftKey, a, mc).filter((c) => c.operator === "Self-test");
      check("correction is keyed by (l2Id, l3Id)", stored.length === 1 && stored[0]?.l2Id === cards[0]?.l2);
    } else {
      check("a card with data exists for the sibling check", false);
    }

    // chip totals = sum of the cards of that L2; Semua = all cards
    const t2 = rejectStore.getL2Totals(PLANT, L, shiftKey, mc);
    const sumCards = (l2?: L2Id) =>
      rejectConfigStore.getCards(PLANT, L, mc).filter((c) => !l2 || c.l2 === l2).reduce((x, c) => x + (t2.byL3[c.l3Id] ?? 0), 0);
    check("chip total of an L2 = sum of its cards; Semua = all cards", L2S.every((k) => t2.byL2[k] === sumCards(k)) && t2.total === sumCards());
    rejectConfigStore._resetForTest();
    configTouched = false;

    // ---- migration ---------------------------------------------------------------------------
    const sealRm = migrateSlot({ slotNo: 1, l2Id: "RM", l3Id: "reject-seal" });
    check("legacy slot with explicit L2 keeps it; L3 becomes the entry under that L2", sealRm.l2Id === "RM" && sealRm.l3Id === "rm.reject-seal");
    const noL2Single = migrateSlot({ slotNo: 1, l2Id: null, l3Id: "reject-leak" });
    check("legacy slot without L2 takes the L2 of its single binding", noL2Single.l2Id === "RM" && noL2Single.l3Id === "rm.reject-leak");
    const noL2Multi = migrateSlot({ slotNo: 1, l2Id: null, l3Id: "reject-seal" });
    check("ambiguous legacy slot becomes Unassigned", noL2Multi.l2Id === null && noL2Multi.l3Id === null);
    check("migrated ids are stable (idempotent)", migrateL3("rs.reject-seal", "RS")?.id === "rs.reject-seal");
    check("history keeps its explicit L2", migrateL3("baret", "RS")?.id === "rs.baret");

    // ---- sensor input per card / history frozen -------------------------------------------------
    const before = JSON.stringify(rejectStore.getAllLogs(PLANT, L, pastKey).map((l) => [l.id, l.l2Id, l.qty]));
    configTouched = true;
    rejectConfigStore.saveSlots(PLANT, L, mc, [{ slotNo: 1, l2Id: "RP", l3Id: entryId("RP", "baret") }]);
    const after = JSON.stringify(rejectStore.getAllLogs(PLANT, L, pastKey).map((l) => [l.id, l.l2Id, l.qty]));
    check("historical (closed shift) entries do not change when the configuration changes", before === after);
    rejectConfigStore._resetForTest();
    configTouched = false;

    // ---- chips, cards and KPIs agree everywhere -------------------------------------------------
    const owner = new Map<string, string>();
    for (const l of J2_LINES_CONFIG) for (const mm of l.machines) if (mm.code && !owner.has(mm.code)) owner.set(mm.code, l.code);
    let metricsSkipped = 0;
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
        const tt = rejectStore.getL2Totals(PLANT, line, shiftKey, m);
        const totalReject = rejectStore.getTotals(PLANT, line, shiftKey, m).totalReject;
        if (tt.byL2.RM + tt.byL2.RP + tt.byL2.RS !== tt.total || tt.total + tt.inactiveTotal !== totalReject) chipsOk = false;
        if (Object.values(tt.byL3).reduce((x, v) => x + v, 0) !== tt.total) cardsOk = false;
        for (const c of rejectConfigStore.getCards(PLANT, line, m)) {
          const series = rejectStore.getHourlySeries(PLANT, line, shiftKey, c.l3Id, m);
          if (series.current.reduce((x, v) => x + v, 0) !== (tt.byL3[c.l3Id] ?? 0)) cardsOk = false;
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
    check("card totals add up (sum of cards = Semua; card = hourly Current)", cardsOk);
    check(
      "KPI parity: Reason/OEE strip, SL/SH Machine Output and metrics use the same total",
      kpiOk,
      kpiDetail || `metrics-engine skipped on ${metricsSkipped} non-owner duplicate machine code(s)`,
    );
  } finally {
    if (correctionsTouched) rejectStore._purgeByOperator("Self-test");
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
