/**
 * Self-test for CR 3 (Summarization Kemas + reconcile prefill). Run `runSummarizationSelfTest()` in
 * the browser console. Uses a dedicated test PO/line key and removes it afterwards.
 */
import { getPoBom, validateQty } from "./summarizationMock";
import { emptyData, resumeRow, summarizationStore, validateData, type SumData } from "./summarizationStore";

type Check = { name: string; passed: boolean; detail?: string };
const LINE = "ST-LINE";
const PO = "ST-PO-1";

export function runSummarizationSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const ok = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail ? { detail } : {}) });
  const ctx = { plantId: "J2", lineId: LINE, poNumber: PO, user: "Self-test" };
  summarizationStore.clear(LINE, PO);
  try {
    const bom = getPoBom(PO);
    ok("BOM deterministic", JSON.stringify(bom) === JSON.stringify(getPoBom(PO)) && bom.length >= 4);
    ok("validate: negative rejected", validateQty(-1, "PC") !== null);
    ok("validate: decimal rejected for PC", validateQty(1.5, "PC") !== null);
    ok("validate: decimal allowed for ROLL", validateQty(1.5, "ROLL") === null);

    ok("no summarization -> empty prefill (SM-14)", Object.keys(summarizationStore.prefill(summarizationStore.get(LINE, PO))).length === 0);

    const data: SumData = emptyData(bom);
    const a = bom[0]!.code;
    data[a]!.sample = [2, 1, 0, 3];
    data[a]!.pack = [1, 2, 3];
    data[a]!.bulk = [1, 1, 1, 1];
    ok("draft autosave", summarizationStore.saveDraft(ctx, data, "only").ok && summarizationStore.get(LINE, PO)?.status === "draft");
    ok("draft not used for prefill", Object.keys(summarizationStore.prefill(summarizationStore.get(LINE, PO))).length === 0);

    const bad = JSON.parse(JSON.stringify(data)) as SumData;
    bad[a]!.sample[0] = -3;
    ok("invalid values block save", !summarizationStore.save(ctx, bad, "only").ok && validateData(bad, bom).length > 0);

    ok("save ok", summarizationStore.save(ctx, data, "only").ok);
    const r1 = summarizationStore.get(LINE, PO)!;
    ok("status saved + audit", r1.status === "saved" && r1.audit.length === 1 && r1.snapshots.length === 1);
    const row = resumeRow(data[a]!);
    ok("resume totals", row.packOnly === 6 && row.bulk === 4 && row.qc === 2);
    const pf = summarizationStore.prefill(r1);
    ok("prefill = latest saved, no Return (SM-11/12)", pf[a]?.qc === 2 && pf[a]?.packOnly === 6 && pf[a]?.return === undefined);

    // Later update on same record
    data[a]!.sample[0] = 9;
    summarizationStore.save(ctx, data, "bulk");
    const r2 = summarizationStore.get(LINE, PO)!;
    ok("same record updated, snapshot appended", r2.snapshots.length === 2 && r2.id === r1.id);
    ok("prefill follows latest", summarizationStore.prefill(r2)[a]?.qc === 9);

    summarizationStore.confirmReconcile(ctx, pf);
    const r3 = summarizationStore.get(LINE, PO)!;
    ok("confirm reconcile locks summarization (SM-15)", r3.status === "locked");
    ok("locked refuses draft and save", !summarizationStore.saveDraft(ctx, data, "only").ok && !summarizationStore.save(ctx, data, "only").ok);
  } finally {
    summarizationStore.clear(LINE, PO);
  }
  return { passed: results.every((r) => r.passed), results };
}

declare global {
  interface Window {
    runSummarizationSelfTest?: typeof runSummarizationSelfTest;
  }
}
if (typeof window !== "undefined") window.runSummarizationSelfTest = runSummarizationSelfTest;
