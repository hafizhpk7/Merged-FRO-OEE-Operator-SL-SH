import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { getMockShifts, type ShiftItem } from "@/lib/oee/shiftMaster";
import { useState } from "react";
import { toast } from "sonner";

export function LegacyShiftReminderModal({
  open,
  onOpenChange,
  currentShiftLabel,
  endTime,
  onChangeShift,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentShiftLabel: string;
  endTime: string;
  onChangeShift: (newShiftId: string) => void;
}) {
  const shifts = getMockShifts();
  const [selectedShift, setSelectedShift] = useState(shifts[0]?.id || "shift-3-current");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 font-bold">
              <Clock className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                END OF SHIFT REMINDER
              </DialogTitle>
              <DialogDescription className="text-xs">
                Your shift ({currentShiftLabel}) will end at {endTime}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">
            Do you want to change shift or continue to the next scheduled shift?
          </p>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Change Shift To
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
            >
              {shifts.map((s: ShiftItem) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="mt-2 flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.info("Shift reminder dismissed.");
              onOpenChange(false);
            }}
            className="text-xs"
          >
            No, thanks
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onChangeShift(selectedShift);
              toast.success("Shift changed successfully.");
              onOpenChange(false);
            }}
            className="text-xs bg-primary text-primary-foreground px-4"
          >
            Change Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
