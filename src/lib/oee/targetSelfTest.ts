/**
 * Self-test for CR 5 (target output / GAP). `runTargetSelfTest()` is also run by `runOeeSelfTest()`.
 * Uses the worked examples of the CR document plus the multi-SKU demo scenario.
 */
import { buildMultiSkuScenario, type PoSegment, type ShiftPoPlan } from "./poMaster";
import { computeShiftInfo, formatTimeWib } from "./shiftClock";
import {
  computeHourly,
  computeTargets,
  formatGapMin,
  formatGapPcs,
  lastFullHour,
  type TargetWindow,
} from "./targetEngine";
import { getTargetSnapshot } from "./targetService";

type Check = { name: string; passed: boolean; detail?: string };

const seg = (over: Partial<PoSegment> & Pick<PoSegment, "key" | "startSec" | "stopSec">): PoSegment => ({
  skuLabel: over.key,
  poNumber: over.key,
  skuName: over.key,
  mpq: 1_000_000,
  srr: 30,
  carryActual: 0,
  ...over,
});

const plan = (segments: PoSegment[], extra?: Partial<ShiftPoPlan>): ShiftPoPlan => ({
  shiftKey: "test",
  scenario: "default",
  segments,
  plannedBreaks: [],
  srrLine: null,
  ...extra,
});

/** `minutes` of windows from `fromSec`, `total` pcs spread evenly. */
function windowsFor(fromSec: number, minutes: number, total: number, pd = false): TargetWindow[] {
  const n = minutes * 2;
  return Array.from({ length: n }, (_, i) => ({ startSec: fromSec + i * 30, output: total / n, pd }));
}

