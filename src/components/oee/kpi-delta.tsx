import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiDeltaProps {
  /** Metric identifier (e.g. 'oee', 'availability', 'stops', 'rejects') */
  metric?: string;
  /** Current period value */
  current?: number;
  /** Comparison period value */
  compare?: number;
  /** Pre-calculated delta value (current - compare) */
  delta?: number;
  /** Comparison text label (e.g. 'vs last shift', 'vs yesterday') */
  label?: string;
  /** Suffix to append to delta value (default: '%') */
  suffix?: string;
  /** Whether lower values are better (inverts green/red colors) */
  inverted?: boolean;
  className?: string;
}

/**
 * Standardized KPI Delta row displaying trend arrow, percentage/value difference, and comparison window label.
 * Higher-is-better metrics: up = green, down = red.
 * Lower-is-better metrics (stops, losses, defects): up = red, down = green.
 */
export function KpiDelta({
  metric,
  current,
  compare,
  delta,
  label,
  suffix = "%",
  inverted = false,
  className,
}: KpiDeltaProps) {
  let diff = delta;
  if (diff === undefined && current !== undefined && compare !== undefined) {
    diff = Math.round((current - compare) * 10) / 10;
  }

  if (diff === undefined) {
    return null;
  }

  // Auto-detect lower-is-better metrics
  const isLowerBetter =
    inverted || (metric && /stop|loss|reject|defect|scrap|downtime|lines down|down/i.test(metric));

  const isPositive = diff > 0;
  const isZero = Math.abs(diff) < 0.001;
  const isGood = isLowerBetter ? !isPositive : isPositive;

  const colorClass = isZero
    ? "text-muted-foreground"
    : isGood
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <div className={cn("inline-flex flex-col items-start gap-0.5 min-w-0 select-none", className)}>
      <div
        className={cn(
          "inline-flex items-center gap-0.5 font-mono text-[11px] font-medium tabular-nums",
          colorClass,
        )}
      >
        {!isZero &&
          (isPositive ? (
            <ArrowUp className="size-3 shrink-0 stroke-[2.5]" />
          ) : (
            <ArrowDown className="size-3 shrink-0 stroke-[2.5]" />
          ))}
        <span>
          {isPositive ? "+" : isZero ? "" : "-"}
          {Math.abs(diff).toFixed(1)}
          {suffix}
        </span>
      </div>
      {label && (
        <span className="block font-sans text-[10px] text-muted-foreground leading-tight tracking-normal truncate max-w-full">
          {label}
        </span>
      )}
    </div>
  );
}
