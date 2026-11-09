/**
 * Shift Clock and Time Utilities for Paragon Plant Jatake 2 (J2).
 * Timezone: WIB (Western Indonesia Time, UTC+7).
 * 3 standard 8-hour shifts per day:
 * - Shift A: 07:00:00 - 14:59:59 WIB
 * - Shift B: 15:00:00 - 22:59:59 WIB
 * - Shift C: 23:00:00 - 06:59:59 WIB (next day)
 */

import { simStore } from "./simStore";

export type ShiftCode = "A" | "B" | "C";

export const SHIFT_SECONDS = 8 * 3600; // 28,800 seconds
export const WIB_OFFSET_MS = 7 * 3600000;

export interface ShiftInfo {
  code: ShiftCode;
  label: string;
  startHour: number;
  endHour: number;
  /** Minute of day (WIB) the shift starts; 0 mod 60 for standard shifts, 390 for the 06:30 demo. */
  startMinuteOfDay?: number;
  dateKey: string; // YYYY-MM-DD in WIB
  shiftKey: string; // YYYY-MM-DD:A
  startSec: number; // Unix timestamp in seconds
  endSec: number; // Unix timestamp in seconds
  elapsedSec: number; // Elapsed seconds from shift start to now (clamped to 0..28800)
  isCurrent: boolean;
}

// ---- Central clock (CR 4 demo support) ---------------------------------------------------
// All shift, reminder and window-engine code paths read "now" from here. A demo offset (kept in
// sessionStorage, so it is per tab and gone when the tab closes) shifts the clock without
// stopping it; production behaviour is unchanged when no offset is set.
const clockListeners = new Set<() => void>();
// Simulated time lives in simStore (offset, time scale, pause); every change notifies clock listeners.
simStore.subscribe(() => clockListeners.forEach((l) => l()));

/** Current epoch milliseconds from the central (simulated) clock. */
export function getNowMs(): number {
  return simStore.nowMs();
}

/** Current time as a Date from the central clock. Use this instead of new Date() / Date.now(). */
export function getNow(): Date {
  return new Date(getNowMs());
}

/** Offset of the simulated clock against the real clock (non-zero when scaled or paused). */
export function getDemoClockOffsetMs(): number {
  const st = simStore.get();
  if (st.paused || st.timeScale !== 1) return getNowMs() - Date.now() || 1;
  return st.timeOffsetMs;
}

export function setDemoClockOffsetMs(offsetMs: number | null): void {
  simStore.setTimeOffsetMs(offsetMs ?? 0);
}

/** Moves the clock so that it is `minutesBeforeEnd` before the end of the running shift. */
export function jumpToShiftEnd(minutesBeforeEnd: number): void {
  // Reference the real clock so repeated jumps do not stack.
  const real = new Date(Date.now());
  const shift = getShiftInfo(real);
  const target = shift.endSec * 1000 - minutesBeforeEnd * 60000;
  setDemoClockOffsetMs(target - Date.now());
}

/** Sets the clock to today's (WIB) HH:MM, today = the date of the real clock. Demo helper. */
export function jumpToWibTime(hour: number, minute: number): void {
  const realWib = getWibDate(Date.now());
  const targetUtcMs =
    Date.UTC(realWib.getUTCFullYear(), realWib.getUTCMonth(), realWib.getUTCDate(), hour, minute, 0, 0) -
    WIB_OFFSET_MS;
  setDemoClockOffsetMs(targetUtcMs - Date.now());
}

// ---- Shift start override (CR 5 multi-SKU demo) -------------------------------------------
// Standard shifts start at 07:00, 15:00 and 23:00. A config override moves the first shift start
// (in minutes after midnight WIB), e.g. 390 = 06:30 gives 06:30-14:30, 14:30-22:30, 22:30-06:30.
// Per tab (sessionStorage) so the demo can run next to the standard shifts in another tab.
export const STANDARD_SHIFT_START_MIN = 7 * 60;
const SHIFT_OVERRIDE_KEY = "fro_shift_start_override_min";
let shiftStartOverrideMin: number | null | undefined;

