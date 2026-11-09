/**
 * CR 4: tagging reminder before a shift change.
 * Pure helpers (trigger times, which trigger to show, counts) plus the persisted
 * `shift_reminder_log`. The UI lives in ShiftReminderHost.
 */
import {
  REMINDER_SCOPE,
  REMINDER_T0_GRACE_MIN,
  REMINDER_TRIGGER_MINUTES,
} from "./config";
import { getLine } from "./data";
import { countUncommentedByType, getShiftTimeline } from "./machineEvents";
import { getShiftInfo, SHIFT_SECONDS, type ShiftInfo } from "./shiftClock";
import type { ClassifiableType } from "./reasonConstants";

export type ReminderCounts = {
  total: number;
  byType: Record<ClassifiableType, number>;
  byMachine: Record<string, number>;
  /** Machine with the most Uncommented issues (preselected on the Reason tab). */
  topMachine: string | null;
};

export type ReminderUrgency = "info" | "warning" | "critical";

export type ReminderAction = "classify" | "close" | "superseded";

export type ReminderLogEntry = {
  line: string;
  shiftId: string;
  triggerMinute: number;
  user: string;
  shownAt: string | null; // null when superseded without being shown
  action: ReminderAction;
  counts: Record<ClassifiableType, number>;
};

export const REMINDER_USER = "Operator";
const LOG_KEY = "shift_reminder_log";
const memoryLog: ReminderLogEntry[] = [];

// ---- triggers ------------------------------------------------------------------------

/** Trigger time = full end datetime of the shift minus N minutes (cross-midnight safe). */
export function triggerTimeMs(shift: ShiftInfo, minute: number): number {
  return shift.endSec * 1000 - minute * 60000;
}

/**
 * Shift the reminder watches at `nowMs`: the shift whose [start, end + grace) contains it, so
 * the T-0 reminder can still be handled right after the shift rolled over.
 */
export function reminderShiftAt(nowMs: number): ShiftInfo {
  return getShiftInfo(new Date(nowMs - REMINDER_T0_GRACE_MIN * 60000));
}

/** Trigger minutes already reached for this shift, ordered T-60 .. T-0. */
export function dueTriggers(
  shift: ShiftInfo,
  nowMs: number,
  minutes: readonly number[] = REMINDER_TRIGGER_MINUTES,
): number[] {
  if (nowMs >= shift.endSec * 1000 + REMINDER_T0_GRACE_MIN * 60000) return [];
  return [...minutes]
    .sort((a, b) => b - a)
    .filter((m) => triggerTimeMs(shift, m) <= nowMs);
}

/**
 * RM-06: each trigger once. From the due triggers that were not handled yet, show only the
 * latest (smallest N); the older unhandled ones are superseded.
 */
export function selectTriggerToShow(
  due: number[],
  handled: Set<number>,
): { show: number | null; superseded: number[] } {
  const open = due.filter((m) => !handled.has(m));
  if (open.length === 0) return { show: null, superseded: [] };
  const show = open[open.length - 1] ?? null;
  return { show, superseded: open.slice(0, -1) };
}

export function urgencyOf(minute: number): ReminderUrgency {
  if (minute <= 10) return "critical";
  if (minute <= 20) return "warning";
  return "info";
}

// ---- counts ----------------------------------------------------------------------------

export function getLineMachineCodes(plantId: string, lineId: string): string[] {
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  return (line?.machines ?? []).map((m) => m.code || m.id);
}

/**
 * Uncommented windows per type, summed over the machines in scope. Uses the same timeline and
 * the same "not tagged" rule as the Reason chips (countUncommentedByType).
 */
export function getReminderCounts(
  plantId: string,
  lineId: string,
  shift: ShiftInfo,
  nowMs: number,
): ReminderCounts {
  const revealSec = Math.min(SHIFT_SECONDS, Math.max(0, nowMs / 1000 - shift.startSec));
  const codes = REMINDER_SCOPE === "line" ? getLineMachineCodes(plantId, lineId) : [];
  const byType: ReminderCounts["byType"] = {
    downtime: 0,
    minor_stop: 0,
    speed_loss: 0,
  };
  const byMachine: Record<string, number> = {};
  for (const code of codes) {
    const tl = getShiftTimeline(code, { ...shift, elapsedSec: revealSec }, revealSec, plantId);
    const c = countUncommentedByType(tl.events);
    byType.downtime += c.downtime;
    byType.minor_stop += c.minor_stop;
    byType.speed_loss += c.speed_loss;
    byMachine[code] = c.downtime + c.minor_stop + c.speed_loss;
  }
  const total = Object.values(byType).reduce((a, b) => a + b, 0);
  let topMachine: string | null = null;
  let best = 0;
  for (const [code, n] of Object.entries(byMachine)) {
    if (n > best) {
      best = n;
      topMachine = code;
    }
  }
  return { total, byType, byMachine, topMachine };
}

// ---- log (RM-06 data: shift_reminder_log) ------------------------------------------------

export function readReminderLog(): ReminderLogEntry[] {
  if (typeof window === "undefined") return memoryLog.slice();
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ReminderLogEntry[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fall through to memory
  }
  return memoryLog.slice();
}

function writeReminderLog(entries: ReminderLogEntry[]) {
  memoryLog.length = 0;
  memoryLog.push(...entries);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries));
  } catch {
    // ignore: memory copy keeps this page load consistent
  }
}

const same = (e: ReminderLogEntry, line: string, shiftId: string, minute: number, user: string) =>
  e.line === line && e.shiftId === shiftId && e.triggerMinute === minute && e.user === user;

/** Trigger minutes of this line/shift/user already shown or superseded. */
export function handledMinutes(line: string, shiftId: string, user = REMINDER_USER): Set<number> {
  return new Set(
    readReminderLog()
      .filter((e) => e.line === line && e.shiftId === shiftId && e.user === user)
      .map((e) => e.triggerMinute),
  );
}

export function logShown(
  line: string,
  shift: ShiftInfo,
  minute: number,
  counts: ReminderCounts,
  user = REMINDER_USER,
): void {
  const entries = readReminderLog().filter((e) => !same(e, line, shift.shiftKey, minute, user));
  entries.push({
    line,
    shiftId: shift.shiftKey,
    triggerMinute: minute,
    user,
    shownAt: new Date().toISOString(),
    // dismissed unless the operator chooses Classify (updated by logAction)
    action: "close",
    counts: counts.byType,
  });
  writeReminderLog(entries);
}

export function logSuperseded(
  line: string,
  shift: ShiftInfo,
  minutes: number[],
  counts: ReminderCounts,
  user = REMINDER_USER,
): void {
  if (minutes.length === 0) return;
  const entries = readReminderLog();
  for (const m of minutes) {
    if (entries.some((e) => same(e, line, shift.shiftKey, m, user))) continue;
    entries.push({
      line,
      shiftId: shift.shiftKey,
      triggerMinute: m,
      user,
      shownAt: null,
      action: "superseded",
      counts: counts.byType,
    });
  }
  writeReminderLog(entries);
}

export function logAction(
  line: string,
  shiftId: string,
  minute: number,
  action: "classify" | "close",
  user = REMINDER_USER,
): void {
  const entries = readReminderLog().map((e) =>
    same(e, line, shiftId, minute, user) ? { ...e, action } : e,
  );
  writeReminderLog(entries);
}

/** Test helper. */
export function _purgeReminderLog(line?: string): void {
  writeReminderLog(
    line ? readReminderLog().filter((e) => e.line !== line) : [],
  );
}
