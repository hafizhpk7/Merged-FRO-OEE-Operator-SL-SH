import { Check, ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useApp } from "@/lib/oee/app-context";
import { RESOLUTIONS, SPANS, allowedResolutions } from "@/lib/oee/filters";
import { PLANTS } from "@/lib/oee/data";
import { useScope } from "@/lib/oee/scope";
import { cn } from "@/lib/utils";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]">
      {children}
    </span>
  );
}

function SelectPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Pill>
      <span className="text-muted-foreground">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-40 bg-transparent font-medium outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </Pill>
  );
}

function MultiPill({
  label,
  selected,
  options,
  onChange,
  emptyLabel = "All",
}: {
  label: string;
  selected: string[];
  options: { id: string; label: string }[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}) {
  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]"
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{summary}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-56 overflow-auto p-1">
        {options.length === 0 && (
          <p className="p-2 text-[11px] text-muted-foreground">Tidak ada opsi untuk filter ini</p>
        )}
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                onChange(on ? selected.filter((s) => s !== o.id) : [...selected, o.id])
              }
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px] hover:bg-grid/60"
            >
              <span className={cn(on && "font-medium")}>{o.label}</span>
              {on && <Check className="size-3.5 text-primary" />}
            </button>
          );
        })}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 w-full rounded px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-grid/60"
          >
            Clear selection
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Analytics filter bar. Cascading, reset and auto-snap rules live in AppProvider
 * (BR 2.5 / URS 3.2.1). Plant filter only exists for Section Head, placed between
 * Resolution and Zone.
 */
export function FilterBar() {
  const { role, filters, setFilters } = useApp();
  const scope = useScope();
  const resOptions = allowedResolutions(filters.span);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/70 px-3 sm:px-4 py-2 w-full min-w-0">
      <SelectPill
        label="Span"
        value={filters.span}
        options={SPANS.map((s) => ({ id: s.id, label: s.label }))}
        onChange={(v) => setFilters({ span: v as typeof filters.span })}
      />
      <SelectPill
        label="Resolution"
        value={filters.resolution}
        options={RESOLUTIONS.filter((r) => resOptions.includes(r.id)).map((r) => ({
          id: r.id,
          label: r.label,
        }))}
        onChange={(v) => setFilters({ resolution: v as typeof filters.resolution })}
      />
      {role === "section-head" && (
        <SelectPill
          label="Plant"
          value={filters.plantId}
          options={PLANTS.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(v) => setFilters({ plantId: v })}
        />
      )}
      <MultiPill
        label="Zone"
        selected={filters.zoneIds}
        options={scope.zoneOptions.map((z) => ({ id: z.id, label: z.name }))}
        onChange={(zoneIds) => setFilters({ zoneIds })}
        emptyLabel="All zones"
      />
      <MultiPill
        label="Line"
        selected={filters.lineIds}
        options={scope.lineOptions.map((l) => ({ id: l.id, label: `${l.id} · Zone ${l.zoneId}` }))}
        onChange={(lineIds) => setFilters({ lineIds })}
        emptyLabel="All lines"
      />
      <SelectPill
        label="SKU"
        value={filters.sku}
        options={[
          { id: "all", label: "All SKU" },
          ...scope.skuOptions.map((s) => ({ id: s, label: s })),
        ]}
        onChange={(sku) => setFilters({ sku })}
      />
      <span className="sm:ml-auto font-mono text-[10px] text-muted-foreground shrink-0">
        {scope.lines.length} lines in scope
      </span>
    </div>
  );
}