export function runTargetSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });

  // ---- A. one SKU (document section 3.6 A) -------------------------------------------------------
  {
    const p = plan([seg({ key: "po", startSec: 0, stopSec: 28800, srr: 30 })]);
    const r = computeTargets({ plan: p, windows: windowsFor(0, 10, 210), mode: "SKU", srrLine: null, nowSec: 600 });
    check(
      "new PO, SRR 30, 10 min, actual 210 -> target 300, gap -90, -3 min",
      r.po.target === 300 && r.po.actual === 210 && r.po.gap === -90 && r.po.gapMin === -3,
      `${r.po.target} / ${r.po.actual} / ${r.po.gap} / ${r.po.gapMin}`,
    );
    check("GAP texts: -90 pcs and -3 min", formatGapPcs(r.po.gap) === "-90" && formatGapMin(r.po.gapMin ?? 0) === "-3");

    const c = plan([seg({ key: "po", startSec: 0, stopSec: 28800, srr: 30, carryActual: 5000 })]);
    const rc = computeTargets({ plan: c, windows: windowsFor(0, 10, 210), mode: "SKU", srrLine: null, nowSec: 600 });
    check(
      "continued PO S=5000 -> target 5300, actual 5210, gap -90, -3 min",
      rc.po.target === 5300 && rc.po.actual === 5210 && rc.po.gap === -90 && rc.po.gapMin === -3,
      `${rc.po.target} / ${rc.po.actual} / ${rc.po.gap}`,
    );

    const up = computeTargets({ plan: p, windows: windowsFor(0, 30, 1000), mode: "SKU", srrLine: null, nowSec: 1800 });
    check(
      "above target: SRR 30, 30 min, actual 1000 -> 900, +100, +3.3 min",
      up.po.target === 900 && up.po.gap === 100 && formatGapMin(up.po.gapMin ?? 0) === "+3.3",
      `${up.po.target} / ${up.po.gap} / ${formatGapMin(up.po.gapMin ?? 0)}`,
    );
    check("GAP OUTPUT zero reads 'Sesuai target', plus/minus signed", formatGapPcs(0) === "Sesuai target" && formatGapPcs(100) === "+100" && formatGapPcs(-90) === "-90");

    const cap = plan([seg({ key: "po", startSec: 0, stopSec: 28800, srr: 30, mpq: 2000 })]);
    const rcap = computeTargets({ plan: cap, windows: windowsFor(0, 100, 100), mode: "SKU", srrLine: null, nowSec: 6000 });
    check("PO target is capped by MPQ: min(MPQ, S + SRR x minutes)", rcap.po.target === 2000, `${rcap.po.target}`);

    const none = computeTargets({ plan: p, windows: [], mode: "SKU", srrLine: null, nowSec: 0 });
    check(
      "before any running time target = starting point and both scorecards are 0",
      none.po.target === 0 && none.po.gap === 0 && none.shift.target === 0 && none.shift.gap === 0,
    );
    const noneCarry = computeTargets({ plan: c, windows: [], mode: "SKU", srrLine: null, nowSec: 0 });
    check("continued PO before running time: target = S, gap 0", noneCarry.po.target === 5000 && noneCarry.po.gap === 0);
  }

  // ---- B. three-SKU shift at 10:30 (document section 3.6 B, SRR SKU) ---------------------------------------
  {
    const p = plan([
      seg({ key: "SKU 1", skuLabel: "SKU 1", startSec: 0, stopSec: 10800, srr: 10 }),
      seg({ key: "SKU 2", skuLabel: "SKU 2", startSec: 10800, stopSec: 21600, srr: 12 }),
      seg({ key: "SKU 3", skuLabel: "SKU 3", startSec: 21600, stopSec: 28800, srr: 14 }),
    ]);
    const w = [...windowsFor(0, 180, 1650), ...windowsFor(10800, 30, 330)];
    const r = computeTargets({ plan: p, windows: w, mode: "SKU", srrLine: 12, nowSec: 12600 });
    const s1 = r.segments[0];
    const s2 = r.segments[1];
    check(
      "SKU 1: 180 min, target 1800, actual 1650, gap -150, -15 min",
      !!s1 && s1.scheduledMin === 180 && s1.target === 1800 && s1.actual === 1650 && s1.gap === -150 && s1.gapMin === -15,
    );
    check(
      "SKU 2: 30 min, target 360, actual 330, gap -30, -2.5 min",
      !!s2 && s2.scheduledMin === 30 && s2.target === 360 && s2.actual === 330 && s2.gap === -30 && s2.gapMin === -2.5,
    );
    check(
      "shift total: 2160 / 1980 / -180 / -17.5 min",
      r.shift.target === 2160 && r.shift.actual === 1980 && r.shift.gap === -180 && r.shift.gapMin === -17.5,
      `${r.shift.target} / ${r.shift.actual} / ${r.shift.gap} / ${r.shift.gapMin}`,
    );
    check(
      "GAP WAKTU is per segment, not one SRR for the whole shift (SR-08)",
      r.shift.gapMin !== -180 / 10 && r.shift.gapMin !== -180 / 12 && r.shift.gapMin === -17.5,
    );
    const line = computeTargets({ plan: p, windows: w, mode: "LINE", srrLine: 12, nowSec: 12600 });
    check(
      "SR-03: switching SRR Line / SRR SKU changes the target only, never the actual",
      line.shift.actual === r.shift.actual && line.shift.target !== r.shift.target && line.po.actual === r.po.actual,
      `actual ${r.shift.actual} vs ${line.shift.actual}; target ${r.shift.target} vs ${line.shift.target}`,
    );
  }

  // ---- C. multi-SKU demo scenario (06:30-14:30) ---------------------------------------------------------------
  {
    const shift = computeShiftInfo(new Date(Date.UTC(2026, 10, 8, 10, 0) - 7 * 3600000), 390);
    const sc = buildMultiSkuScenario(shift);
    const eff = 0.9;
    const mk = (nowSec: number): TargetWindow[] => {
      const out: TargetWindow[] = [];
      for (let t = 0; t < nowSec; t += 30) {
        const m = t + 15;
        const sg = sc.segments.find((s) => m >= s.startSec && m < s.stopSec);
        const brk = sc.plannedBreaks.some((b) => m >= b.startSec && m < b.endSec);
        out.push({ startSec: t, output: sg && !brk ? (sg.srr ?? 0) * eff * 0.5 : 0, pd: brk });
      }
      return out;
    };
    check(
      "scenario matches the mockup: 3 SKUs 10/12/14 ppm, break 12:00-12:30, SRR Line 14",
      sc.segments.map((s) => s.srr).join() === "10,12,14" && sc.srrLine === 14 && sc.plannedBreaks.length === 1,
    );
    const at1030 = computeTargets({ plan: sc, windows: mk(14400), mode: "SKU", srrLine: 14, nowSec: 14400 });
    check(
      "10:30: SKU 1 target 1800 (180 min), SKU 2 target 540 (45 min), total 2340",
      at1030.segments[0]?.target === 1800 && at1030.segments[1]?.target === 540 && at1030.shift.target === 2340,
      `${at1030.segments.map((s) => s.target).join("+")} = ${at1030.shift.target}`,
    );
    check(
      "changeover 09:30-09:45 is Unscheduled: 225 scheduled min, no target for the 15 min",
      at1030.shift.scheduledMin === 225,
      `${at1030.shift.scheduledMin} min`,
    );
    const line1030 = computeTargets({ plan: sc, windows: mk(14400), mode: "LINE", srrLine: 14, nowSec: 14400 });
    check(
      "SRR Line 14 ppm: 14 x 225 = 3150, changeover still excluded",
      line1030.shift.target === 3150 && line1030.shift.actual === at1030.shift.actual,
    );
    check(
      "projected shift denominator (SKU, SKU 2 running) = 2340 + 12 x 210 remaining scheduled min = 4860",
      at1030.shift.projected === 4860 && at1030.shift.remainingScheduledMin === 210 && at1030.shift.runningSrr === 12,
      `${at1030.shift.projected} (${at1030.shift.remainingScheduledMin} min, SRR ${at1030.shift.runningSrr})`,
    );
    const before = computeTargets({ plan: sc, windows: mk(22440), mode: "SKU", srrLine: 14, nowSec: 22440 }); // 12:44
    const after = computeTargets({ plan: sc, windows: mk(22560), mode: "SKU", srrLine: 14, nowSec: 22560 }); // 12:46
    check(
      "projection is recomputed at the SKU 2 -> SKU 3 changeover (running SRR 12 -> 14)",
      before.shift.runningSrr === 12 && after.shift.runningSrr === 14 && before.shift.projected !== after.shift.projected,
      `${before.shift.projected} (12) -> ${after.shift.projected} (14)`,
    );
    const at13 = computeTargets({ plan: sc, windows: mk(23400), mode: "SKU", srrLine: 14, nowSec: 23400 }); // 13:00
    check(
      "break 12:00-12:30 is excluded: SKU 2 has 150 scheduled min, target 1800",
      at13.segments[1]?.scheduledMin === 150 && at13.segments[1]?.target === 1800,
      `${at13.segments[1]?.scheduledMin} min, ${at13.segments[1]?.target}`,
    );
    check(
      "13:00 projection = target so far 3810 + 14 x 90 = 5070",
      at13.shift.target === 3810 && at13.shift.projected === 5070,
      `${at13.shift.target} -> ${at13.shift.projected}`,
    );
  }

  // ---- D. No standard (TG-09) --------------------------------------------------------------------------------
  {
    const p = plan([seg({ key: "po", startSec: 0, stopSec: 28800, srr: null })]);
    const sku = computeTargets({ plan: p, windows: windowsFor(0, 10, 100), mode: "SKU", srrLine: 30, nowSec: 600 });
    check("SRR SKU missing -> No standard (PO and shift)", sku.po.noStandard && sku.shift.noStandard && sku.shift.gapMin === null);
    const p2 = plan([seg({ key: "po", startSec: 0, stopSec: 28800, srr: 30 })]);
    const line = computeTargets({ plan: p2, windows: windowsFor(0, 10, 100), mode: "LINE", srrLine: null, nowSec: 600 });
    check("SRR Line missing -> No standard", line.po.noStandard && line.shift.noStandard);
  }

  // ---- E. shift lookup: standard shifts unchanged, :30 start works (SR / config override) ------------------------
  {
    const W = (d: number, h: number, m: number) => new Date(Date.UTC(2026, 10, d, h, m) - 7 * 3600000);
    const f = (d: number, h: number, m: number, start = 420) => {
      const s = computeShiftInfo(W(d, h, m), start);
      return `${s.shiftKey} ${formatTimeWib(s.startSec)}-${formatTimeWib(s.endSec)}`;
    };
    check(
      "standard shifts unchanged (07:00 / 15:00 / 23:00, cross-midnight C)",
      f(8, 10, 0) === "2026-11-08:A 07:00-15:00" &&
        f(8, 15, 0) === "2026-11-08:B 15:00-23:00" &&
        f(8, 23, 30) === "2026-11-08:C 23:00-07:00" &&
        f(9, 0, 40) === "2026-11-08:C 23:00-07:00" &&
        f(9, 7, 0) === "2026-11-09:A 07:00-15:00",
      [f(8, 10, 0), f(8, 15, 0), f(8, 23, 30), f(9, 0, 40), f(9, 7, 0)].join(" | "),
    );
    check(
      ":30 override: 06:30-14:30, 14:30-22:30, 22:30-06:30",
      f(8, 10, 30, 390) === "2026-11-08:A 06:30-14:30" &&
        f(8, 14, 30, 390) === "2026-11-08:B 14:30-22:30" &&
        f(8, 22, 30, 390) === "2026-11-08:C 22:30-06:30" &&
        f(9, 6, 29, 390) === "2026-11-08:C 22:30-06:30" &&
        f(9, 6, 30, 390) === "2026-11-09:A 06:30-14:30",
      [f(8, 10, 30, 390), f(8, 14, 30, 390), f(8, 22, 30, 390), f(9, 6, 29, 390)].join(" | "),
    );
  }

  // ---- G. hourly realisation page (CR 5 part B) ----------------------------------------------------------------
  {
    const shift = computeShiftInfo(new Date(Date.UTC(2026, 10, 8, 10, 0) - 7 * 3600000), 390);
    const sc = buildMultiSkuScenario(shift);
    const mkScenario = (nowSec: number): TargetWindow[] => {
      const out: TargetWindow[] = [];
      for (let t = 0; t < nowSec; t += 30) {
        const m = t + 15;
        const sg = sc.segments.find((x) => m >= x.startSec && m < x.stopSec);
        const brk = sc.plannedBreaks.some((b) => m >= b.startSec && m < b.endSec);
        out.push({ startSec: t, output: sg && !brk ? (sg.srr ?? 0) * 0.9 * 0.5 : 0, pd: brk });
      }
      return out;
    };
    const hourly = (nowSec: number, mode: "LINE" | "SKU" = "SKU") =>
      computeHourly({ plan: sc, windows: mkScenario(nowSec), mode, srrLine: 14, nowSec, startMinute: 30 });
    const label = (r: { startSec: number; endSec: number }) =>
      `${formatTimeWib(shift.startSec + r.startSec)}-${formatTimeWib(shift.startSec + r.endSec)}`;

    const full = hourly(28800);
    check(
      "one row per calendar hour of the 06:30 shift, partial first and last hour",
      full.length === 9 &&
        label(full[0]!) === "06:30-07:00" &&
        label(full[8]!) === "14:00-14:30" &&
        full[0]!.partial &&
        full[8]!.partial &&
        full.slice(1, 8).every((r) => !r.partial),
      full.map(label).join(" "),
    );
    check(
      "hour targets: partial 06:30-07:00 = 300 (proportional), full SKU 1 hour 600, SKU 2 hour 720, SKU 3 hour 840",
      full[0]!.target === 300 && full[1]!.target === 600 && full[4]!.target === 720 && full[7]!.target === 840,
      full.map((r) => r.target).join(","),
    );
    check(
      "09:00-10:00 changeover hour sums per segment: 30 x 10 + 15 x 12 = 480 (15 min changeover excluded), label SKU 1 > SKU 2",
      full[3]!.target === 480 && full[3]!.segments.map((x) => x.skuLabel).join(" > ") === "SKU 1 > SKU 2",
      `${full[3]!.target} ${full[3]!.segments.map((x) => x.skuLabel).join(" > ")}`,
    );
    check(
      "12:00-13:00 excludes the 12:00-12:30 break: SKU 2 15 x 12 + SKU 3 15 x 14 = 390",
      full[6]!.target === 390,
      `${full[6]!.target}`,
    );
    check("last partial hour 14:00-14:30 = 30 x 14 = 420", full[8]!.target === 420);

    // document example RH-03: a changeover at 09:30 without a gap -> 30 x 10 + 30 x 12 = 660
    const docPlan = plan([
      seg({ key: "SKU 1", skuLabel: "SKU 1", startSec: 0, stopSec: 9000, srr: 10 }),
      seg({ key: "SKU 2", skuLabel: "SKU 2", startSec: 9000, stopSec: 28800, srr: 12 }),
    ]);
    const docWin: TargetWindow[] = windowsFor(0, 4 * 60, 0);
    const docRows = computeHourly({ plan: docPlan, windows: docWin, mode: "SKU", srrLine: null, nowSec: 14400, startMinute: 0 });
    const docHour = docRows[2]; // 09:00-10:00 of a 07:00 shift
    check(
      "document example: SKU 1 -> SKU 2 at 09:30 gives 30 x 10 + 30 x 12 = 660, shown 'SKU 1 > SKU 2'",
      docHour?.target === 660 && docHour.segments.map((x) => x.skuLabel).join(" > ") === "SKU 1 > SKU 2",
      `${docHour?.target}`,
    );

    // cumulative gap = shift GAP OUTPUT at the end of each hour (RH-05)
    const at = hourly(28800);
    let okCum = true;
    let okSum = true;
    let running = 0;
    const detail: string[] = [];
    for (const r of at) {
      if (r.status !== "done") continue;
      const win = mkScenario(r.endSec);
      const shiftGap = computeTargets({ plan: sc, windows: win, mode: "SKU", srrLine: 14, nowSec: r.endSec }).shift.gap;
      if (r.cumGap !== shiftGap) okCum = false;
      running += r.gap ?? 0;
      if (running !== r.cumGap) okSum = false;
      detail.push(`${r.cumGap}`);
    }
    check("cumulative gap equals the shift GAP OUTPUT at the end of every hour", okCum, detail.join(","));
    check("cumulative gap is the running sum of the per-hour gaps", okSum);
    check(
      "cumulative minutes are the sum of the per-hour minute gaps (multi-SKU, SR-08)",
      (() => {
        const done = at.filter((r) => r.status === "done");
        const sum = done.reduce((a, r) => a + (r.gapMin ?? 0), 0);
        return Math.abs((done[done.length - 1]?.cumGapMin ?? 0) - sum) < 1e-9;
      })(),
    );

    // 10:08 = 3 h 38 min after 06:30
    const t1008 = 13080;
    const r1008 = hourly(t1008);
    const running1008 = r1008.find((r) => r.status === "cur");
    check(
      "10:08: the running hour 10:00-11:00 shows the full target, actual so far, and no gap yet (RH-06)",
      !!running1008 &&
        label(running1008) === "10:00-11:00" &&
        running1008.target === 720 &&
        (running1008.actual ?? 0) > 0 &&
        running1008.gap === null &&
        running1008.cumGap === null,
      `${running1008 ? label(running1008) : "none"} target ${running1008?.target} actual ${running1008?.actual}`,
    );
    check(
      "10:08: future hours are empty (actual null, no gap)",
      r1008.filter((r) => r.status === "fut").every((r) => r.actual === null && r.gap === null && r.cumGap === null),
    );
    const lf = lastFullHour(r1008);
    check("10:08: 'last hour' is 09:00-10:00 (RH-09)", !!lf && label(lf) === "09:00-10:00", lf ? label(lf) : "none");
    check(
      "before the first full hour (07:05, only the partial 06:30-07:00 is done) there is no last hour (RH-13)",
      lastFullHour(hourly(2100)) === null,
    );
    const lf0805 = lastFullHour(hourly(5700));
    check("08:05: last hour is 07:00-08:00", !!lf0805 && label(lf0805) === "07:00-08:00");

    // SRR switch: standards, targets and gaps change, never the actuals (SR-03)
    const skuRows = hourly(28800, "SKU");
    const lineRows = hourly(28800, "LINE");
    check(
      "SRR Line vs SRR SKU on the hourly rows: same actuals, different targets and gaps",
      skuRows.every((r, i) => r.actual === lineRows[i]!.actual) &&
        skuRows.some((r, i) => r.target !== lineRows[i]!.target) &&
        lineRows[1]!.target === 14 * 60 &&
        lineRows.some((r, i) => r.gap !== skuRows[i]!.gap),
      `SKU ${skuRows.map((r) => r.target).join(",")} | Line ${lineRows.map((r) => r.target).join(",")}`,
    );

    // no standard on the hourly rows
    const noStd = computeHourly({
      plan: plan([seg({ key: "po", startSec: 0, stopSec: 28800, srr: null })]),
      windows: windowsFor(0, 60, 100),
      mode: "SKU",
      srrLine: 30,
      nowSec: 3600,
      startMinute: 0,
    });
    check("hourly: missing SRR gives No standard (no target, no gap)", noStd[0]?.noStandard === true && noStd[0]?.gap === null);
  }

  // ---- F. real line data: the SRR switch changes the standard only (SR-03) ---------------------------------
  {
    const at = new Date(Date.UTC(2026, 10, 8, 12, 0) - 7 * 3600000).getTime(); // 12:00 WIB, 5 h into shift A
    // some mock lines are "down" for the whole shift (zero output); use the first one that produces
    const lineId = ["TUP01", "TUP13", "TUP14", "BOP15", "BOP16"].find(
      (l) => getTargetSnapshot("J2", l, "LINE", at).grossOutput > 0,
    ) ?? "TUP01";
    const line = getTargetSnapshot("J2", lineId, "LINE", at);
    const sku = getTargetSnapshot("J2", lineId, "SKU", at);
    check(
      "line snapshot: actual output identical with SRR Line and SRR SKU",
      line.grossOutput > 0 && line.grossOutput === sku.grossOutput && line.result.shift.actual === sku.result.shift.actual,
      `gross ${line.grossOutput} vs ${sku.grossOutput}`,
    );
    const sched = line.result.shift.scheduledMin;
    check(
      "line snapshot: target = standard x scheduled minutes (Line vs SKU differ only by the standard)",
      sched > 0 &&
        sched <= 300 &&
        line.result.shift.target === Math.round((line.srrLine ?? 0) * sched) &&
        sku.result.shift.target === Math.round((sku.result.segments[0]?.skuSrr ?? 0) * sched),
      `scheduled ${sched} min; Line ${line.result.shift.target} (SRR ${line.srrLine}), SKU ${sku.result.shift.target}`,
    );
    check("line snapshot: bar denominator (projected) is at least the target so far", line.result.shift.projected >= line.result.shift.target);
  }

  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") {
    console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
    console.info("[CR5] Target Self-Test Passed:", passed);
  }
  return { passed, results };
}

declare global {
  interface Window {
    runTargetSelfTest?: typeof runTargetSelfTest;
  }
}

if (typeof window !== "undefined") {
  window.runTargetSelfTest = runTargetSelfTest;
}
