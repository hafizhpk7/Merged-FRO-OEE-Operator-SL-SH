import { BellRing, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CLASSIFIABLE_LABEL, CLASSIFIABLE_TYPES } from "@/lib/oee/reasonConstants";
import type { ReminderCounts, ReminderUrgency } from "@/lib/oee/shiftReminder";

const URGENCY_STYLE: Record<ReminderUrgency, { circle: string; text: string }> = {
  info: {
    circle: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    text: "text-blue-700 dark:text-blue-300",
  },
  warning: {
    circle: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
  },
  critical: {
    circle: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    text: "text-red-700 dark:text-red-300",
  },
};

const TYPE_BADGE: Record<string, string> = {
  downtime: "bg-red-500 text-white",
  minor_stop: "bg-purple-600 text-white",
  speed_loss: "bg-amber-500 text-white",
};

/**
 * CR 4 "Pengingat pergantian shift" (RM-03). Close only dismisses (RM-05);
 * Classify Issue navigates to the Reason tab (RM-04) and the host closes the pop-up.
 */
export function ShiftReminderModal({
  open,
  shiftName,
  endTimeLabel,
  triggerMinute,
  urgency,
  counts,
  onClassify,
  onClose,
}: {
  open: boolean;
  shiftName: string;
  endTimeLabel: string;
  triggerMinute: number;
  urgency: ReminderUrgency;
  counts: ReminderCounts;
  onClassify: () => void;
  onClose: () => void;
}) {
  const style = URGENCY_STYLE[urgency];
  const when =
    triggerMinute === 0
      ? `${shiftName} berakhir sekarang (${endTimeLabel})`
      : `${shiftName} berakhir pukul ${endTimeLabel} | ${triggerMinute} menit lagi`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-label="Pengingat pergantian shift"
        data-testid="shift-reminder"
        data-urgency={urgency}
        data-trigger={triggerMinute}
        className="max-w-md p-6"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${style.circle}`}
          >
            <BellRing className="size-5" />
          </span>
          <div>
            <DialogTitle className="text-base font-semibold">Pengingat pergantian shift</DialogTitle>
            <DialogDescription
              data-testid="reminder-when"
              className={`text-xs font-medium ${style.text}`}
            >
              {when}
            </DialogDescription>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Masih ada{" "}
          <b data-testid="reminder-total" className="font-semibold text-foreground">
            {counts.total} issue
          </b>{" "}
          yang belum di-tagging. Selesaikan sebelum shift berganti agar data OEE akurat.
        </p>

        <div className="space-y-1.5">
          {CLASSIFIABLE_TYPES.map((t) => (
            <div
              key={t}
              data-testid={`reminder-row-${t}`}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span
                className={`flex h-5 min-w-6 items-center justify-center rounded px-1 text-[10px] font-bold ${TYPE_BADGE[t]}`}
              >
                {CLASSIFIABLE_LABEL[t].code}
              </span>
              <span>{CLASSIFIABLE_LABEL[t].name}</span>
              <span className="ml-auto font-semibold" data-testid={`reminder-count-${t}`}>
                {counts.byType[t]}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" data-testid="reminder-close" onClick={onClose}>
            Close
          </Button>
          <Button
            data-testid="reminder-classify"
            onClick={onClassify}
            className="bg-blue-900 text-white hover:bg-blue-800"
          >
            <ListChecks className="mr-1.5 size-4" />
            Classify Issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
