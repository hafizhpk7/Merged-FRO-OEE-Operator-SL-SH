import { useState } from "react";
import { Clock, Cpu } from "lucide-react";
import { getMockShifts, type ShiftItem } from "@/lib/oee/shiftMaster";
import { getLine } from "@/lib/oee/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OperatorSelectors({
  plantId,
  lineId,
  showMachineSelect = false,
  selectedMachine,
  onMachineChange,
  onBeforeShiftChange,
  includeAllMachines = false,
}: {
  plantId: string;
  lineId: string;
  showMachineSelect?: boolean;
  selectedMachine?: string;
  onMachineChange?: (machineId: string) => void;
  onBeforeShiftChange?: (proceed: () => void) => void;
  includeAllMachines?: boolean;
}) {
  const shifts = getMockShifts();
  const [selectedShift, setSelectedShift] = useState<string>(shifts[0]?.id || "shift-3-current");

  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const rawMachines = line?.machines || [
    { id: "LTF01", name: "LTF01 - TUBE FILLER" },
    { id: "LCM07", name: "LCM07 - CARTONING MACHINE" },
    { id: "LCP03", name: "LCP03 - CASE PACKER" },
  ];

  const machines = includeAllMachines
    ? [{ id: "ALL", name: "All machines (Line)" }, ...rawMachines]
    : rawMachines;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 py-2">
      {/* Shift Selector */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="size-3.5" />
          LIST SHIFT
        </label>
        <Select
          value={selectedShift}
          onValueChange={(val) => {
            if (onBeforeShiftChange) {
              onBeforeShiftChange(() => setSelectedShift(val));
            } else {
              setSelectedShift(val);
            }
          }}
        >
          <SelectTrigger className="h-8 w-64 bg-card text-xs font-medium border-border">
            <SelectValue placeholder="Select shift" />
          </SelectTrigger>
          <SelectContent align="end">
            {shifts.map((s: ShiftItem) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                <div className="flex items-center gap-2">
                  {s.isCurrent && (
                    <span className="rounded bg-orange-500 px-1.5 py-0.2 text-[10px] font-bold text-white uppercase">
                      Current
                    </span>
                  )}
                  <span>{s.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Machine Selector (Optional - rendered on Reject and Reason tabs) */}
      {showMachineSelect && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Cpu className="size-3.5" />
            LIST MACHINE
          </label>
          <Select
            value={selectedMachine || machines[0]?.id || "ALL"}
            onValueChange={(val) => onMachineChange?.(val)}
          >
            <SelectTrigger className="h-8 w-60 bg-card text-xs font-medium border-border">
              <SelectValue placeholder="Select machine" />
            </SelectTrigger>
            <SelectContent align="end">
              {machines.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                  {m.name || m.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
