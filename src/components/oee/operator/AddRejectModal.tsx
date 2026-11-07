import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { REJECT_TYPES } from "@/lib/oee/rejectConfig";
import { rejectStore } from "@/lib/oee/rejectStore";
import { getShiftInfo } from "@/lib/oee/shiftClock";
import { toast } from "sonner";

export function AddRejectModal({
  open,
  onOpenChange,
  plantId,
  lineId,
  defaultMachine,
  defaultRejectTypeId,
  machines,
  shiftKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string;
  lineId: string;
  defaultMachine: string;
  defaultRejectTypeId: string;
  machines: { code: string; name: string }[];
  shiftKey: string;
}) {
  const [machineCode, setMachineCode] = useState(defaultMachine || machines[0]?.code || "LCM07");
  const [category, setCategory] = useState<"Reject" | "Rework">("Reject");
  const [rejectTypeId, setRejectTypeId] = useState(defaultRejectTypeId);
  const [qtyStr, setQtyStr] = useState("1");
  const [timeStr, setTimeStr] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const shiftInfo = getShiftInfo();

  const handleSave = () => {
    setError("");
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty < 1) {
      setError("Quantity must be an integer >= 1");
      return;
    }

    const timeParts = timeStr.split(":").map(Number);
    const hh = timeParts[0];
    const mm = timeParts[1];
    if (hh === undefined || mm === undefined || isNaN(hh) || isNaN(mm)) {
      setError("Invalid time format (HH:MM)");
      return;
    }

    const todayDate = new Date(shiftInfo.startSec * 1000);
    todayDate.setHours(hh, mm, 0, 0);
    const atSec = Math.floor(todayDate.getTime() / 1000);

    if (atSec > Math.floor(Date.now() / 1000)) {
      setError("Estimated time cannot be in the future.");
      return;
    }

    const rejectTypeObj = REJECT_TYPES.find((t) => t.id === rejectTypeId) || REJECT_TYPES[0];
    if (!rejectTypeObj) return;

    const finalCategory = category === "Rework" ? "Rework" : rejectTypeObj.category;
    const finalTypeId = category === "Rework" ? "rework" : rejectTypeObj.id;
    const finalTypeName = category === "Rework" ? "Rework" : rejectTypeObj.name;

    rejectStore.addManualReject({
      plantId,
      lineId,
      machineCode,
      rejectTypeId: finalTypeId,
      rejectTypeName: finalTypeName,
      qty,
      at: atSec,
      note: notes,
      category: finalCategory,
      shiftKey,
    });

    toast.success("Manual reject added successfully!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Add Reject / Rework</DialogTitle>
          <DialogDescription>
            Record manual reject items or rework counts not captured by sensors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Machine */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Machine</label>
            <select
              value={machineCode}
              onChange={(e) => setMachineCode(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
            >
              {machines.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Toggle */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Category
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategory("Reject")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  category === "Reject"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => setCategory("Rework")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  category === "Rework"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                Rework
              </button>
            </div>
          </div>

          {/* Reject Type (if Reject) */}
          {category === "Reject" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Reject Type
              </label>
              <select
                value={rejectTypeId}
                onChange={(e) => setRejectTypeId(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
              >
                {REJECT_TYPES.filter((t) => t.category === "Reject").map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Quantity (pcs)
            </label>
            <Input
              type="number"
              min={1}
              value={qtyStr}
              onChange={(e) => setQtyStr(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Time */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Time Occurred (HH:MM)
            </label>
            <Input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Notes (Optional)
            </label>
            <Textarea
              placeholder="Reason for manual entry..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs h-16"
            />
          </div>

          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>

        <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground text-xs px-6">
            Add Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
