/**
 * Shift Clock and Time Utilities for Paragon Plant Jatake 2 (J2).
 * Timezone: WIB (Western Indonesia Time, UTC+7).
 * 3 standard 8-hour shifts per day:
 * - Shift A: 07:00:00 - 14:59:59 WIB
 * - Shift B: 15:00:00 - 22:59:59 WIB
 * - Shift C: 23:00:00 - 06:59:59 WIB (next day)
 */

export type ShiftCode = "A" | "B" | "C";

export const SHIFT_SECONDS = 8 * 3600; // 28,800 seconds
export const WIB_OFFSET_MS = 7 * 3600000;

export interface ShiftInfo {
  code: ShiftCode;
  label: string;
  startHour: number;
  endHour: number;
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
const DEMO_OFFSET_KEY = "fro_demo_clock_offset_ms";
let demoOffsetMs: number | null = null;
const clockListeners = new Set<() => void>();

function readDemoOffset(): number {
  if (demoOffsetMs !== null) return demoOffsetMs;
  let v = 0;
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(DEMO_OFFSET_KEY);
      const n = raw === null ? 0 : Number(raw);
      v = Number.isFinite(n) ? n : 0;
    } catch {
      v = 0;
    }
  }
  demoOffsetMs = v;
  return v;
}

/** Current epoch milliseconds (demo offset applied). */
export function getNowMs(): number {
  return Date.now() + readDemoOffset();
}

/** Current time as a Date (demo offset applied). Use this instead of new Date(). */
export function getNow(): Date {
  return new Date(getNowMs());
}

export function getDemoClockOffsetMs(): number {
  return readDemoOffset();
}

export function setDemoClockOffsetMs(offsetMs: number | null): void {
  demoOffsetMs = offsetMs ?? 0;
  if (typeof window !== "undefined") {
    try {
      if (offsetMs === null || offsetMs === 0) sessionStorage.removeItem(DEMO_OFFSET_KEY);
      else sessionStorage.setItem(DEMO_OFFSET_KEY, String(offsetMs));
    } catch {
      // ignore: the in-memory offset still applies for this page load
    }
  }
  clockListeners.forEach((l) => l());
}

/** Moves the clock so that it is `minutesBeforeEnd` before the end of the running shift. */
export function jumpToShiftEnd(minutesBeforeEnd: number): void {
  // Reference the real clock so repeated jumps do not stack.
  const real = new Date(Date.now());
  const shift = getShiftInfo(real);
  const target = shift.endSec * 1000 - minutesBeforeEnd * 60000;
  setDemoClockOffsetMs(target - Date.now());
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
  const ms = refDate.getTime();
  const wib = getWibDate(ms);
  const hour = wib.getUTCHours();

  let code: ShiftCode = "A";
  let startHour = 7;
  let endHour = 15;

  // Shift C starts at 23:00 WIB
  if (hour >= 7 && hour < 15) {
    code = "A";
    startHour = 7;
  } else if (hour >= 15 && hour < 23) {
    code = "B";
    startHour = 15;
    endHour = 23;
  } else {
    code = "C";
    startHour = 23;
    endHour = 7;
  }

  // Calculate WIB date key based on shift definition
  let wibDateForDateKey = wib;
  if (code === "C" && hour < 7) {
    // If Shift C, and before 7am, it's the date key of "yesterday"
    wibDateForDateKey = getWibDate(ms - 86400000);
  }

  const dateKey = `${wibDateForDateKey.getUTCFullYear()}-${String(wibDateForDateKey.getUTCMonth() + 1).padStart(2, "0")}-${String(wibDateForDateKey.getUTCDate()).padStart(2, "0")}`;
  const shiftKey = `${dateKey}:${code}`;
  const label = `Shift ${code} · ${String(startHour).padStart(2, "0")}:00-${String((startHour + 8) % 24).padStart(2, "0")}:59 WIB`;

  // Calculate start epoch seconds
  const startWibMs = Date.UTC(
    wibDateForDateKey.getUTCFullYear(),
    wibDateForDateKey.getUTCMonth(),
    wibDateForDateKey.getUTCDate(),
    startHour,
    0,
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
