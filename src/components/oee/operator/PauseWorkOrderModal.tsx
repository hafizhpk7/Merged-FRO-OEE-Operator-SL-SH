import { toast } from "sonner";
import { PauseCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Mock Pause Work Order (CR 5 TG-04): confirmation + toast; paused time still counts as running time. */
export function PauseWorkOrderModal({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="pause-modal">
        <DialogHeader>
          <DialogTitle>Pause Work Order</DialogTitle>
          <DialogDescription>
            Work order akan dijeda. Waktu pause tetap dihitung sebagai waktu berjalan pada target
            output, sehingga kerugian waktu tetap terlihat.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="pause-confirm"
            className="bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
              toast.info("Work order dijeda", {
                description: "Waktu pause tetap dihitung sebagai waktu berjalan.",
                icon: <PauseCircle className="size-5 text-amber-500" />,
              });
            }}
          >
            Confirm Pause
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
