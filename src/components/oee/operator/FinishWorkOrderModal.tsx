import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function FinishWorkOrderModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isFinishing, setIsFinishing] = useState(false);

  const handleConfirm = () => {
    setIsFinishing(true);
    setTimeout(() => {
      setIsFinishing(false);
      onOpenChange(false);
      toast.success("Work order finished successfully", {
        description: "Shift summary and production counts have been saved.",
        icon: <CheckCircle2 className="size-5 text-emerald-500" />,
      });
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finish Work Order</DialogTitle>
          <DialogDescription>
            Are you sure you want to finish the current work order? This action will summarize all
            30-second window records and complete the shift log.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isFinishing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isFinishing}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isFinishing ? "Finishing..." : "Confirm Finish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