function readShiftOverride(): number | null {
  if (shiftStartOverrideMin !== undefined) return shiftStartOverrideMin;
  let v: number | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SHIFT_OVERRIDE_KEY);
      const n = raw === null ? NaN : Number(raw);
      v = Number.isFinite(n) && n >= 0 && n < 1440 ? n : null;
    } catch {
      v = null;
    }
  }
  shiftStartOverrideMin = v;
  return v;
}

export function getShiftStartMinuteOfDay(): number {
  return readShiftOverride() ?? STANDARD_SHIFT_START_MIN;
}

export function isShiftOverrideActive(): boolean {
  return readShiftOverride() !== null;
}

export function setShiftStartOverrideMin(min: number | null): void {
  shiftStartOverrideMin = min;
  if (typeof window !== "undefined") {
    try {
      if (min === null) sessionStorage.removeItem(SHIFT_OVERRIDE_KEY);
      else sessionStorage.setItem(SHIFT_OVERRIDE_KEY, String(min));
    } catch {
      // ignore: the in-memory override still applies
    }
  }
  clockListeners.forEach((l) => l());
}

export function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  return () => clockListeners.delete(listener);
}

function getWibDate(ms: number) {
  return new Date(ms + WIB_OFFSET_MS);
}

/**
 * Gets current WIB date and time components
 */
export function getWibNow(refDate: Date = getNow()): Date {
  return getWibDate(refDate.getTime());
}

/**
 * Formats a Date or timestamp as HH:MM or HH:MM:SS in WIB
 */
