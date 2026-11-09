import { Activity, Percent } from "lucide-react";
import type { ShiftSnapshot } from "@/lib/oee/machineEvents";

export function OperatorOeeStrip({ snapshot }: { snapshot: ShiftSnapshot }) {
  const oee = snapshot.oee !== null ? `${snapshot.oee.toFixed(2)}%` : "0.00%";
  const avail = snapshot.availability !== null ? `${snapshot.availability.toFixed(2)}%` : "0.00%";
  const perf = snapshot.performance !== null ? `${snapshot.performance.toFixed(2)}%` : "0.00%";
  const qual = snapshot.quality !== null ? `${snapshot.quality.toFixed(2)}%` : "0.00%";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Activity className="size-4" />
        </span>
        <span className="text-xs font-bold tracking-tight uppercase text-foreground">
          Shift OEE Performance ({snapshot.machineCode})
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 rounded-md bg-background px-3 py-1.5 border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">OEE</span>
          <span className="font-mono text-xs font-bold text-foreground">{oee}</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 rounded-md bg-background px-3 py-1.5 border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Availability
          </span>
          <span className="font-mono text-xs font-bold text-foreground">{avail}</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 rounded-md bg-background px-3 py-1.5 border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Performance
          </span>
          <span className="font-mono text-xs font-bold text-foreground">{perf}</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 rounded-md bg-background px-3 py-1.5 border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Quality</span>
          <span className="font-mono text-xs font-bold text-foreground">{qual}</span>
        </div>
      </div>
    </div>
  );
}
