import React, { useMemo } from "react";
import { getOperationalParameters } from "@/lib/oee/machineTelemetry";
import type { ShiftSnapshot } from "@/lib/oee/machineEvents";
import { cn } from "@/lib/utils";

export interface OperationalParametersTableProps {
  machineCode: string;
  snapshot: ShiftSnapshot;
  tickSec: number;
  className?: string;
}

export function OperationalParametersTable({
  machineCode,
  snapshot,
  tickSec,
  className,
}: OperationalParametersTableProps) {
  const groups = useMemo(() => {
    return getOperationalParameters(machineCode, snapshot, tickSec);
  }, [machineCode, snapshot, tickSec]);

  const totalReadings = groups.reduce((acc, g) => acc + g.readings.length, 0);

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-surface shadow-xs overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2.5 bg-surface/90">
        <div>
          <h3 className="text-xs font-bold text-foreground">Operational parameters</h3>
          <p className="text-[10px] text-muted-foreground">
            Values outside configured band are flagged as Watch
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono font-medium">{totalReadings} readings</span>
          <span>·</span>
          <span className="font-mono text-[11px] text-primary font-semibold">2s refresh</span>
        </div>
      </div>

      {/* 3 Tables Side by Side (Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-surface">
        {groups.map((grp) => (
          <div key={grp.groupName} className="flex flex-col p-3">
            <h4 className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              <span>{grp.groupName}</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] uppercase text-muted-foreground">
                    <th className="py-1 font-semibold">Parameter</th>
                    <th className="py-1 text-right font-semibold">Current</th>
                    <th className="py-1 text-right font-semibold">Band</th>
                    <th className="py-1 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {grp.readings.map((r) => {
                    const isWatch = r.status === "Watch";
                    return (
                      <tr key={r.key} className="hover:bg-muted/30 transition-colors">
                        <td className="py-1.5 text-foreground/90 font-medium text-xs">{r.name}</td>
                        <td
                          className={cn(
                            "py-1.5 text-right font-mono text-xs font-bold",
                            isWatch ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {typeof r.current === "number" ? r.current.toLocaleString() : r.current}{" "}
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {r.unit}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-mono text-[11px] text-muted-foreground">
                          {r.band}
                        </td>
                        <td className="py-1.5 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                              isWatch
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : "bg-tier-good/15 text-tier-good border border-tier-good/30",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                isWatch ? "bg-amber-500" : "bg-tier-good",
                              )}
                            />
                            <span>{r.status}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
