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
import { rejectStore, type RejectLog } from "@/lib/oee/rejectStore";
import { formatTimeWib } from "@/lib/oee/shiftClock";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function RemoveRejectModal({
  open,
  onOpenChange,
  logs,
  rejectTypeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: RejectLog[];
  rejectTypeName: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleRemove = () => {
    if (selectedIds.length === 0) return;
    rejectStore.removeLogs(selectedIds);
    toast.success(`Removed ${selectedIds.length} reject log entries.`);
    setSelectedIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle>Remove Reject — {rejectTypeName}</DialogTitle>
          <DialogDescription>
            Select incorrect or duplicate log entries to remove from count corrections.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-2.5 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(logs.map((l) => l.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      checked={logs.length > 0 && selectedIds.length === logs.length}
                    />
                  </th>
                  <th className="p-2.5">Machine</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Qty</th>
                  <th className="p-2.5">Source</th>
                  <th className="p-2.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No log entries found for this reject type.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-accent/50">
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(log.id)}
                          onChange={() => toggleSelect(log.id)}
                        />
                      </td>
                      <td className="p-2.5 font-mono">{log.machineCode}</td>
                      <td className="p-2.5 font-medium">{log.rejectTypeName}</td>
                      <td className="p-2.5 font-mono font-bold text-red-600">{log.qty} pcs</td>
                      <td className="p-2.5 uppercase text-[10px] font-semibold">
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            log.source === "manual"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {log.source}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-muted-foreground">
                        {formatTimeWib(log.at * 1000, true)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{selectedIds.length} row(s) selected</span>
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={selectedIds.length === 0}
            onClick={handleRemove}
            className="text-xs px-4"
          >
            <Trash2 className="size-3.5 mr-1.5" /> Remove Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
