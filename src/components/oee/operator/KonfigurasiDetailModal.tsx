import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { REJECT_TYPES, type RejectSlot } from "@/lib/oee/rejectConfig";
import { toast } from "sonner";
import { Settings } from "lucide-react";

export function KonfigurasiDetailModal({
  open,
  onOpenChange,
  slot,
  machines,
  onSaveConfig,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: RejectSlot | null;
  machines: { code: string; name: string }[];
  onSaveConfig: (updatedSlot: RejectSlot) => void;
}) {
  const [machineCode, setMachineCode] = useState(
    slot?.assignedMachine || machines[0]?.code || "LCM07",
  );
  const [rejectTypeId, setRejectTypeId] = useState(
    slot?.rejectTypeId || (REJECT_TYPES[0] ? REJECT_TYPES[0].id : ""),
  );
  const [status, setStatus] = useState<"Assigned" | "Unassigned">(slot?.status || "Assigned");

  useEffect(() => {
    if (slot) {
      setMachineCode(slot.assignedMachine || machines[0]?.code || "LCM07");
      setRejectTypeId(slot.rejectTypeId || (REJECT_TYPES[0] ? REJECT_TYPES[0].id : ""));
      setStatus(slot.status);
    }
  }, [slot, machines]);

  if (!slot) return null;

  const handleSave = () => {
    const selectedType = REJECT_TYPES.find((t) => t.id === rejectTypeId);
    const updated: RejectSlot = {
      ...slot,
      assignedMachine: status === "Assigned" ? machineCode : null,
      rejectTypeId: status === "Assigned" ? rejectTypeId : null,
      rejectTypeName: status === "Assigned" ? selectedType?.name || null : null,
      status,
      category: selectedType?.category || "Reject",
    };
    onSaveConfig(updated);
    toast.success(`Slot ${slot.slotId} configuration updated successfully.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Settings className="size-4" />
            </span>
            <DialogTitle>Konfigurasi Slot — {slot.slotId}</DialogTitle>
          </div>
          <DialogDescription>
            Configure assigned machine, reject defect type, and active slot status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Slot Status
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus("Assigned")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  status === "Assigned"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                Assigned
              </button>
              <button
                type="button"
                onClick={() => setStatus("Unassigned")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  status === "Unassigned"
                    ? "bg-destructive text-destructive-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                Unassigned
              </button>
            </div>
          </div>

          {status === "Assigned" && (
            <>
              {/* Machine */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Assigned Machine
                </label>
                <select
                  value={machineCode}
                  onChange={(e) => setMachineCode(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground font-mono"
                >
                  {machines.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} — {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reject Type */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Reject Defect Type
                </label>
                <select
                  value={rejectTypeId}
                  onChange={(e) => setRejectTypeId(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
                >
                  {REJECT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground text-xs px-6">
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
