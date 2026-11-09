import { memo, useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Check,
  AlertCircle,
  ArrowLeft,
  Clock,
  Info,
} from "lucide-react";
import { format, startOfDay } from "date-fns";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CUSTOM_RANGE_MAX_DAYS,
  CUSTOM_TIME_MODE,
  PERIOD_OPTIONS,
  usePeriod,
  type CustomRangeConfig,
  type PeriodKey,
} from "@/lib/oee/period";
import { TimeField } from "./time-field";
import { cn } from "@/lib/utils";
import { getNow, getNowMs } from "@/lib/oee/shiftClock";

// Format helper for 2-digit pad
const pad2 = (n: number) => String(n).padStart(2, "0");

export const PeriodDropdown = memo(function PeriodDropdown({ className }: { className?: string }) {
  const { periodKey, setPeriodKey, customRange, setCustomRange, resolved } = usePeriod();

  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<"menu" | "custom">("menu");

  // Helper to parse date string & time string into timestamp
  const parseDateTime = (dateStr: string, timeStr: string): number => {
    if (!dateStr) return NaN;
    const [year, month, day] = dateStr.split("-").map((v) => parseInt(v, 10));
    const [hours, minutes] = (timeStr || "00:00").split(":").map((v) => parseInt(v, 10));
    if (isNaN(year) || isNaN(month) || isNaN(day)) return NaN;
    const d = new Date(
      year,
      month - 1,
      day,
      isNaN(hours) ? 0 : hours,
      isNaN(minutes) ? 0 : minutes,
      0,
      0,
    );
    return d.getTime();
  };

  // Draft state initialized on open or when customRange changes
  const initDrafts = () => {
    const now = getNow();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const sDate = customRange?.startDate ?? defaultStart;
    const eDate = customRange?.endDate ?? now;

    const sDateStr = format(sDate, "yyyy-MM-dd");
    const eDateStr = format(eDate, "yyyy-MM-dd");

    const sTimeStr = customRange?.startTime ?? (customRange ? format(sDate, "HH:mm") : "00:00");
    const eTimeStr =
      customRange?.endTime ??
      (customRange ? format(eDate, "HH:mm") : `${pad2(now.getHours())}:${pad2(now.getMinutes())}`);

    const hasCmp = Boolean(customRange?.hasCustomCompare || customRange?.compareStartDate);
    const cmpAllDay = Boolean(customRange?.compareAllDay);

    const defaultCmpStart = new Date(sDate.getTime() - 7 * 24 * 3600 * 1000);
    const defaultCmpEnd = new Date(eDate.getTime() - 7 * 24 * 3600 * 1000);

    const cmpSDate = customRange?.compareStartDate ?? defaultCmpStart;
    const cmpEDate = customRange?.compareEndDate ?? defaultCmpEnd;

    const cmpSDateStr = format(cmpSDate, "yyyy-MM-dd");
    const cmpEDateStr = format(cmpEDate, "yyyy-MM-dd");

    const cmpSTimeStr =
      customRange?.compareStartTime ?? (customRange ? format(cmpSDate, "HH:mm") : sTimeStr);
    const cmpETimeStr =
      customRange?.compareEndTime ?? (customRange ? format(cmpEDate, "HH:mm") : eTimeStr);

    return {
      sDateStr,
      eDateStr,
      sTimeStr,
      eTimeStr,
      hasCmp,
      cmpAllDay,
      cmpSDateStr,
      cmpEDateStr,
      cmpSTimeStr,
      cmpETimeStr,
    };
  };

  const initial = initDrafts();
  const [startDateStr, setStartDateStr] = useState<string>(initial.sDateStr);
  const [endDateStr, setEndDateStr] = useState<string>(initial.eDateStr);
  const [startTimeStr, setStartTimeStr] = useState<string>(initial.sTimeStr);
  const [endTimeStr, setEndTimeStr] = useState<string>(initial.eTimeStr);

  const [hasCompare, setHasCompare] = useState<boolean>(initial.hasCmp);
  const [compareAllDay, setCompareAllDay] = useState<boolean>(initial.cmpAllDay);
  const [compareStartDateStr, setCompareStartDateStr] = useState<string>(initial.cmpSDateStr);
  const [compareEndDateStr, setCompareEndDateStr] = useState<string>(initial.cmpEDateStr);
  const [compareStartTimeStr, setCompareStartTimeStr] = useState<string>(initial.cmpSTimeStr);
  const [compareEndTimeStr, setCompareEndTimeStr] = useState<string>(initial.cmpETimeStr);

  // Sync draft fields whenever popover opens or customRange updates
  const resetToCurrent = () => {
    const d = initDrafts();
    setStartDateStr(d.sDateStr);
    setEndDateStr(d.eDateStr);
    setStartTimeStr(d.sTimeStr);
    setEndTimeStr(d.eTimeStr);
    setHasCompare(d.hasCmp);
    setCompareAllDay(d.cmpAllDay);
    setCompareStartDateStr(d.cmpSDateStr);
    setCompareEndDateStr(d.cmpEDateStr);
    setCompareStartTimeStr(d.cmpSTimeStr);
    setCompareEndTimeStr(d.cmpETimeStr);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (nextOpen) {
      resetToCurrent();
      setActiveView(periodKey === "custom" ? "custom" : "menu");
    } else {
      setActiveView("menu");
    }
  };

  // Validation rules (continuous range)
  const nowTs = getNowMs();
  const startTs = parseDateTime(startDateStr, startTimeStr);
  const endTs = parseDateTime(endDateStr, endTimeStr);

  let validationError: string | null = null;

  if (isNaN(startTs) || isNaN(endTs)) {
    validationError = "Please select valid dates and times";
  } else if (startTs > nowTs) {
    validationError = "Start cannot be in the future";
  } else if (endTs <= startTs) {
    validationError = "End must be after start";
  } else {
    const spanMs = endTs - startTs;
    const maxSpanMs = CUSTOM_RANGE_MAX_DAYS * 24 * 3600 * 1000;
    if (spanMs > maxSpanMs) {
      validationError = "Maximum range is 1 month (31 days)";
    }
  }

  // Optional compare validation
  let compareValidationError: string | null = null;
  if (hasCompare) {
    const cmpStartTs = parseDateTime(
      compareStartDateStr,
      compareAllDay ? "00:00" : compareStartTimeStr,
    );
    const cmpEndTs = parseDateTime(compareEndDateStr, compareAllDay ? "23:59" : compareEndTimeStr);
    if (isNaN(cmpStartTs) || isNaN(cmpEndTs)) {
      compareValidationError = "Invalid compare period dates";
    } else if (cmpEndTs < cmpStartTs) {
      compareValidationError = "Compare end must be on or after compare start";
    }
  }

  const isInvalid = Boolean(validationError || compareValidationError);

  // Live future-end indicator hint
  const isEndInFuture = !isNaN(endTs) && endTs > nowTs;

  const handleSelectOption = (key: PeriodKey) => {
    if (key === "custom") {
      setActiveView("custom");
    } else {
      setPeriodKey(key);
      setIsOpen(false);
      setActiveView("menu");
    }
  };

  const handleApplyCustom = () => {
    if (isInvalid) return;

    const s = new Date(startTs);
    const e = new Date(endTs);

    let cmpS: Date | undefined;
    let cmpE: Date | undefined;
    if (hasCompare) {
      cmpS = new Date(
        parseDateTime(compareStartDateStr, compareAllDay ? "00:00" : compareStartTimeStr),
      );
      cmpE = new Date(
        parseDateTime(compareEndDateStr, compareAllDay ? "23:59" : compareEndTimeStr),
      );
    }

    const nextConfig: CustomRangeConfig = {
      startDate: s,
      endDate: e,
      startTime: startTimeStr,
      endTime: endTimeStr,
      hasCustomCompare: hasCompare,
      compareAllDay,
      compareStartDate: cmpS,
      compareEndDate: cmpE,
      compareStartTime: compareStartTimeStr,
      compareEndTime: compareEndTimeStr,
    };

    setCustomRange(nextConfig);
    setPeriodKey("custom");
    setIsOpen(false);
    setActiveView("menu");
  };

  const handleCancelCustom = () => {
    resetToCurrent();
    if (periodKey === "custom") {
      setIsOpen(false);
    } else {
      setActiveView("menu");
    }
  };

  const currentLabel =
    periodKey === "custom"
      ? resolved.periodLabel
      : (PERIOD_OPTIONS.find((o) => o.key === periodKey)?.label ?? "This Shift");

  const todayStr = format(getNow(), "yyyy-MM-dd");

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={`Period: ${currentLabel}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer select-none max-w-[280px]"
          >
            <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Period:</span>
            <span className="font-semibold text-foreground truncate">{currentLabel}</span>
            <ChevronDown className="size-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className={cn(
            "p-1 shadow-2xl border-border bg-background max-h-[calc(100vh-80px)] overflow-y-auto z-50",
            activeView === "custom" ? "w-[360px] p-4" : "w-48",
          )}
        >
          {activeView === "menu" ? (
            <div className="flex flex-col gap-0.5">
              {PERIOD_OPTIONS.map((option) => {
                const isSelected = periodKey === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleSelectOption(option.key)}
                    className={cn(
                      "flex items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                      isSelected
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-foreground hover:bg-muted/80",
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/80 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveView("menu")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary cursor-pointer"
                >
                  <ArrowLeft className="size-3.5 text-muted-foreground" />
                  <span>Custom Date Range</span>
                </button>
                <span className="text-[10px] text-muted-foreground font-mono">Max 31 days</span>
              </div>

              {/* Start & End Date & Time Inputs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Start column */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Start Date
                    </label>
                    <input
                      type="date"
                      max={todayStr}
                      value={startDateStr}
                      onChange={(e) => setStartDateStr(e.target.value)}
                      className="w-full rounded border border-border bg-surface px-2.5 py-1 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3 text-muted-foreground" />
                      <span>Start Time</span>
                    </label>
                    <TimeField
                      value={startTimeStr}
                      onChange={setStartTimeStr}
                      className="w-full justify-center py-1"
                    />
                  </div>
                </div>

                {/* End column */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDateStr}
                      onChange={(e) => setEndDateStr(e.target.value)}
                      className="w-full rounded border border-border bg-surface px-2.5 py-1 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3 text-muted-foreground" />
                      <span>End Time</span>
                    </label>
                    <TimeField
                      value={endTimeStr}
                      onChange={setEndTimeStr}
                      className="w-full justify-center py-1"
                    />
                  </div>
                </div>
              </div>

              {/* Live future-end hint */}
              {isEndInFuture && !validationError && (
                <div className="flex items-center gap-1.5 rounded bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 text-[11px] text-sky-700 dark:text-sky-300">
                  <Info className="size-3.5 shrink-0" />
                  <span>Ends now (live) until {endTimeStr}</span>
                </div>
              )}

              {/* Single Validation Error Message */}
              {(validationError || compareValidationError) && (
                <div className="flex items-center gap-1.5 rounded bg-rose-500/10 border border-rose-500/30 px-2.5 py-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{validationError || compareValidationError}</span>
                </div>
              )}

              {/* Custom Compare Section */}
              <div className="border-t border-border/70 pt-2.5 space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasCompare}
                    onChange={(e) => setHasCompare(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span>Custom &quot;Compare to&quot; period</span>
                </label>

                {hasCompare && (
                  <div className="space-y-2.5 rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs">
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={compareAllDay}
                        onChange={(e) => setCompareAllDay(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <span>Compare all day (00:00 to 23:59)</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Compare Start */}
                      <div className="space-y-1.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground">
                            Compare Start
                          </label>
                          <input
                            type="date"
                            max={todayStr}
                            value={compareStartDateStr}
                            onChange={(e) => setCompareStartDateStr(e.target.value)}
                            className="w-full rounded border border-border bg-surface px-2 py-1 text-xs font-mono outline-none focus:border-primary"
                          />
                        </div>
                        {!compareAllDay && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Time</label>
                            <TimeField
                              value={compareStartTimeStr}
                              onChange={setCompareStartTimeStr}
                              className="w-full justify-center py-0.5 text-[11px]"
                            />
                          </div>
                        )}
                      </div>

                      {/* Compare End */}
                      <div className="space-y-1.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground">
                            Compare End
                          </label>
                          <input
                            type="date"
                            max={todayStr}
                            value={compareEndDateStr}
                            onChange={(e) => setCompareEndDateStr(e.target.value)}
                            className="w-full rounded border border-border bg-surface px-2 py-1 text-xs font-mono outline-none focus:border-primary"
                          />
                        </div>
                        {!compareAllDay && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Time</label>
                            <TimeField
                              value={compareEndTimeStr}
                              onChange={setCompareEndTimeStr}
                              className="w-full justify-center py-0.5 text-[11px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelCustom}
                  className="h-7 text-xs px-2.5 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isInvalid}
                  onClick={handleApplyCustom}
                  className="h-7 text-xs px-3 cursor-pointer"
                >
                  Apply
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
});
