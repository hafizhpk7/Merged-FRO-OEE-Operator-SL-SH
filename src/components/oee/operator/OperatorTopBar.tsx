import { useEffect, useState } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/oee/app-context";
import { operatorSidebarStore } from "@/lib/oee/operatorSidebarStore";
import { getDemoClockOffsetMs, getNow, subscribeClock } from "@/lib/oee/shiftClock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** ISO week number of a date (the old UI shows "Week 46"). */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

/** Top bar of the old UI: Week chip, date and time (WIB), light/dark toggle and the user avatar. */
export function OperatorTopBar() {
  const { isDarkMode, setIsDarkMode } = useApp();
  const [currentTime, setCurrentTime] = useState("");
  const [week, setWeek] = useState(() => isoWeek(getNow()));
  const [demoOn, setDemoOn] = useState(() => getDemoClockOffsetMs() !== 0);
  useEffect(() => subscribeClock(() => setDemoOn(getDemoClockOffsetMs() !== 0)), []);

  useEffect(() => {
    const updateClock = () => {
      const now = getNow();
      const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour12: false });
      setCurrentTime(`${dateStr} - ${timeStr} WIB`);
      setWeek(isoWeek(now));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4" data-testid="operator-topbar" aria-label="Top bar">
      <button
        type="button"
        data-testid="menu-button"
        aria-label="Menu"
        onClick={() => operatorSidebarStore.toggle()}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium lg:hidden"
      >
        <Menu className="size-4" />
        Menu
      </button>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        <span className="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--fro-chip-blue-bg)", color: "var(--fro-chip-blue-fg)" }} data-testid="week-chip">
          Week {week}
        </span>
        <p className="hidden truncate text-xs font-semibold text-[color:var(--fro-text-2)] sm:block" data-testid="clock-text">
          {currentTime}
        </p>
        <button
          type="button"
          data-testid="theme-toggle"
          aria-label={isDarkMode ? "Light mode" : "Dark mode"}
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-[color:var(--fro-text-2)] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="avatar-menu"
              aria-label="User menu"
              className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-[#fed7aa] text-xs font-medium uppercase text-[#92310a] outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-orange-950 dark:text-orange-200 ${
                demoOn ? "ring-2 ring-red-500 ring-offset-1" : ""
              }`}
            >
              SA
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs">
              Super Admin
              <span className="block text-[10px] font-normal text-muted-foreground">Prototype user</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onSelect={() => toast.info("Not part of this prototype")}>
              Profil
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" onSelect={() => toast.info("Not part of this prototype")}>
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
