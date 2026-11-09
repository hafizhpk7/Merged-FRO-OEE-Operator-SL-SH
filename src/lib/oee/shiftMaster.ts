import { formatDateWib, getShiftInfo, getShiftInfoAt, SHIFT_SECONDS, formatTimeWib } from "./shiftClock";

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
      label: `Shift ${info.code} (${start} – ${end})`,
      isCurrent: i === 0,
      dateStr: formatDateWib(info.startSec),
      startSec: info.startSec,
    });
  }
  return out;
}
