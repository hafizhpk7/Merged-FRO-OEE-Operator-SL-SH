import { useNavigate } from "@tanstack/react-router";
import { Cpu, Factory, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { STATUS_DOT, STATUS_LABEL, TIER_TEXT, tierOf } from "@/lib/oee/config";
import { PLANTS } from "@/lib/oee/data";
import { cn } from "@/lib/utils";

export function QuickSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  // Index all lines and machines across plants (especially J2's 40 lines & 106 machines)
  const searchIndex = useMemo(() => {
    const linesList: {
      plantId: string;
      plantName: string;
      zoneId: string;
      zoneName: string;
      lineId: string;
      oee: number;
      status: string;
      machineCount: number;
    }[] = [];

    const machinesList: {
      plantId: string;
      zoneId: string;
      lineId: string;
      machineId: string;
      machineKey: string;
      machineName: string;
      machineType: string;
      status: string;
      oee: number;
    }[] = [];

    for (const p of PLANTS) {
      for (const z of p.zones) {
        for (const l of z.lines) {
          linesList.push({
            plantId: p.id,
            plantName: p.name,
            zoneId: z.id,
            zoneName: z.name,
            lineId: l.id,
            oee: l.oee,
            status: l.status,
            machineCount: l.machines.length,
          });

          for (const m of l.machines) {
            machinesList.push({
              plantId: p.id,
              zoneId: z.id,
              lineId: l.id,
              machineId: m.id,
              machineKey: m.key ?? `${l.id}-${m.id}`,
              machineName: m.name,
              machineType: m.type,
              status: m.status,
              oee: m.oee,
            });
          }
        }
      }
    }

    return { lines: linesList, machines: machinesList };
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search lines, machines, or codes (e.g. LCM03, TUP09, BOP15)..." />
      <CommandList className="max-h-96 overflow-y-auto p-2">
        <CommandEmpty>No matching production lines or machines found.</CommandEmpty>

        <CommandGroup heading="Production Lines">
          {searchIndex.lines.map((l) => (
            <CommandItem
              key={`search-l-${l.plantId}-${l.zoneId}-${l.lineId}`}
              value={`${l.lineId} ${l.zoneName} ${l.plantName} Line`}
              onSelect={() => {
                onOpenChange(false);
                navigate({
                  to: "/live/$plantId/$zoneId/$lineId",
                  params: { plantId: l.plantId, zoneId: l.zoneId, lineId: l.lineId },
                });
              }}
              className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Factory className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <span className="font-mono font-bold text-sm text-foreground">{l.lineId}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {l.plantName} · {l.zoneName} · {l.machineCount} machines
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("font-mono text-xs font-bold", TIER_TEXT[tierOf(l.oee)])}>
                  {l.oee.toFixed(1)}% OEE
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Production Machines">
          {searchIndex.machines.map((m) => (
            <CommandItem
              key={`search-m-${m.plantId}-${m.zoneId}-${m.lineId}-${m.machineKey}`}
              value={`${m.machineId} ${m.machineKey} ${m.lineId} ${m.machineName} ${m.machineType}`}
              onSelect={() => {
                onOpenChange(false);
                navigate({
                  to: "/live/$plantId/$zoneId/$lineId/$machineId",
                  params: {
                    plantId: m.plantId,
                    zoneId: m.zoneId,
                    lineId: m.lineId,
                    machineId: m.machineId,
                  },
                });
              }}
              className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Cpu className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <span className="font-mono font-bold text-sm text-foreground">{m.machineId}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Line {m.lineId} · {m.machineName} ({m.machineType})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("font-mono text-xs font-bold", TIER_TEXT[tierOf(m.oee)])}>
                  {m.oee.toFixed(1)}%
                </span>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    STATUS_DOT[m.status as keyof typeof STATUS_DOT],
                  )}
                />
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function QuickSearchTrigger({
  className,
  collapsed = false,
}: {
  className?: string;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center rounded-md border border-border bg-surface text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer",
          collapsed
            ? "size-11 justify-center p-0 mx-auto"
            : "w-full justify-between gap-3 px-3 py-2",
          className,
        )}
        title="Search lines and machines (⌘K)"
        aria-label="Search lines and machines"
      >
        <div className={cn("flex items-center gap-2 min-w-0", collapsed && "justify-center")}>
          <Search className="size-4 shrink-0" />
          {!collapsed && <span className="truncate text-xs">Search line or machine...</span>}
        </div>
        {!collapsed && (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground shrink-0">
            ⌘K
          </kbd>
        )}
      </button>

      <QuickSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
