import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { simConfirmStore, usePendingDensity } from "@/lib/oee/simControls";

/** Confirmation before the event density changes: tags, corrections, QA counters and summarization are reset. */
export function SimDensityConfirm() {
  const pending = usePendingDensity();
  return (
    <Dialog open={pending !== null} onOpenChange={(o) => !o && simConfirmStore.cancel()}>
      <DialogContent className="sm:max-w-md" data-testid="density-confirm">
        <DialogHeader>
          <DialogTitle>Ubah event density ke "{pending}"?</DialogTitle>
          <DialogDescription>
            Event dibuat ulang dengan total menit loss yang sama. Tagging, koreksi reject, counter QA dan data
            summarization akan direset.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => simConfirmStore.cancel()}>
            Batal
          </Button>
          <Button data-testid="density-confirm-ok" onClick={() => simConfirmStore.confirm()}>
            Ubah dan reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
