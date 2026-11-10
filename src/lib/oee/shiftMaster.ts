import { WIB_OFFSET_MS, getShiftInfo, getShiftInfoAt, SHIFT_SECONDS, formatDateWib, formatTimeWib } from "./shiftClock";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** `10 Nov 2026` (WIB) */
function dMonYyyy(sec: number): string {
  const d = new Date(sec * 1000 + WIB_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export type ShiftItem = {
  /** `shift-<startSec>` */
  id: string;
  name: string;
  startTime: string; // e.g. "07:00"
  endTime: string; // e.g. "15:00"
  label: string; // e.g. "Shift A (07:00 – 15:00)"
  isCurrent: boolean;
  dateStr: string;
  /** Shift start, epoch seconds. */
  startSec: number;
};

/**
 * Shifts offered by LIST SHIFT: the current shift and the two before it, derived from the central
 * (simulated) clock so they follow time scale, jumps and shift rollover.
 */
export function getMockShifts(count = 3): ShiftItem[] {
  const cur = getShiftInfo();
  const out: ShiftItem[] = [];
  for (let i = 0; i < count; i++) {
    const startSec = cur.startSec - i * SHIFT_SECONDS;
    const info = i === 0 ? cur : getShiftInfoAt(startSec);
    const start = formatTimeWib(info.startSec);
    const end = formatTimeWib(info.endSec);
    out.push({
      id: `shift-${info.startSec}`,
      name: `Shift ${info.code}`,
      startTime: start,
      endTime: end,
      label: `Shift ${info.code} (${start} – ${end}) · ${dMonYyyy(info.startSec)}`,
      isCurrent: i === 0,
      dateStr: formatDateWib(info.startSec),
      startSec: info.startSec,
    });
  }
  return out;
}
