import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricId = "OEE" | "Availability" | "Performance" | "Quality";

export const METRICS_ORDER: MetricId[] = ["OEE", "Availability", "Performance", "Quality"];

export const METRIC_CONFIG: Record<MetricId, { label: string; stroke: string; dot: string }> = {
  OEE: {
    label: "OEE",
    stroke: "var(--primary)",
    dot: "#3b82f6",
  },
  Availability: {
    label: "Availability",
    stroke: "var(--tier-good)",
    dot: "#10b981",
  },
  Performance: {
    label: "Performance",
    stroke: "var(--tier-warn)",
    dot: "#f59e0b",
  },
  Quality: {
    label: "Quality",
    stroke: "var(--loss-quality)",
    dot: "#a855f7",
  },
};

export interface MetricDropdownProps {
  selected: MetricId[];
  onChange: (selected: MetricId[]) => void;
  disabled?: boolean;
}

export function MetricDropdown({ selected, onChange, disabled = false }: MetricDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus management when keyboard navigating options
  useEffect(() => {
    if (isOpen && optionsRef.current[focusedIndex]) {
      optionsRef.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  const toggleMetric = (id: MetricId) => {
    const isSelected = selected.includes(id);

    if (isSelected) {
      // Minimum selection rule: at least ONE metric must remain selected
      if (selected.length <= 1) {
        return; // Ignore click if trying to uncheck the last selected metric
      }
      onChange(selected.filter((item) => item !== id));
    } else {
      const nextSelected = [...selected, id];
      // Keep fixed order: OEE, Availability, Performance, Quality
      nextSelected.sort((a, b) => METRICS_ORDER.indexOf(a) - METRICS_ORDER.indexOf(b));
      onChange(nextSelected);
    }
  };

  const handleSelectAll = () => {
    onChange([...METRICS_ORDER]);
  };

  const summaryText = () => {
    if (selected.length === 4) return "All metrics";
    if (selected.length === 1) return selected[0];
    return selected.join(", ");
  };

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(0);
    }
  };

  const handleOptionKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number, id: MetricId) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % METRICS_ORDER.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + METRICS_ORDER.length) % METRICS_ORDER.length);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggleMetric(id);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select trend metrics"
        className={cn(
          "inline-flex w-[160px] sm:w-[170px] items-center justify-between gap-1 rounded border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <span className="truncate text-left">{summaryText()}</span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform duration-150",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Select trend metrics"
          tabIndex={-1}
          className="absolute right-0 top-full mt-1 z-50 w-[190px] rounded-md border border-border bg-surface p-1.5 shadow-lg flex flex-col gap-0.5"
        >
          {METRICS_ORDER.map((id, index) => {
            const isSelected = selected.includes(id);
            const isLastSelected = isSelected && selected.length === 1;

            return (
              <div
                key={id}
                ref={(el) => {
                  optionsRef.current[index] = el;
                }}
                role="option"
                tabIndex={0}
                aria-selected={isSelected}
                aria-disabled={isLastSelected}
                onClick={() => toggleMetric(id)}
                onKeyDown={(e) => handleOptionKeyDown(e, index, id)}
                className={cn(
                  "flex items-center gap-2 w-full rounded px-2 py-1.5 text-[11px] font-medium text-left transition-colors cursor-pointer select-none outline-none focus:bg-muted/70",
                  isLastSelected
                    ? "aria-disabled:opacity-60 aria-disabled:cursor-not-allowed hover:bg-transparent"
                    : "hover:bg-muted/60 text-foreground",
                )}
              >
                <div
                  className={cn(
                    "size-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border bg-surface",
                  )}
                >
                  {isSelected && <Check className="size-2.5 stroke-[3]" />}
                </div>

                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: METRIC_CONFIG[id].dot }}
                />

                <span className="truncate flex-1">{id}</span>
              </div>
            );
          })}

          <div className="my-1 border-t border-border" />

          <button
            type="button"
            onClick={handleSelectAll}
            className="w-full text-left px-2 py-1 text-[10px] font-semibold text-primary hover:underline hover:bg-muted/40 rounded transition-colors"
          >
            Select all
          </button>
        </div>
      )}
    </div>
  );
}
