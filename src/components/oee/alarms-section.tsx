import { Panel } from "@/components/oee/ui";
import { type Line, type Plant } from "@/lib/oee/data";
import { type ResolvedPeriod } from "@/lib/oee/period";
import { useAlarms } from "@/lib/oee/alarm-service";
import { cn } from "@/lib/utils";

export function PlantAlarmsSection({
  plant,
  resolved,
}: {
  plant: Plant;
  resolved: ResolvedPeriod;
}) {
  const { alarms } = useAlarms({ plant, resolved });

  const occurring = alarms.filter((a) => a.status === "OCCURRING").length;
  const resolvedCount = alarms.length - occurring;

  const resolvedWording =
    resolved.periodKey === "this-shift"
      ? "resolved this shift"
      : resolved.periodKey === "today"
        ? "resolved today"
        : resolved.periodKey === "this-week"
          ? "resolved this week"
          : resolved.periodKey === "this-month"
            ? "resolved this month"
            : "resolved in selected period";

  return (
    <Panel
      title="Alarms"
      subtitle={`${occurring} occurring · ${resolvedCount} ${resolvedWording}`}
      className="min-h-0 max-h-[420px] lg:max-h-none"
      bodyClassName="p-0 overflow-hidden"
    >
      <div className="min-h-0 flex-1 w-full min-w-0 overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[760px] text-[11px]">
          <thead className="sticky top-0 bg-surface text-left text-muted-foreground z-10 shadow-xs">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 font-medium">Machine</th>
              <th className="px-3 py-2 font-medium">Issue</th>
              <th className="px-3 py-2 font-medium">L2 Category</th>
              <th className="px-3 py-2 font-medium">L3 Reason</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">Duration</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {alarms.map((a) => {
              const isUntagged = !a.isTagged || a.l2Category === "Not Tagged Yet";
              return (
                <tr key={a.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono font-medium">{a.lineId}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{a.machineId}</td>
                  <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={a.issue}>
                    {a.issue}
                  </td>
                  <td className="px-3 py-2">
                    {isUntagged ? (
                      <span className="italic text-amber-500/90 text-[10px]">Not Tagged Yet</span>
                    ) : (
                      <span className="text-foreground">{a.l2Category}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isUntagged ? (
                      <span className="italic text-amber-500/90 text-[10px]">Not Tagged Yet</span>
                    ) : (
                      <span className="text-muted-foreground">{a.l3Reason}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                        a.source === "PLC"
                          ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          : "bg-purple-500/15 text-purple-400 border-purple-500/30",
                      )}
                    >
                      {a.source || "Non-PLC"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{a.start}</td>
                  <td className="px-3 py-2 font-mono">{a.durationMinutes} min</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        a.status === "OCCURRING"
                          ? "bg-tier-bad/15 text-tier-bad animate-pulse"
                          : "bg-grid text-muted-foreground",
                      )}
                    >
                      {a.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {alarms.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-muted-foreground">
                  No downtime alarms {resolvedWording}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function LineAlarmsSection({
  line,
  plantId,
  resolved,
}: {
  line: Line;
  plantId?: string;
  resolved: ResolvedPeriod;
}) {
  const { alarms, includesCurrentDay } = useAlarms({ line, resolved });

  return (
    <Panel
      title={includesCurrentDay ? "Active Alarms" : "Alarms"}
      subtitle="Downtime events (no output for more than 10 minutes)"
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {alarms.map((a) => {
          const isUntagged = !a.isTagged || a.l2Category === "Not Tagged Yet";
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 text-[11px] hover:bg-muted/20"
            >
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  a.severity === "CRITICAL"
                    ? "bg-tier-bad/15 text-tier-bad"
                    : "bg-tier-warn/20 text-tier-warn",
                )}
              >
                {a.severity}
              </span>
              <span className="font-mono font-medium">
                {a.lineId}·{a.machineId}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                  a.source === "PLC"
                    ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                    : "bg-purple-500/15 text-purple-400 border-purple-500/30",
                )}
              >
                {a.source || "Non-PLC"}
              </span>
              <span className="font-mono text-muted-foreground whitespace-nowrap">{a.start}</span>
              <span className="flex-1 min-w-[140px] font-medium">{a.issue}</span>
              <div className="flex items-center gap-1.5 text-[10px]">
                {isUntagged ? (
                  <span className="italic text-amber-500/90 rounded px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20">
                    Not Tagged Yet
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-medium">{a.l2Category}</span> ›{" "}
                    {a.l3Reason}
                  </span>
                )}
              </div>
              <span className="font-mono text-muted-foreground whitespace-nowrap">
                {a.durationMinutes} min
              </span>
              <span
                className={cn(
                  "font-semibold uppercase text-[10px]",
                  a.status === "OCCURRING" ? "text-tier-bad font-bold" : "text-muted-foreground",
                )}
              >
                {a.status}
              </span>
            </li>
          );
        })}
        {alarms.length === 0 && (
          <li className="p-4 text-center text-xs text-muted-foreground">
            No downtime alarms in selected period
          </li>
        )}
      </ul>
    </Panel>
  );
}
