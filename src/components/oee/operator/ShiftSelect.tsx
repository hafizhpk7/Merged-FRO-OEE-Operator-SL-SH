import { Clock } from "lucide-react";
import { getMockShifts, type ShiftItem } from "@/lib/oee/shiftMaster";
import { useSimWindowBucket } from "@/lib/oee/useSimTick";
import { useViewShift, viewShiftStore } from "@/lib/oee/viewShiftStore";
import { label } from "./froUi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * LIST SHIFT select in the header card, formatted like the old FRO MES:
 * `<shift name> (HH:MM – HH:MM) · D Mon YYYY` with an orange "Current" tag. It drives every operator
 * page through the shared view-shift store (a completed shift shows data until its end).
 */
export function ShiftSelect({ onBeforeChange }: { onBeforeChange?: (proceed: () => void) => void }) {
  useSimWindowBucket(480); // the list follows simulated time (shift rollover)
  const shifts = getMockShifts();
  const view = useViewShift();
  const selected = `shift-${view.info.startSec}`;
  const select = (id: string) => {
    const s = shifts.find((x) => x.id === id);
    viewShiftStore.set(!s || s.isCurrent ? null : s.startSec);
  };
  return (
    <div className="flex w-full flex-col gap-1 sm:w-[250px]" data-testid="shift-select">
      <label className={`flex items-center gap-1.5 ${label}`}>
        <Clock className="size-3" />
        List Shift
      </label>
      <Select
        value={selected}
        onValueChange={(val) => {
          if (onBeforeChange) onBeforeChange(() => select(val));
          else select(val);
        }}
      >
        <SelectTrigger data-testid="list-shift" className="h-8 w-full min-w-0 rounded-lg bg-transparent text-base font-normal">
          <SelectValue placeholder="Select shift" />
        </SelectTrigger>
        <SelectContent align="end">
          {shifts.map((s: ShiftItem) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              <div className="flex items-center gap-2">
                {s.isCurrent && (
                  <span className="inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium text-white" style={{ background: "var(--fro-warn)" }}>Current</span>
                )}
                <span className="text-xs font-semibold">{s.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
