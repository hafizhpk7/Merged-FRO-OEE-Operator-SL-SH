/**
 * Global Period Resolution and State Management for OEE Dashboard.
 * Standardizes period windows, like-for-like comparison windows, and custom range rules across all plants.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getShiftInfo, getPreviousShiftInfo, getWibNow, SHIFT_SECONDS } from "./shiftClock";

export type PeriodKey = "this-shift" | "today" | "this-week" | "this-month" | "custom";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "this-shift", label: "This Shift" },
  { key: "today", label: "Today" },
  { key: "this-week", label: "This Week" },
  { key: "this-month", label: "This Month" },
  { key: "custom", label: "Custom Range" },
];

/** Maximum allowed span in days for Custom Range filter (inclusive) */
export const CUSTOM_RANGE_MAX_DAYS = 31;

/** Comparison mode rule: 'like_for_like' compares elapsed window; 'full_previous' compares full window */
export type ComparisonMode = "like_for_like" | "full_previous";
export const COMPARISON_MODE: ComparisonMode = "like_for_like";

export const CUSTOM_TIME_MODE = "continuous";

export type CustomRangeConfig = {
  startDate: Date;
  endDate: Date;
  startTime?: string; // "HH:mm" 24h
  endTime?: string; // "HH:mm" 24h
  hasCustomCompare?: boolean;
  compareAllDay?: boolean;
  compareStartDate?: Date;
  compareEndDate?: Date;
  compareStartTime?: string; // "HH:mm" 24h
  compareEndTime?: string; // "HH:mm" 24h
};

export type ShiftDefinition = {
  startHour: number;
  endHour: number;
  code: string;
};

export type ResolvedPeriod = {
  periodKey: PeriodKey;
  start: Date;
  end: Date;
  compareStart: Date;
  compareEnd: Date;
  compareLabel: string;
  periodLabel: string;
  isCurrentDayOrShift: boolean;
  isPastClosed: boolean;
  isFutureEnd?: boolean;
  futureEndNotice?: string;
  elapsedMs: number;
  totalPeriodMs: number;
};

function formatShortDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
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
  const m = months[d.getMonth()];
  return `${day} ${m}`;
}

function formatTimeHHmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatCustomPeriodLabel(start: Date, end: Date, isWholeDay: boolean): string {
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (isWholeDay) {
    if (sameDay) {
      return formatShortDate(start);
    }
    return `${formatShortDate(start)} – ${formatShortDate(end)}`;
  }

  if (sameDay) {
    return `${formatShortDate(start)} · ${formatTimeHHmm(start)}–${formatTimeHHmm(end)}`;
  }

  return `${formatShortDate(start)} ${formatTimeHHmm(start)} – ${formatShortDate(end)} ${formatTimeHHmm(end)}`;
}

/**
 * Resolves period windows, comparison intervals and labels uniformly across the entire app.
 *
 * @param periodKey - One of 'this-shift' | 'today' | 'this-week' | 'this-month' | 'custom'
 * @param now - Reference current time (Asia/Jakarta timezone)
 * @param shiftConfig - Optional plant-specific shift configuration
 * @param customRange - User selected custom date range
 */
