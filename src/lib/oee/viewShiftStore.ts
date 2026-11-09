/**
 * Shift selected with LIST SHIFT on the operator pages (per tab). null = the current shift.
 * A completed shift always shows data until its end (see getViewShiftInfo).
 */
import { useSyncExternalStore } from "react";
import { getNowMs, getShiftInfo, getViewShiftInfo, subscribeClock, type ShiftInfo } from "./shiftClock";

const KEY = "fro_view_shift_start";
const listeners = new Set<() => void>();
let selected: number | null | undefined;

function read(): number | null {
  if (selected !== undefined) return selected;
  let v: number | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(KEY);
      const n = raw === null ? NaN : Number(raw);
      v = Number.isFinite(n) ? n : null;
    } catch {
      v = null;
    }
  }
  selected = v;
  return v;
}

export const viewShiftStore = {
  get: read,
  set(startSec: number | null) {
    selected = startSec;
    if (typeof window !== "undefined") {
      try {
        if (startSec === null) sessionStorage.removeItem(KEY);
        else sessionStorage.setItem(KEY, String(startSec));
      } catch {
        // ignore
      }
    }
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** The shift to show. When the clock rolls into the selected shift it simply is the current one. */
export function getViewShift(): ShiftInfo {
  return getViewShiftInfo(read());
}

/** Selected shift info (re-renders on selection and on clock changes). `isPast` = completed shift. */
export function useViewShift(): { info: ShiftInfo; isPast: boolean; selectedStartSec: number | null } {
  useSyncExternalStore(viewShiftStore.subscribe, read, () => null);
  useSyncExternalStore(subscribeClock, () => Math.floor(getNowMs() / 1000 / 30), () => 0);
  const info = getViewShiftInfo(read());
  return { info, isPast: info.startSec !== getShiftInfo().startSec, selectedStartSec: read() };
}

declare global {
  interface Window {
    /** Dev helper: select the shift shown on the operator pages by index (0 = current, 1 = previous, ...). */
    setViewShift?: (index: number) => number | null;
  }
}
if (typeof window !== "undefined") {
  window.setViewShift = (index: number) => {
    const cur = getShiftInfo();
    const start = index <= 0 ? null : cur.startSec - index * 8 * 3600;
    viewShiftStore.set(start);
    return start;
  };
}
