import { type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiItem {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  comparisonText?: string;
  trend?: "up" | "down" | "neutral";
  delta?: {
    text: string;
    tone: "positive" | "negative" | "neutral";
  };
  subText?: string;
  emphasized?: boolean;
}

export interface KpiStripProps {
  items: KpiItem[];
  ariaLabel: string;
  isLoading?: boolean;
  className?: string;
  /** Responsive columns layout: 6 for Loss Anatomy, 5 for Pareto */
  columnsDesktop?: 5 | 6;
}

export function KpiStrip({
  items,
  ariaLabel,
  isLoading,
  className,
  columnsDesktop = 6,
}: KpiStripProps) {
  if (isLoading) {
    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn(
          "overflow-hidden rounded-xl border border-border/80 bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
          className,
        )}
      >
        <div
          className={cn(
            "grid w-full divide-y md:divide-y-0 md:divide-x divide-border/60",
            columnsDesktop === 6
              ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
              : "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
          )}
        >
          {Array.from({ length: columnsDesktop }).map((_, i) => (
            <div key={i} className="p-4 space-y-2 animate-pulse">
              <div className="h-3 w-16 bg-muted/60 rounded" />
              <div className="h-7 w-24 bg-muted/80 rounded" />
              <div className="h-3 w-28 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors",
        className,
      )}
    >
      <div
        className={cn(
          "grid w-full divide-y md:divide-y-0 md:divide-x divide-border/60",
          columnsDesktop === 6
            ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
            : "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
        )}
      >
        {items.map((item) => {
          const isNoData = item.value === "—" || item.value === undefined || item.value === null;

          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col justify-between p-3.5 sm:p-4 min-w-0 transition-colors",
                item.emphasized
                  ? "bg-[#F0F7F2] dark:bg-emerald-950/30 border border-emerald-600/20 dark:border-emerald-800/40 rounded-lg m-1 p-3 sm:p-3.5"
                  : "",
              )}
            >
              {/* Label */}
              <div className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate tracking-tight">
                {item.label}
              </div>

              {/* Value + Unit */}
              <div className="my-1 flex items-baseline gap-1">
                <span className="font-mono text-2xl sm:text-[28px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                  {item.value}
                </span>
                {item.unit && !isNoData && (
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground font-sans">
                    {item.unit}
                  </span>
                )}
              </div>

              {/* Comparison line, Directional Trend Arrow, or SubText */}
              <div className="min-h-[18px] flex flex-col justify-end">
                {!isNoData && (item.comparisonText || item.trend) && (
                  <div className="flex items-center gap-1 text-[11px] font-sans text-muted-foreground/90 truncate">
                    {item.trend === "up" && (
                      <ArrowUp className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.5]" />
                    )}
                    {item.trend === "down" && (
                      <ArrowDown className="size-3 text-red-600 dark:text-red-400 shrink-0 stroke-[2.5]" />
                    )}
                    {item.comparisonText && <span>{item.comparisonText}</span>}
                  </div>
                )}

                {!isNoData && item.subText && (
                  <span
                    className={cn(
                      "text-[11px] font-mono truncate",
                      item.emphasized
                        ? "text-emerald-800/80 dark:text-emerald-300/80 font-medium"
                        : "text-muted-foreground/80",
                    )}
                  >
                    {item.subText}
                  </span>
                )}

                {!isNoData && item.delta && !item.trend && (
                  <div
                    className={cn(
                      "text-xs font-bold font-mono tabular-nums tracking-tight mt-0.5",
                      item.delta.tone === "positive" && "text-emerald-600 dark:text-emerald-400",
                      item.delta.tone === "negative" && "text-red-600 dark:text-red-400",
                      item.delta.tone === "neutral" && "text-muted-foreground",
                    )}
                  >
                    {item.delta.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
