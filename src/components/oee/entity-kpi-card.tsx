import { ArrowDown, ArrowUp } from "lucide-react";
import { Donut, MetricBar } from "@/components/oee/ui";
import { TIER_TEXT, tierOf } from "@/lib/oee/config";
import { cn } from "@/lib/utils";

export interface EntityKpiCardProps {
  name: string;
  subtitle?: string;
  donutValue: number;
  donutLabel?: string;
  oeeValue: number;
  deltaValue: number;
  compareLabel?: string;
  availability: number;
  performance: number;
  quality: number;
  onClick?: () => void;
  dataMetric?: string;
  dataRaw?: number | string;
  className?: string;
}

export function EntityKpiCard({
  name,
  subtitle,
  donutValue,
  donutLabel,
  oeeValue,
  deltaValue,
  compareLabel,
  availability,
  performance,
  quality,
  onClick,
  dataMetric,
  dataRaw,
  className,
}: EntityKpiCardProps) {
  const isUp = deltaValue >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col justify-between rounded-lg border border-border bg-surface p-3 text-left transition-all hover:border-primary hover:shadow-xs cursor-pointer min-w-0 w-full h-full",
        className,
      )}
    >
      {/* Row 1: Entity Name & Subtitle */}
      <div className="flex items-start justify-between gap-2 w-full">
        <h4
          className="line-clamp-2 text-xs font-semibold text-foreground leading-snug min-w-0"
          title={name}
        >
          {name}
        </h4>
        {subtitle && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
            {subtitle}
          </span>
        )}
      </div>

      {/* Row 2: Donut + OEE Value & Delta */}
      <div className="flex items-center gap-3 my-2.5 w-full">
        <div className="shrink-0">
          <Donut value={donutValue} size={64} label={donutLabel} />
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              OEE
            </span>
            <span
              data-metric={dataMetric}
              data-raw={dataRaw !== undefined ? dataRaw : oeeValue}
              className={cn(
                "font-mono text-xl font-bold leading-tight tabular-nums",
                TIER_TEXT[tierOf(oeeValue)],
              )}
            >
              {oeeValue.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-mono font-semibold shrink-0 tabular-nums",
                isUp ? "text-tier-good" : "text-tier-bad",
              )}
            >
              {isUp ? (
                <ArrowUp className="size-3 stroke-[2.5]" />
              ) : (
                <ArrowDown className="size-3 stroke-[2.5]" />
              )}
              {isUp ? "+" : "-"}
              {Math.abs(deltaValue).toFixed(1)}%
            </span>
            {compareLabel && (
              <span className="text-[10px] text-muted-foreground font-sans leading-tight">
                {compareLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rows 3-5: Availability, Performance, Quality */}
      <div className="w-full space-y-1.5 pt-2 border-t border-border/50">
        <MetricBar label="Availability" value={availability} />
        <MetricBar label="Performance" value={performance} />
        <MetricBar label="Quality" value={quality} />
      </div>
    </button>
  );
}
