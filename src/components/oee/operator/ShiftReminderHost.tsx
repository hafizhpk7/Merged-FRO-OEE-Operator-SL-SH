import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShiftReminderModal } from "./ShiftReminderModal";
import {
  dueTriggers,
  getReminderCounts,
  handledMinutes,
  logAction,
  logShown,
  logSuperseded,
  reminderShiftAt,
  selectTriggerToShow,
  urgencyOf,
  type ReminderCounts,
} from "@/lib/oee/shiftReminder";
import { formatTimeWib, getNowMs, subscribeClock, type ShiftInfo } from "@/lib/oee/shiftClock";

type Active = { minute: number; shift: ShiftInfo; counts: ReminderCounts };

const POLL_MS = 5000;

/**
 * CR 4: mounted on the Dashboard only. A trigger missed while the operator was on Reject or
 * Reason is picked up on the first evaluation after returning here (RM-06): the latest unshown
 * trigger is shown, older ones are marked superseded.
 */
export function ShiftReminderHost({ plantId, lineId }: { plantId: string; lineId: string }) {
  const navigate = useNavigate();
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;

  const evaluate = useCallback(() => {
    if (activeRef.current) return;
    // Do not stack on top of another open dialog (e.g. the mandatory QA inspection alert);
    // the next poll shows the reminder once it is dismissed. Nothing is logged until shown.
    if (
      typeof document !== "undefined" &&
      document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')
    ) {
      return;
    }
    const nowMs = getNowMs();
    const shift = reminderShiftAt(nowMs);
    const due = dueTriggers(shift, nowMs);
    if (due.length === 0) return;
    const { show, superseded } = selectTriggerToShow(due, handledMinutes(lineId, shift.shiftKey));
    if (show === null) return;
    const counts = getReminderCounts(plantId, lineId, shift, nowMs);
    if (counts.total === 0) return; // RM-02: nothing Uncommented, nothing to show
    logSuperseded(lineId, shift, superseded, counts);
    logShown(lineId, shift, show, counts);
    setActive({ minute: show, shift, counts });
  }, [plantId, lineId]);

  useEffect(() => {
    // Short delay so dialogs opened on mount (QA alert) are already visible to the check above.
    const first = setTimeout(evaluate, 1000);
    const timer = setInterval(evaluate, POLL_MS);
    const unsub = subscribeClock(evaluate); // demo clock jumps re-evaluate immediately
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      unsub();
    };
  }, [evaluate]);

  if (!active) return null;
  const { minute, shift, counts } = active;

  return (
    <ShiftReminderModal
      open
      shiftName={`Shift ${shift.code}`}
      endTimeLabel={formatTimeWib(shift.endSec)}
      triggerMinute={minute}
      urgency={urgencyOf(minute)}
      counts={counts}
      onClose={() => {
        logAction(lineId, shift.shiftKey, minute, "close");
        setActive(null);
      }}
      onClassify={() => {
        logAction(lineId, shift.shiftKey, minute, "classify");
        setActive(null);
        void navigate({
          to: "/operator/$plantId/$lineId/reason",
          params: { plantId, lineId },
          search: { ...(counts.topMachine ? { machine: counts.topMachine } : {}), shift: shift.startSec },
        });
      }}
    />
  );
}