export function resolvePeriod(
  periodKey: PeriodKey = "this-shift",
  now: Date = new Date(),
  shiftConfig?: ShiftDefinition[],
  customRange?: CustomRangeConfig | null,
): ResolvedPeriod {
  const wibNow = getWibNow(now);
  const nowTs = wibNow.getTime();

  if (periodKey === "this-shift") {
    const shift = getShiftInfo(now);
    const prevShift = getPreviousShiftInfo(now);
    const start = new Date(shift.startSec * 1000);
    const end = new Date(Math.min(now.getTime(), shift.endSec * 1000));
    const elapsedMs = Math.max(0, end.getTime() - start.getTime());
    const totalPeriodMs = SHIFT_SECONDS * 1000;

    const compareStart = new Date(prevShift.startSec * 1000);
    const compareEnd =
      COMPARISON_MODE === "like_for_like"
        ? new Date(compareStart.getTime() + elapsedMs)
        : new Date(prevShift.endSec * 1000);

    return {
      periodKey,
      start,
      end,
      compareStart,
      compareEnd,
      compareLabel: "vs last shift",
      periodLabel: "This Shift",
      isCurrentDayOrShift: true,
      isPastClosed: false,
      elapsedMs,
      totalPeriodMs,
    };
  }

  if (periodKey === "today") {
    const wibMs = now.getTime() + 7 * 3600000;
    const wib = new Date(wibMs);
    const startMs =
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), 0, 0, 0, 0) - 7 * 3600000;
    const start = new Date(startMs);
    const end = new Date(now);
    const elapsedMs = Math.max(0, end.getTime() - start.getTime());
    const totalPeriodMs = 24 * 3600 * 1000;

    const compareStart = new Date(startMs - 24 * 3600 * 1000);
    const compareEnd =
      COMPARISON_MODE === "like_for_like"
        ? new Date(compareStart.getTime() + elapsedMs)
        : new Date(compareStart.getTime() + totalPeriodMs);

    return {
      periodKey,
      start,
      end,
      compareStart,
      compareEnd,
      compareLabel: "vs yesterday",
      periodLabel: "Today",
      isCurrentDayOrShift: true,
      isPastClosed: false,
      elapsedMs,
      totalPeriodMs,
    };
  }

  if (periodKey === "this-week") {
    const wibMs = now.getTime() + 7 * 3600000;
    const wib = new Date(wibMs);
    const dayOfWeek = (wib.getUTCDay() + 6) % 7; // 0 = Monday, 6 = Sunday
    const startMs =
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - dayOfWeek, 0, 0, 0, 0) -
      7 * 3600000;
    const start = new Date(startMs);
    const end = new Date(now);
    const elapsedMs = Math.max(0, end.getTime() - start.getTime());
    const totalPeriodMs = 7 * 24 * 3600 * 1000;

    const compareStart = new Date(startMs - 7 * 24 * 3600 * 1000);
    const compareEnd =
      COMPARISON_MODE === "like_for_like"
        ? new Date(compareStart.getTime() + elapsedMs)
        : new Date(compareStart.getTime() + totalPeriodMs);

    return {
      periodKey,
      start,
      end,
      compareStart,
      compareEnd,
      compareLabel: "vs last week",
      periodLabel: "This Week",
      isCurrentDayOrShift: true,
      isPastClosed: false,
      elapsedMs,
      totalPeriodMs,
    };
  }

  if (periodKey === "this-month") {
    const wibMs = now.getTime() + 7 * 3600000;
    const wib = new Date(wibMs);
    const startMs = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1, 0, 0, 0, 0) - 7 * 3600000;
    const start = new Date(startMs);
    const end = new Date(now);
    const elapsedMs = Math.max(0, end.getTime() - start.getTime());

    const daysInCurrentMonth = new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const totalPeriodMs = daysInCurrentMonth * 24 * 3600 * 1000;

    const compareStartMs =
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() - 1, 1, 0, 0, 0, 0) - 7 * 3600000;
    const compareStart = new Date(compareStartMs);
    const daysInPrevMonth = new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 0),
    ).getUTCDate();

    let compareEnd: Date;
    if (COMPARISON_MODE === "like_for_like") {
      const targetDay = Math.min(wib.getUTCDate(), daysInPrevMonth);
      const cmpEndWib = Date.UTC(
        wib.getUTCFullYear(),
        wib.getUTCMonth() - 1,
        targetDay,
        wib.getUTCHours(),
        wib.getUTCMinutes(),
        wib.getUTCSeconds(),
      );
      compareEnd = new Date(cmpEndWib - 7 * 3600000);
    } else {
      compareEnd = new Date(compareStart.getTime() + daysInPrevMonth * 24 * 3600 * 1000);
    }

    return {
      periodKey,
      start,
      end,
      compareStart,
      compareEnd,
      compareLabel: "vs last month",
      periodLabel: "This Month",
      isCurrentDayOrShift: true,
      isPastClosed: false,
      elapsedMs,
      totalPeriodMs,
    };
  }

  // Custom Range
  if (customRange && customRange.startDate && customRange.endDate) {
    const rawStart = new Date(customRange.startDate);
    const rawEnd = new Date(customRange.endDate);

    const hasStartTime = Boolean(customRange.startTime);
    const hasEndTime = Boolean(customRange.endTime);
    const isWholeDay = !hasStartTime && !hasEndTime;

    if (hasStartTime && customRange.startTime) {
      const [sh, sm] = customRange.startTime.split(":").map((v) => parseInt(v, 10));
      rawStart.setHours(isNaN(sh) ? 0 : sh, isNaN(sm) ? 0 : sm, 0, 0);
    } else {
      rawStart.setHours(0, 0, 0, 0);
    }

    if (hasEndTime && customRange.endTime) {
      const [eh, em] = customRange.endTime.split(":").map((v) => parseInt(v, 10));
      rawEnd.setHours(isNaN(eh) ? 23 : eh, isNaN(em) ? 59 : em, 0, 0);
    } else {
      rawEnd.setHours(23, 59, 59, 999);
    }

    // Future end handling: end can be chosen in future; window end = min(now, customEnd)
    const isFutureEnd = rawEnd.getTime() > nowTs;
    const effectiveEnd = isFutureEnd ? new Date(nowTs) : new Date(rawEnd.getTime());

    let futureEndNotice: string | undefined;
    if (isFutureEnd) {
      const endHHmm = formatTimeHHmm(rawEnd);
      futureEndNotice = `Ends now (live) until ${endHHmm}`;
    }

    // Clamp range to max CUSTOM_RANGE_MAX_DAYS
    const maxMs = CUSTOM_RANGE_MAX_DAYS * 24 * 3600 * 1000;
    if (rawEnd.getTime() - rawStart.getTime() > maxMs) {
      rawEnd.setTime(rawStart.getTime() + maxMs);
    }

    const elapsedMs = Math.max(1000, effectiveEnd.getTime() - rawStart.getTime());
    const totalPeriodMs = Math.max(1000, rawEnd.getTime() - rawStart.getTime());
    const isCurrentDayOrShift = effectiveEnd.getTime() >= nowTs - 24 * 3600 * 1000;
    const isPastClosed = !isFutureEnd && rawEnd.getTime() < nowTs - 60000;

    let compareStart: Date;
    let compareEnd: Date;
    let compareLabel = "vs previous period";

    if (
      customRange.hasCustomCompare &&
      customRange.compareStartDate &&
      customRange.compareEndDate
    ) {
      compareStart = new Date(customRange.compareStartDate);
      compareEnd = new Date(customRange.compareEndDate);

      if (customRange.compareAllDay) {
        // Compare all day: 00:00 to 23:59
        compareStart.setHours(0, 0, 0, 0);
        compareEnd.setHours(23, 59, 59, 999);
        compareLabel = `vs ${formatShortDate(compareStart)} – ${formatShortDate(compareEnd)} (all day)`;
      } else {
        // Same time-of-day interval as primary range
        if (customRange.compareStartTime) {
          const [csh, csm] = customRange.compareStartTime.split(":").map((v) => parseInt(v, 10));
          compareStart.setHours(isNaN(csh) ? 0 : csh, isNaN(csm) ? 0 : csm, 0, 0);
        } else if (hasStartTime && customRange.startTime) {
          const [sh, sm] = customRange.startTime.split(":").map((v) => parseInt(v, 10));
          compareStart.setHours(isNaN(sh) ? 0 : sh, isNaN(sm) ? 0 : sm, 0, 0);
        } else {
          compareStart.setHours(0, 0, 0, 0);
        }

        if (customRange.compareEndTime) {
          const [ceh, cem] = customRange.compareEndTime.split(":").map((v) => parseInt(v, 10));
          compareEnd.setHours(isNaN(ceh) ? 23 : ceh, isNaN(cem) ? 59 : cem, 0, 0);
        } else if (hasEndTime && customRange.endTime) {
          const [eh, em] = customRange.endTime.split(":").map((v) => parseInt(v, 10));
          compareEnd.setHours(isNaN(eh) ? 23 : eh, isNaN(em) ? 59 : em, 0, 0);
        } else {
          compareEnd.setHours(23, 59, 59, 999);
        }
        compareLabel = `vs ${formatShortDate(compareStart)} – ${formatShortDate(compareEnd)}`;
      }
    } else {
      // Default like-for-like preceding duration
      compareStart = new Date(rawStart.getTime() - totalPeriodMs);
      compareEnd = new Date(rawStart.getTime());
    }

    const periodLabel = formatCustomPeriodLabel(rawStart, rawEnd, isWholeDay);

    return {
      periodKey: "custom",
      start: rawStart,
      end: effectiveEnd,
      compareStart,
      compareEnd,
      compareLabel,
      periodLabel,
      isCurrentDayOrShift,
      isPastClosed,
      isFutureEnd,
      futureEndNotice,
      elapsedMs,
      totalPeriodMs,
    };
  }

  // Default fallback to This Shift
  return resolvePeriod("this-shift", now, shiftConfig);
}

