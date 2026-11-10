import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { srrBlockStore, useSrrBlockOpen } from "@/lib/oee/srrBlockStore";
import { useLineOperationalMode } from "@/lib/oee/assetMaster";

/** Shown when the Reason tab is opened while the SRR Line of the line is missing (SRR_BLOCKED_TABS). */
export function SrrBlockedModal({ plantId, lineId }: { plantId: string; lineId: string }) {
  const open = useSrrBlockOpen();
  const notPilot = useLineOperationalMode(plantId, lineId).reason === "not-pilot";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && srrBlockStore.close()}>
      <DialogContent className="sm:max-w-md" data-testid="srr-blocked-modal">
        <DialogHeader>
          <DialogTitle>{notPilot ? "OEE belum aktif untuk line ini" : "SRR Line belum diterapkan"}</DialogTitle>
          <DialogDescription>
            {notPilot
              ? `Line ${lineId} belum menjadi line pilot SCADA, sehingga hanya monitoring IDW yang tersedia dan tab Reason tidak dapat dipakai.`
              : "SRR Line belum ditentukan di master data Asset Management untuk line/mesin bottleneck ini, sehingga tab Reason belum dapat dipakai. Hubungi tim Asset Management untuk melengkapi master data. Dashboard hanya menampilkan monitoring IDW sampai SRR Line diterapkan."}
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
