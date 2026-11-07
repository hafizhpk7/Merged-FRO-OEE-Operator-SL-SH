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
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export function QaInspectionModal({
  open,
  sampleNo,
  onSubmitInspection,
}: {
  open: boolean;
  sampleNo: number;
  onSubmitInspection: (result: "Released" | "Reject", note: string) => void;
}) {
  const [result, setResult] = useState<"Released" | "Reject">("Released");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    onSubmitInspection(result, note);
    toast.success(`QA Inspection Sample #${sampleNo} submitted as ${result}.`);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md p-6 border-amber-500/50 shadow-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-amber-600">
                QA INSPECTION REQUIRED
              </DialogTitle>
              <DialogDescription className="text-xs">
                Sample no. {sampleNo} — Take FG sample from line and verify quality.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Production output has reached the threshold interval. Please pull a finished good
            sample, inspect sealing and appearance, and select inspection status below.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Inspection Result
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setResult("Released")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold transition-colors ${
                  result === "Released"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "border border-border bg-card text-foreground hover:bg-emerald-500/10"
                }`}
              >
                <CheckCircle2 className="size-4" /> RELEASED
              </button>
              <button
                type="button"
                onClick={() => setResult("Reject")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold transition-colors ${
                  result === "Reject"
                    ? "bg-red-600 text-white shadow-xs"
                    : "border border-border bg-card text-foreground hover:bg-red-500/10"
                }`}
              >
                <XCircle className="size-4" /> REJECT
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Notes (Optional)
            </label>
            <Textarea
              placeholder="Add inspection quality notes..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs h-16"
            />
          </div>
        </div>

        <DialogFooter className="mt-2 flex sm:justify-end">
          <Button
            onClick={handleSubmit}
            className={`w-full text-xs font-bold py-2 ${
              result === "Released"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            Submit QA Inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