export type PeriodContextValue = {
  periodKey: PeriodKey;
  setPeriodKey: (key: PeriodKey) => void;
  customRange: CustomRangeConfig | null;
  setCustomRange: (range: CustomRangeConfig | null) => void;
  resolved: ResolvedPeriod;
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

const STORAGE_PERIOD_KEY = "paragon_oee_global_period";
const STORAGE_CUSTOM_KEY = "paragon_oee_global_custom_range";
const STORAGE_VERSION_KEY = "paragon_oee_storage_version";
export const STORAGE_VERSION = "v4";

// Run one-time migration on load to clear stale/legacy period values
if (typeof window !== "undefined") {
  try {
    const currentVer = localStorage.getItem(STORAGE_VERSION_KEY);
    if (currentVer !== STORAGE_VERSION) {
      const savedPeriod = localStorage.getItem(STORAGE_PERIOD_KEY);
      if (
        savedPeriod &&
        !["this-shift", "today", "this-week", "this-month", "custom"].includes(savedPeriod)
      ) {
        localStorage.removeItem(STORAGE_PERIOD_KEY);
      }
      localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    }
  } catch {
    // ignore
  }
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [periodKey, setPeriodKeyState] = useState<PeriodKey>(() => {
    if (typeof window === "undefined") return "this-shift";
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPeriod = urlParams.get("period") as PeriodKey | null;
      if (urlPeriod && PERIOD_OPTIONS.some((o) => o.key === urlPeriod)) {
        return urlPeriod;
      }
      const savedPeriod = localStorage.getItem(STORAGE_PERIOD_KEY) as PeriodKey | null;
      if (savedPeriod && PERIOD_OPTIONS.some((o) => o.key === savedPeriod)) {
        return savedPeriod;
      }
    } catch {
      // ignore
    }
    return "this-shift";
  });

  const [customRange, setCustomRangeState] = useState<CustomRangeConfig | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const savedCustom = localStorage.getItem(STORAGE_CUSTOM_KEY);
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        return {
          startDate: new Date(parsed.startDate),
          endDate: new Date(parsed.endDate),
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          hasCustomCompare: parsed.hasCustomCompare,
          compareAllDay: parsed.compareAllDay,
          compareStartDate: parsed.compareStartDate ? new Date(parsed.compareStartDate) : undefined,
          compareEndDate: parsed.compareEndDate ? new Date(parsed.compareEndDate) : undefined,
          compareStartTime: parsed.compareStartTime,
          compareEndTime: parsed.compareEndTime,
        };
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [now, setNow] = useState<Date>(() => new Date());

  // Period clock tick every minute to advance current shift window
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const setPeriodKey = (nextKey: PeriodKey) => {
    setPeriodKeyState(nextKey);
    try {
      localStorage.setItem(STORAGE_PERIOD_KEY, nextKey);
      // Sync URL query without full reload
      const url = new URL(window.location.href);
      url.searchParams.set("period", nextKey);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  };

  const setCustomRange = (range: CustomRangeConfig | null) => {
    setCustomRangeState(range);
    try {
      if (range) {
        localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(range));
      } else {
        localStorage.removeItem(STORAGE_CUSTOM_KEY);
      }
    } catch {
      // ignore
    }
  };

  const resolved = resolvePeriod(periodKey, now, undefined, customRange);

  return (
    <PeriodContext.Provider
      value={{
        periodKey,
        setPeriodKey,
        customRange,
        setCustomRange,
        resolved,
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
}

/**
 * Hook to access and update global Period filter across all Live Monitor pages.
 */
export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) {
    // Graceful fallback if rendered outside provider
    const fallback = resolvePeriod("this-shift");
    return {
      periodKey: "this-shift",
      setPeriodKey: () => {},
      customRange: null,
      setCustomRange: () => {},
      resolved: fallback,
    };
  }
  return ctx;
}
