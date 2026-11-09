/**
 * Dev self-test for CR 4 (shift change tagging reminder). Run `runReminderSelfTest()` in the
 * browser console. It uses a fixed reference date, purges what it writes, and does not touch the
 * demo clock in the browser (the demo jump itself is only exercised under Node).
 */
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { countUncommentedByType, getShiftTimeline, operatorCauseKey } from "./machineEvents";
import { reasonTagStore } from "./reasonTagStore";
import {
  formatDateWib,
  formatTimeWib,
  getDemoClockOffsetMs,
  getNowMs,
  getShiftInfo,
  jumpToShiftEnd,
  setDemoClockOffsetMs,
  SHIFT_SECONDS,
  type ShiftInfo,
} from "./shiftClock";
import {
  _purgeReminderLog,
  dueTriggers,
  getLineMachineCodes,
  getReminderCounts,
  handledMinutes,
  logAction,
  logShown,
  logSuperseded,
  readReminderLog,
  reminderShiftAt,
  selectTriggerToShow,
  triggerTimeMs,
  urgencyOf,
} from "./shiftReminder";

type Check = { name: string; passed: boolean; detail?: string };

const WIB = 7 * 3600000;
const wib = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(Date.UTC(y, mo - 1, d, h, mi) - WIB);

export function runReminderSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });
  const triggerLabels = (s: ShiftInfo) =>
    [60, 30, 20, 10, 0].map((m) => formatTimeWib(triggerTimeMs(s, m))).join(",");
  const touchedKeys: string[] = [];
  const LINE = "SELFTEST-LINE";

  try {
    // ---- trigger times, incl. cross-midnight (RM-01) ---------------------------------------
    const shiftC = getShiftInfo(wib(2026, 11, 1, 0, 40)); // 23:00 (7 Nov) - 07:00 (8 Nov)
    check(
      "cross-midnight shift 23:00-07:00 identified",
      shiftC.code === "C" &&
        formatTimeWib(shiftC.startSec) === "23:00" &&
        formatTimeWib(shiftC.endSec) === "07:00" &&
        formatDateWib(shiftC.endSec) !== formatDateWib(shiftC.startSec),
      `${formatDateWib(shiftC.startSec)} ${formatTimeWib(shiftC.startSec)} -> ${formatDateWib(shiftC.endSec)} ${formatTimeWib(shiftC.endSec)}`,
    );
    check(
      "cross-midnight triggers at 06:00, 06:30, 06:40, 06:50, 07:00",
      triggerLabels(shiftC) === "06:00,06:30,06:40,06:50,07:00",
      triggerLabels(shiftC),
    );
    const shiftA = getShiftInfo(wib(2026, 11, 1, 10, 0));
    check("day shift triggers 14:00..15:00", triggerLabels(shiftA) === "14:00,14:30,14:40,14:50,15:00", triggerLabels(shiftA));
    const shiftB = getShiftInfo(wib(2026, 11, 1, 16, 0));
    check("evening shift triggers 22:00..23:00", triggerLabels(shiftB) === "22:00,22:30,22:40,22:50,23:00", triggerLabels(shiftB));
    // a 23:00-09:30 shift (CR example) from its full end datetime
    const custom = { ...shiftC, endSec: Math.floor(wib(2026, 11, 1, 9, 30).getTime() / 1000) };
    check(
      "23:00-09:30 shift triggers at 08:30, 09:00, 09:10, 09:20, 09:30",
      triggerLabels(custom) === "08:30,09:00,09:10,09:20,09:30",
      triggerLabels(custom),
    );

    // ---- which triggers are due ---------------------------------------------------------------
    const endMs = shiftC.endSec * 1000;
    const min = 60000;
    check("nothing due before T-60", dueTriggers(shiftC, endMs - 61 * min).length === 0);
    check("T-60 due exactly at T-60", dueTriggers(shiftC, endMs - 60 * min).join() === "60");
    check("T-25: 60 and 30 due", dueTriggers(shiftC, endMs - 25 * min).join() === "60,30");
    check("T-0: all five due", dueTriggers(shiftC, endMs).join() === "60,30,20,10,0");
    check("T-0 still due 4 min after the end (grace)", dueTriggers(shiftC, endMs + 4 * min).join() === "60,30,20,10,0");
    check("nothing due once the grace has passed", dueTriggers(shiftC, endMs + 5 * min).length === 0);
    check("watched shift at T-0 is still the ending shift", reminderShiftAt(endMs).shiftKey === shiftC.shiftKey);
    check("watched shift after grace is the next shift", reminderShiftAt(endMs + 5 * min).shiftKey !== shiftC.shiftKey);

    // ---- once per trigger / missed trigger (RM-06) -----------------------------------------------
    check("latest unhandled trigger is shown, older ones superseded", (() => {
      const r = selectTriggerToShow([60, 30, 20], new Set([60]));
      return r.show === 20 && r.superseded.join() === "30";
    })());
    check("handled triggers are never shown again", selectTriggerToShow([60, 30], new Set([60, 30])).show === null);
    check("no due trigger -> nothing", selectTriggerToShow([], new Set()).show === null);
    check(
      "urgency: T-60/30 info, T-20 warning, T-10/0 critical",
      [60, 30, 20, 10, 0].map(urgencyOf).join() === "info,info,warning,critical,critical",
    );

    // ---- counts = Reason chips, summed over the line (RM-02/RM-03) ------------------------------
    const plantId = "J2";
    const lineId = J2_LINES_CONFIG[0]?.code ?? "TUP01";
    const nowMs = endMs - 10 * min;
    const counts = getReminderCounts(plantId, lineId, shiftC, nowMs);
    const revealSec = Math.min(SHIFT_SECONDS, nowMs / 1000 - shiftC.startSec);
    let expected = 0;
    const perType = { downtime: 0, minor_stop: 0, speed_loss: 0, negative_speed_loss: 0 };
    const codes = getLineMachineCodes(plantId, lineId);
    for (const c of codes) {
      const tl = getShiftTimeline(c, { ...shiftC, elapsedSec: revealSec }, revealSec, plantId);
      const k = countUncommentedByType(tl.events);
      perType.downtime += k.downtime;
      perType.minor_stop += k.minor_stop;
      perType.speed_loss += k.speed_loss;
      perType.negative_speed_loss += k.negative_speed_loss;
      expected += k.downtime + k.minor_stop + k.speed_loss + k.negative_speed_loss;
    }
    check("line has machines in scope", codes.length > 0, codes.join(","));
    check(
      "reminder counts equal the Reason chip counts summed over the line",
      counts.total === expected &&
        counts.byType.downtime === perType.downtime &&
        counts.byType.minor_stop === perType.minor_stop &&
        counts.byType.speed_loss === perType.speed_loss &&
        counts.byType.negative_speed_loss === perType.negative_speed_loss,
      `total ${counts.total} vs ${expected}`,
    );
    check(
      "breakdown includes Negative Speed Loss and total is the sum of the four types",
      "negative_speed_loss" in counts.byType &&
        counts.total === Object.values(counts.byType).reduce((a, b) => a + b, 0),
    );
    check(
      "top machine is the one with the most Uncommented issues",
      counts.total === 0 ||
        (counts.topMachine !== null &&
          Object.values(counts.byMachine).every((n) => n <= (counts.byMachine[counts.topMachine as string] ?? 0))),
      `${counts.topMachine}`,
    );

    // all tagged -> nothing to show (RM-02)
    const toTag: { id: string; startSec: number; endSec: number }[] = [];
    for (const c of codes) {
      const tl = getShiftTimeline(c, { ...shiftC, elapsedSec: revealSec }, revealSec, plantId);
      for (const e of tl.events) {
        if (
          !e.isTagged &&
          (e.type === "downtime" || e.type === "minor_stop" || e.type === "speed_loss" || e.type === "negative_speed_loss")
        ) {
          const id = operatorCauseKey(shiftC.shiftKey, c, e.id);
          touchedKeys.push(id);
          toTag.push({ id, startSec: e.startSec, endSec: e.endSec });
        }
      }
    }
    const tpl = {
      l1Parent: "Minor Stop",
      l2CategoryId: "x",
      l2CategoryName: "x",
      l3ReasonId: "y",
      l3ReasonName: "y",
    };
    if (toTag.length > 0) {
      const r = reasonTagStore.saveGroup(toTag, tpl, reasonTagStore.getVersions(toTag.map((w) => w.id)));
      check("tagging every Uncommented window succeeds", r.ok);
    }
    const afterAll = getReminderCounts(plantId, lineId, shiftC, nowMs);
    check("all tagged -> total 0, so the pop-up would not show", afterAll.total === 0, `total ${afterAll.total}`);

    // ---- log (shift_reminder_log) --------------------------------------------------------------
    _purgeReminderLog(LINE);
    const logPrefix = shiftC.shiftKey;
    check("no handled triggers initially", handledMinutes(LINE, shiftC.shiftKey).size === 0);
    logShown(LINE, shiftC, 60, counts);
    logAction(LINE, shiftC.shiftKey, 60, "classify");
    logSuperseded(LINE, shiftC, [30], counts);
    const log = readReminderLog().filter((e) => e.line === LINE && e.shiftId === logPrefix);
    const e60 = log.find((e) => e.triggerMinute === 60);
    const e30 = log.find((e) => e.triggerMinute === 30);
    check(
      "log row has line, shift, trigger, user, shown_at, action and counts per type",
      !!e60 &&
        e60.line === LINE &&
        e60.shiftId === logPrefix &&
        e60.triggerMinute === 60 &&
        !!e60.user &&
        !!e60.shownAt &&
        e60.action === "classify" &&
        Object.keys(e60.counts).sort().join() === "downtime,minor_stop,negative_speed_loss,speed_loss",
    );
    check("superseded trigger is logged without shown_at", !!e30 && e30.shownAt === null && e30.action === "superseded");
    check("shown and superseded triggers count as handled", handledMinutes(LINE, logPrefix).has(60) && handledMinutes(LINE, logPrefix).has(30));
    logShown(LINE, shiftC, 20, counts);
    logAction(LINE, shiftC.shiftKey, 20, "close");
    check(
      "Close is logged as close",
      readReminderLog().find((e) => e.line === LINE && e.triggerMinute === 20)?.action === "close",
    );

    // ---- demo clock (Node only: avoids notifying a mounted reminder in the browser) --------------
    if (typeof window === "undefined") {
      const prev = getDemoClockOffsetMs();
      try {
        jumpToShiftEnd(60);
        const real = getShiftInfo(new Date(Date.now()));
        check(
          "demo jump to T-60 puts the clock 60 min before the running shift end",
          Math.abs(getNowMs() - (real.endSec * 1000 - 60 * min)) < 2000,
        );
        jumpToShiftEnd(0);
        check("demo jump to T-0 puts the clock at the shift end", Math.abs(getNowMs() - real.endSec * 1000) < 2000);
        setDemoClockOffsetMs(null);
        check("reset restores the real clock", Math.abs(getNowMs() - Date.now()) < 50 && getDemoClockOffsetMs() === 0);
      } finally {
        setDemoClockOffsetMs(prev || null);
      }
    } else {
      check("demo clock jump skipped in the browser (covered under Node)", true);
    }
  } finally {
    if (touchedKeys.length) reasonTagStore._purgeForTest(touchedKeys);
    _purgeReminderLog(LINE);
  }

  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") {
    console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
    console.info("[CR4] Reminder Self-Test Passed:", passed);
  }
  return { passed, results };
}

declare global {
  interface Window {
    runReminderSelfTest?: typeof runReminderSelfTest;
  }
}

if (typeof window !== "undefined") {
  window.runReminderSelfTest = runReminderSelfTest;
}
