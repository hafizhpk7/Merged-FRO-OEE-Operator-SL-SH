import { useState, useEffect, useRef, type KeyboardEvent, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

export const TIME_STEP_MIN = 1;

interface TimeFieldProps {
  value: string; // "HH:mm" in 24h format
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

const HOURS_LIST = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => i);

/**
 * TimeField: 24-hour HH:mm time input with two typeable & scrollable segments,
 * and a click-activated dropdown time picker featuring side-by-side vertical
 * scrollable lists for Hours (00-23) and Minutes (00-59).
 */
export function TimeField({
  value,
  onChange,
  disabled = false,
  className,
  id,
  "aria-label": ariaLabel = "Time",
}: TimeFieldProps) {
  // Parse incoming value "HH:mm"
  const parseParts = (val: string): [number, number] => {
    if (!val || typeof val !== "string") return [0, 0];
    const parts = val.split(":");
    const h = parseInt(parts[0] ?? "0", 10);
    const m = parseInt(parts[1] ?? "0", 10);
    return [
      isNaN(h) ? 0 : Math.max(0, Math.min(23, h)),
      isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
    ];
  };

  const [initialH, initialM] = parseParts(value);
  const [hours, setHours] = useState<number>(initialH);
  const [minutes, setMinutes] = useState<number>(initialM);

  const [hoursInput, setHoursInput] = useState<string>(String(initialH).padStart(2, "0"));
  const [minutesInput, setMinutesInput] = useState<string>(String(initialM).padStart(2, "0"));

  // Dropdown open state
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);

  const hoursListRef = useRef<HTMLDivElement>(null);
  const minutesListRef = useRef<HTMLDivElement>(null);

  // Sync state if external value changes
  useEffect(() => {
    const [h, m] = parseParts(value);
    setHours(h);
    setMinutes(m);
    setHoursInput(String(h).padStart(2, "0"));
    setMinutesInput(String(m).padStart(2, "0"));
  }, [value]);

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Auto-scroll selected hour and minute into center view when dropdown opens
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (hoursListRef.current) {
        const selectedHourBtn = hoursListRef.current.querySelector<HTMLElement>(
          `[data-hour="${hours}"]`,
        );
        if (selectedHourBtn) {
          const list = hoursListRef.current;
          list.scrollTop =
            selectedHourBtn.offsetTop - list.clientHeight / 2 + selectedHourBtn.clientHeight / 2;
        }
      }

      if (minutesListRef.current) {
        const selectedMinuteBtn = minutesListRef.current.querySelector<HTMLElement>(
          `[data-minute="${minutes}"]`,
        );
        if (selectedMinuteBtn) {
          const list = minutesListRef.current;
          list.scrollTop =
            selectedMinuteBtn.offsetTop -
            list.clientHeight / 2 +
            selectedMinuteBtn.clientHeight / 2;
        }
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [isOpen, hours, minutes]);

  // Mouse wheel / trackpad scrolling handler on inputs for quick adjustments
  useEffect(() => {
    const hoursEl = hoursRef.current;
    if (!hoursEl) return;

    const onHoursWheel = (e: WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      setHours((prevH) => {
        const nextH = (prevH + delta + 24) % 24;
        setHoursInput(String(nextH).padStart(2, "0"));
        setMinutes((currentM) => {
          const formatted = `${String(nextH).padStart(2, "0")}:${String(currentM).padStart(2, "0")}`;
          onChange(formatted);
          return currentM;
        });
        return nextH;
      });
    };

    hoursEl.addEventListener("wheel", onHoursWheel, { passive: false });
    return () => {
      hoursEl.removeEventListener("wheel", onHoursWheel);
    };
  }, [disabled, onChange]);

  useEffect(() => {
    const minutesEl = minutesRef.current;
    if (!minutesEl) return;

    const onMinutesWheel = (e: WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? TIME_STEP_MIN : -TIME_STEP_MIN;
      setMinutes((prevM) => {
        const nextM = (prevM + delta + 60) % 60;
        setMinutesInput(String(nextM).padStart(2, "0"));
        setHours((currentH) => {
          const formatted = `${String(currentH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
          onChange(formatted);
          return currentH;
        });
        return nextM;
      });
    };

    minutesEl.addEventListener("wheel", onMinutesWheel, { passive: false });
    return () => {
      minutesEl.removeEventListener("wheel", onMinutesWheel);
    };
  }, [disabled, onChange]);

  const emitChange = (newH: number, newM: number) => {
    const clampedH = Math.max(0, Math.min(23, newH));
    const clampedM = Math.max(0, Math.min(59, newM));
    setHours(clampedH);
    setMinutes(clampedM);
    setHoursInput(String(clampedH).padStart(2, "0"));
    setMinutesInput(String(clampedM).padStart(2, "0"));
    const formatted = `${String(clampedH).padStart(2, "0")}:${String(clampedM).padStart(2, "0")}`;
    onChange(formatted);
  };

  const handleSelectHour = (h: number) => {
    emitChange(h, minutes);
  };

  const handleSelectMinute = (m: number) => {
    emitChange(hours, m);
  };

  const handleHoursKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = (hours + 1) % 24;
      emitChange(next, minutes);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (hours - 1 + 24) % 24;
      emitChange(next, minutes);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      minutesRef.current?.focus();
      minutesRef.current?.select();
    }
  };

  const handleMinutesKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = (minutes + TIME_STEP_MIN) % 60;
      emitChange(hours, next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (minutes - TIME_STEP_MIN + 60) % 60;
      emitChange(hours, next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      hoursRef.current?.focus();
      hoursRef.current?.select();
    }
  };

  const handleHoursChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHoursInput(raw);
    if (raw.length > 0) {
      const val = parseInt(raw, 10);
      if (!isNaN(val) && val >= 0 && val <= 23) {
        setHours(val);
        const formatted = `${String(val).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        onChange(formatted);
        if (raw.length === 2 || val > 2) {
          minutesRef.current?.focus();
          minutesRef.current?.select();
        }
      }
    }
  };

  const handleHoursBlur = () => {
    setHoursInput(String(hours).padStart(2, "0"));
  };

  const handleMinutesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMinutesInput(raw);
    if (raw.length > 0) {
      const val = parseInt(raw, 10);
      if (!isNaN(val) && val >= 0 && val <= 59) {
        setMinutes(val);
        const formatted = `${String(hours).padStart(2, "0")}:${String(val).padStart(2, "0")}`;
        onChange(formatted);
      }
    }
  };

  const handleMinutesBlur = () => {
    setMinutesInput(String(minutes).padStart(2, "0"));
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      <div
        id={id}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
          }
        }}
        className={cn(
          "inline-flex w-full items-center justify-center rounded border border-border bg-surface px-2 py-1 text-xs font-mono text-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary shadow-xs transition-colors cursor-pointer",
          disabled && "opacity-50 pointer-events-none bg-muted/40 cursor-not-allowed",
          isOpen && "border-primary ring-1 ring-primary",
          className,
        )}
      >
        <input
          ref={hoursRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          aria-label="Hour (00-23)"
          disabled={disabled}
          value={hoursInput}
          onChange={handleHoursChange}
          onKeyDown={handleHoursKeyDown}
          onBlur={handleHoursBlur}
          onFocus={(e) => {
            e.target.select();
            setIsOpen(true);
          }}
          className="w-5 bg-transparent p-0 text-center outline-none select-all cursor-pointer hover:text-primary transition-colors"
          placeholder="HH"
          title="Hour (00-23) · Click to pick, scroll or type"
        />
        <span className="text-muted-foreground select-none font-bold px-0.5">:</span>
        <input
          ref={minutesRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          aria-label="Minute (00-59)"
          disabled={disabled}
          value={minutesInput}
          onChange={handleMinutesChange}
          onKeyDown={handleMinutesKeyDown}
          onBlur={handleMinutesBlur}
          onFocus={(e) => {
            e.target.select();
            setIsOpen(true);
          }}
          className="w-5 bg-transparent p-0 text-center outline-none select-all cursor-pointer hover:text-primary transition-colors"
          placeholder="mm"
          title="Minute (00-59) · Click to pick, scroll or type"
        />
      </div>

      {/* Pop-up dropdown time picker */}
      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          role="dialog"
          aria-label="Time picker"
          className="absolute left-0 top-full mt-1.5 z-100 flex w-44 rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hours column */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border/70 pr-1">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center py-1 select-none border-b border-border/50 mb-1">
              Hr
            </div>
            <div
              ref={hoursListRef}
              className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-muted-foreground/30 overscroll-contain pr-0.5"
            >
              {HOURS_LIST.map((h) => {
                const isSelected = h === hours;
                const formatted = String(h).padStart(2, "0");
                return (
                  <button
                    key={h}
                    type="button"
                    data-hour={h}
                    onClick={() => handleSelectHour(h)}
                    className={cn(
                      "w-full rounded px-1.5 py-1 text-center font-mono text-xs transition-colors cursor-pointer select-none",
                      isSelected
                        ? "bg-primary font-bold text-primary-foreground shadow-xs"
                        : "text-foreground hover:bg-muted/80",
                    )}
                  >
                    {formatted}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minutes column */}
          <div className="flex-1 flex flex-col min-w-0 pl-1">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center py-1 select-none border-b border-border/50 mb-1">
              Min
            </div>
            <div
              ref={minutesListRef}
              className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-muted-foreground/30 overscroll-contain pl-0.5"
            >
              {MINUTES_LIST.map((m) => {
                const isSelected = m === minutes;
                const formatted = String(m).padStart(2, "0");
                return (
                  <button
                    key={m}
                    type="button"
                    data-minute={m}
                    onClick={() => handleSelectMinute(m)}
                    className={cn(
                      "w-full rounded px-1.5 py-1 text-center font-mono text-xs transition-colors cursor-pointer select-none",
                      isSelected
                        ? "bg-primary font-bold text-primary-foreground shadow-xs"
                        : "text-foreground hover:bg-muted/80",
                    )}
                  >
                    {formatted}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
