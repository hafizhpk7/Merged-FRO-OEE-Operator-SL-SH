import { useNavigate } from "@tanstack/react-router";
import { LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { srrStore, useSrrMode } from "@/lib/oee/srrStore";
import { useTargetSnapshot } from "./useTargetSnapshot";

/**
 * CR 5 SR-01: universal on/off switch in the Dashboard header with two coloured positions,
 * SRR Line (default, active) and SRR SKU. The text follows the selected position and the standard
 * value (pcs/min) sits beside it. The "Realisasi per jam" button opens the hourly page (CR 5 part B).
 */
export function SrrSwitch({ plantId, lineId }: { plantId: string; lineId: string }) {
  const mode = useSrrMode();
  const navigate = useNavigate();
  const snap = useTargetSnapshot(plantId, lineId);
  const cur = snap.result.current ?? snap.result.segments[0] ?? null;
  const isLine = mode === "LINE";
  const std = isLine ? snap.srrLine : (cur?.skuSrr ?? null);

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="srr-controls">
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={!isLine}
          aria-label="Switch standard run rate"
          data-testid="srr-switch"
          data-mode={mode}
          onClick={() => srrStore.set(isLine ? "SKU" : "LINE")}
          className={`relative flex h-8 min-w-28 items-center rounded-full px-3 text-[11px] font-bold text-white transition-colors ${
            isLine ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-700 hover:bg-blue-800"
          }`}
        >
          <span className={isLine ? "mr-6" : "ml-6"} data-testid="srr-switch-label">
            {isLine ? "SRR Line" : "SRR SKU"}
          </span>
          <span
            className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${
              isLine ? "right-1" : "left-1"
            }`}
          />
        </button>
        <span className="font-mono text-xs font-bold text-foreground" data-testid="srr-value">
          {std ? `${std} pcs/min` : "-"}
          {!isLine && cur && std ? (
            <span className="ml-1 font-sans text-[10px] font-semibold text-muted-foreground">
              ({cur.skuLabel})
            </span>
          ) : null}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        data-testid="realisasi-button"
        onClick={() =>
          void navigate({ to: "/operator/$plantId/$lineId/hourly", params: { plantId, lineId } })
        }
        className="h-8 gap-1.5 text-xs font-semibold"
      >
        <LayoutList className="size-3.5" />
        Realisasi per jam
      </Button>
    </div>
  );
}
