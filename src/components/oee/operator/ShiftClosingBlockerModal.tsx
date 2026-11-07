import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { END_SHIFT_BLOCK_MODE } from "@/lib/oee/reasonConstants";

export function ShiftClosingBlockerModal({
  open,
  onOpenChange,
  unclassifiedMin,
  onClassifyNow,
  onFinishAnyway,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unclassifiedMin: number;
  onClassifyNow: () => void;
  onFinishAnyway: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="size-6 shrink-0" />
            <DialogTitle className="text-lg font-bold">Unclassified Losses Pending</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-foreground/80 leading-relaxed pt-1">
            There are <strong>{unclassifiedMin} minutes</strong> of downtime/minor stop/speed loss
            not classified yet. Please complete classification before ending the shift to ensure
            accurate OEE records.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="default"
            onClick={() => {
              onOpenChange(false);
              onClassifyNow();
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 px-4"
          >
            Classify now
          </Button>

          {END_SHIFT_BLOCK_MODE === "soft" && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onFinishAnyway();
              }}
              className="text-xs font-medium h-9 border-border"
            >
              Finish anyway
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
