import { Cpu } from "lucide-react";
import { getLine } from "@/lib/oee/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Page-level controls under the header card: optional extra controls (Dashboard: SRR switch and
 * Realisasi per jam) and the machine select (Reject and Reason). The LIST SHIFT select lives in the
 * header card (ShiftSelect).
 */
export function OperatorSelectors({
  plantId,
  lineId,
  showMachineSelect = false,
  selectedMachine,
  onMachineChange,
  includeAllMachines = false,
  extra,
}: {
  plantId: string;
  lineId: string;
  showMachineSelect?: boolean;
  selectedMachine?: string;
  onMachineChange?: (machineId: string) => void;
  includeAllMachines?: boolean;
  extra?: React.ReactNode;
}) {
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

  if (!extra && !showMachineSelect) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 py-1">
      {extra}
      {showMachineSelect && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Cpu className="size-3.5" />
            LIST MACHINE
          </label>
          <Select value={selectedMachine || machines[0]?.id || "ALL"} onValueChange={(val) => onMachineChange?.(val)}>
            <SelectTrigger data-testid="list-machine" className="h-8 w-60 max-w-full bg-card text-xs font-medium border-border">
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