export function formatTimeWib(dateOrSecOrMs: Date | number, includeSec = false): string {
  const ms =
    typeof dateOrSecOrMs === "number"
      ? dateOrSecOrMs > 1e11
        ? dateOrSecOrMs
        : dateOrSecOrMs * 1000
      : dateOrSecOrMs.getTime();
  const wib = getWibDate(ms);
  const h = String(wib.getUTCHours()).padStart(2, "0");
  const m = String(wib.getUTCMinutes()).padStart(2, "0");
  if (!includeSec) return `${h}:${m}`;
  const s = String(wib.getUTCSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Formats a Date or timestamp into WIB date string, e.g. "Wed 14 Oct"
 */
export function formatDateWib(dateOrSecOrMs: Date | number): string {
  const ms =
    typeof dateOrSecOrMs === "number"
      ? dateOrSecOrMs > 1e11
        ? dateOrSecOrMs
        : dateOrSecOrMs * 1000
      : dateOrSecOrMs.getTime();
  const wib = getWibDate(ms);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dName = days[wib.getUTCDay()] ?? "";
  const dNum = String(wib.getUTCDate()).padStart(2, "0");
  const mName = months[wib.getUTCMonth()] ?? "";
  return `${dName} ${dNum} ${mName}`;
}

export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
  return `${s}s`;
}

export function formatEventDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * Calculates shift info for any given reference timestamp
 */
export function getShiftInfo(refDate: Date = getNow()): ShiftInfo {
  return computeShiftInfo(refDate, getShiftStartMinuteOfDay());
}

/** Pure shift lookup for a given first shift start (minutes after midnight WIB). */
export function computeShiftInfo(refDate: Date, firstStart: number): ShiftInfo {
  const ms = refDate.getTime();
  const wib = getWibDate(ms);
  const minuteOfDay = wib.getUTCHours() * 60 + wib.getUTCMinutes();

  // Three 8 h shifts starting at the (overridable) first shift start; the shift index follows the
  // time since that start, modulo one day.
  const rel = (((minuteOfDay - firstStart) % 1440) + 1440) % 1440;
  const idx = Math.min(2, Math.floor(rel / 480));
  const code = (["A", "B", "C"] as const)[idx] as ShiftCode;
  const startMod = (firstStart + idx * 480) % 1440;
  const startHour = Math.floor(startMod / 60);
  const startMinute = startMod % 60;
  const endMod = (startMod + 480) % 1440;
  const endHour = Math.floor(endMod / 60);

  // The shift began yesterday when its start lies later in the day than now (cross-midnight)
  const wibDateForDateKey = startMod > minuteOfDay ? getWibDate(ms - 86400000) : wib;

  const dateKey = `${wibDateForDateKey.getUTCFullYear()}-${String(wibDateForDateKey.getUTCMonth() + 1).padStart(2, "0")}-${String(wibDateForDateKey.getUTCDate()).padStart(2, "0")}`;
  const shiftKey = `${dateKey}:${code}`;
  const lastMod = (startMod + 479) % 1440;
  const hh = (n: number) => String(Math.floor(n / 60)).padStart(2, "0");
  const mm = (n: number) => String(n % 60).padStart(2, "0");
  const label = `Shift ${code} · ${hh(startMod)}:${mm(startMod)}-${hh(lastMod)}:${mm(lastMod)} WIB`;

  // Calculate start epoch seconds
  const startWibMs = Date.UTC(
    wibDateForDateKey.getUTCFullYear(),
    wibDateForDateKey.getUTCMonth(),
    wibDateForDateKey.getUTCDate(),
    startHour,
    startMinute,
    0,
    0,
  );
  const startSec = Math.floor((startWibMs - WIB_OFFSET_MS) / 1000);
  const endSec = startSec + SHIFT_SECONDS;

  // Elapsed seconds
  const elapsedSec = Math.min(SHIFT_SECONDS, Math.max(0, Math.floor(ms / 1000) - startSec));

  return {
    code,
    label,
    startHour,
    endHour,
    startMinuteOfDay: startMod,
    dateKey,
    shiftKey,
    startSec,
    endSec,
    elapsedSec,
    isCurrent: true,
  };
}

export function getPreviousShiftInfo(refDate: Date = getNow()): ShiftInfo {
  const current = getShiftInfo(refDate);
  const prevDate = new Date(current.startSec * 1000 - 3600 * 1000);
  const prev = getShiftInfo(prevDate);
  return { ...prev, isCurrent: false, elapsedSec: SHIFT_SECONDS };
}

/**
 * Shift that starts at `startSec` (epoch seconds), with elapsed time measured against the
 * central clock. Used when a page must keep showing a shift that has just ended (reminder T-0).
 */
export function getShiftInfoAt(startSec: number): ShiftInfo {
  const info = getShiftInfo(new Date((startSec + 1) * 1000));
  const nowSec = Math.floor(getNowMs() / 1000);
  const elapsedSec = Math.min(SHIFT_SECONDS, Math.max(0, nowSec - info.startSec));
  return { ...info, elapsedSec, isCurrent: nowSec >= info.startSec && nowSec < info.endSec };
}

/** Start (epoch seconds) of the shift with this key ("YYYY-MM-DD:A"), using the current first-shift start. */
export function getShiftStartSecByKey(shiftKey: string): number {
  const [dateKey = "", code = "A"] = shiftKey.split(":");
  const [y = 1970, m = 1, d = 1] = dateKey.split("-").map(Number);
  const idx = code === "B" ? 1 : code === "C" ? 2 : 0;
  const startMod = (getShiftStartMinuteOfDay() + idx * 480) % 1440;
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + startMod * 60000 - WIB_OFFSET_MS;
  return Math.floor(ms / 1000);
}

/** Shift info for a shift key; elapsed time is measured against the central clock (full for past shifts). */
export function getShiftInfoByKey(shiftKey: string): ShiftInfo {
  return getShiftInfoAt(getShiftStartSecByKey(shiftKey));
}

/**
 * The shift a page should show: the current shift, or a selected earlier one. For a completed
 * shift `elapsedSec` is the full shift length, so every consumer uses until = shift end, never "now".
 */
export function getViewShiftInfo(selectedStartSec: number | null): ShiftInfo {
  const cur = getShiftInfo();
  if (selectedStartSec === null || selectedStartSec === cur.startSec) return cur;
  const info = getShiftInfoAt(selectedStartSec);
  return { ...info, elapsedSec: info.isCurrent ? info.elapsedSec : SHIFT_SECONDS };
}
