import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { srrBlockStore, useSrrBlockOpen } from "@/lib/oee/srrBlockStore";

/** Shown when the Reason tab is opened while the SRR Line of the line is missing (SRR_BLOCKED_TABS). */
export function SrrBlockedModal() {
  const open = useSrrBlockOpen();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && srrBlockStore.close()}>
      <DialogContent className="sm:max-w-md" data-testid="srr-blocked-modal">
        <DialogHeader>
          <DialogTitle>SRR Line belum diterapkan</DialogTitle>
          <DialogDescription>
            SRR Line belum ditentukan di master data Asset Management untuk line/mesin bottleneck ini, sehingga
            tab Reason belum dapat dipakai. Hubungi tim Asset Management untuk melengkapi master data. Dashboard
            hanya menampilkan monitoring IDW sampai SRR Line diterapkan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button data-testid="srr-blocked-ok" onClick={() => srrBlockStore.close()}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
