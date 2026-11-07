import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export type CountLogItem = {
  id: string;
  type: "INNERBOX" | "KARBOX" | "PALLET";
  count: number;
  at: string;
};

export function CounterDetailModal({
  open,
  onOpenChange,
  logs,
  onDeleteLast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: CountLogItem[];
  onDeleteLast: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <DialogTitle>Counter Detail — IDW Weigher Logs</DialogTitle>
          <DialogDescription>
            Recent automated packaging count logs and manual deletions for Inner Box and Carton Box.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="max-h-60 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-2.5">Level</th>
                  <th className="p-2.5">Count</th>
                  <th className="p-2.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground">
                      No count logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => (
                    <tr key={item.id} className="hover:bg-accent/50">
                      <td className="p-2.5 font-semibold text-foreground">{item.type}</td>
                      <td className="p-2.5 font-mono font-bold text-primary">{item.count} pcs</td>
                      <td className="p-2.5 text-right font-mono text-muted-foreground">
                        {item.at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Are you sure you want to delete the last counted Inner/Carton box?")) {
                onDeleteLast();
                toast.success("Last count deleted successfully.");
              }
            }}
            disabled={logs.length === 0}
            className="text-xs"
          >
            <Trash2 className="size-3.5 mr-1" /> Delete Last Count
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
