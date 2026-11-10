import { useState, type ReactNode } from "react";
import { ChevronDown, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtRate, rateZone } from "@/lib/oee/legacyRunRate";

/**
 * Shared design language of the FlowReport (old FRO) pages, measured on the saved MES page
 * (docs/legacy/design-tokens.md, scripts/legacy-compare.mjs). Used by the old AND the new dashboard.
 */

export const num = (v: number) => v.toLocaleString("en-US");
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 10 px uppercase label. */
export const label = "text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fro-label)]";
/** secondary text (zinc-600). */
export const text2 = "text-[color:var(--fro-text-2)]";
export const redText = "text-[color:var(--fro-red-text)]";

const btnBase =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-3.5";
/** Button styles of the old UI. */
export const btn = {
  /** blue outline (Counter Detail, Test Print) */
  blue: `${btnBase} border border-blue-200 bg-transparent text-primary hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950`,
  /** solid red (Broken ..., Finish Work Order) */
  danger: `${btnBase} bg-[var(--fro-danger-btn)] text-white hover:opacity-90`,
  /** grey (AMR actions) */
  gray: `${btnBase} border border-zinc-300 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`,
  /** neutral outline (Refresh, Summarization, Realisasi per jam) */
  outline: `${btnBase} border border-border bg-transparent text-zinc-800 hover:bg-accent dark:text-zinc-200`,
  /** yellow outline (Pause Work Order) */
  pause: `${btnBase} border border-[var(--fro-pause-border)] bg-transparent text-[color:var(--fro-pause-fg)] hover:bg-amber-50 dark:hover:bg-amber-950/30`,
};

/** Native select styled like the old UI: bordered 32 px box (radius 8), 12 px text, chevron. */
export function FroSelect({ value, onChange, children, testId, label: aria }: { value: string; onChange: (v: string) => void; children: ReactNode; testId?: string; label?: string }) {
  return (
    <div className="relative h-8 w-full rounded-lg border border-border bg-transparent text-base font-normal focus-within:ring-2 focus-within:ring-ring">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...(testId ? { "data-testid": testId } : {})}
        {...(aria ? { "aria-label": aria } : {})}
        className="h-full w-full appearance-none rounded-lg bg-transparent px-2 pr-7 text-xs text-foreground outline-none [&>option]:bg-card [&>option]:text-foreground"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export type CardTone = "idw" | "po" | "shift";
const TONES: Record<CardTone, string> = {
  idw: "bg-[#cffafe] text-[#0c5c72] dark:bg-cyan-950 dark:text-cyan-300",
  po: "bg-[#ffedd5] text-[#92310a] dark:bg-orange-950 dark:text-orange-300",
  shift: "bg-[#f3e8ff] text-[#641ba3] dark:bg-purple-950 dark:text-purple-300",
};

/** Card frame of the old UI: white section, 1 px near-white border, radius 6, 20 px padding, icon chip + title + divider. */
export function FroCard({ icon, tone, title, testId, gap = "gap-4", children }: { icon: ReactNode; tone: CardTone; title: string; testId?: string; gap?: string; children: ReactNode }) {
  return (
    <section
      {...(testId ? { "data-testid": testId } : {})}
      className="flex h-full min-w-0 flex-col rounded-md border border-[color:var(--fro-card-border)] bg-card p-5 text-foreground"
      style={{ boxShadow: "var(--fro-shadow)" }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4 ${TONES[tone]}`}>{icon}</span>
          <p className="min-w-0 truncate text-base font-semibold leading-snug">{title}</p>
        </div>
        <hr className="border-0 border-t border-border" />
      </div>
      <div className={`flex flex-1 flex-col pt-4 ${gap}`}>{children}</div>
    </section>
  );
}

/** Track + fill, 10 px high. */
export function ProgressBar({ value, scale, color, testId }: { value: number; scale: number; color?: string; testId?: string }) {
  const pct = scale > 0 ? Math.min(100, Math.max(0, (value / scale) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--fro-track)]" {...(testId ? { "data-testid": testId } : {})}>
      <div className="h-full" style={{ width: `${pct}%`, background: color ?? "var(--primary)" }} />
    </div>
  );
}

/** Counter row (Innerbox / Karbox / Pallet). */
export function CounterRow({ icon, name, cur, master }: { icon: ReactNode; name: string; cur: number; master: number }) {
  return (
    <div className="flex flex-col gap-1" data-testid={`counter-${name.toLowerCase()}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-1.5 [&_svg]:size-3 [&_svg]:text-[color:var(--fro-label)]">
          {icon}
          <p className={label}>{name}</p>
        </div>
        <p className="text-sm font-bold">{cur} / {master}</p>
      </div>
      <ProgressBar value={cur} scale={master} />
    </div>
  );
}

/** Label / value row with a divider below (Output IDW, Output OEE, Gap, Total MPQ). */
export function OutputRow({ name, value, testId, valueClass = "" }: { name: string; value: string; testId?: string; valueClass?: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 py-2.5">
        <p className={`text-xs font-medium ${text2}`}>{name}</p>
        <p className={`text-sm font-semibold ${valueClass}`} {...(testId ? { "data-testid": testId } : {})}>{value}</p>
      </div>
      <hr className="border-0 border-t border-border" />
    </>
  );
}

/** Run-rate bar: red 0-100 % of the standard, green 100-150 %, yellow above (scale 0-200 %); marker at the actual value. */
export function RunRateBar({ actual, standard, testId }: { actual: number | null; standard: number | null; testId: string }) {
  const zone = rateZone(actual, standard);
  const ratio = actual !== null && standard !== null && standard > 0 ? actual / standard : null;
  const color = zone === "red" ? "var(--fro-rr-low)" : zone === "green" ? "var(--fro-rr-ok)" : "var(--fro-rr-high)";
  const pos = ratio === null ? null : Math.min(100, Math.max(0, ratio * 50));
  return (
    <div className="relative flex h-7 items-center" data-testid={testId} data-zone={zone}>
      <div className="flex h-2.5 w-full">
        <div className="h-full w-1/2 rounded" style={{ background: "var(--fro-rr-low)" }} />
        <div className="h-full w-1/4 rounded" style={{ background: "var(--fro-rr-ok)" }} />
        <div className="h-full w-1/4 rounded" style={{ background: "var(--fro-rr-high)" }} />
      </div>
      {pos !== null && (
        <div data-testid={`${testId}-actual`} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pos}%` }}>
          <span className="block h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent" style={{ borderTopColor: color }} />
          <span className="block h-[17px] w-0.5" style={{ background: color }} />
        </div>
      )}
    </div>
  );
}

/** Run-rate section (title, target, actual / standard and the segmented bar). */
export function RunRateRow({ title, target, actual, standard, testId }: { title: string; target: number | null; actual: number | null; standard: number | null; testId: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-[5px] border-[color:var(--fro-track)] pl-3" data-testid={testId}>
      <p className={label}>{title}</p>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <p className={label}>Target</p>
          <p className="text-base font-bold leading-none" data-testid={`${testId}-target-value`}>{fmtRate(target)}</p>
        </div>
        <div className="flex items-baseline gap-2">
          <p className={label}>Actual / Standard</p>
          <p className="text-base font-bold leading-none">
            <span data-testid={`${testId}-actual-value`}>{fmtRate(actual)}</span>{" "}
            <span className={`font-semibold ${text2}`} data-testid={`${testId}-standard-value`}>/ {fmtRate(standard)}</span>
          </p>
        </div>
      </div>
      <RunRateBar actual={actual} standard={standard} testId={`${testId}-bar`} />
    </div>
  );
}

/** Big number with the reject in red brackets, a right-hand note and a bar (Total output, Actual output). */
export function BigOutput({
  title,
  value,
  reject,
  note,
  scale,
  testId,
  valueTestId,
  rejectTestId,
  barTestId,
  barColor,
}: {
  title: string;
  value: number;
  reject?: number;
  note: string;
  scale: number;
  testId?: string;
  valueTestId?: string;
  rejectTestId?: string;
  barTestId?: string;
  barColor?: string;
}) {
  return (
    <div className="flex flex-col gap-3" {...(testId ? { "data-testid": testId } : {})}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className={label}>{title}</p>
          <p className="text-xl font-bold leading-none tracking-[-0.5px]">
            <span {...(valueTestId ? { "data-testid": valueTestId } : {})}>{num(value)}</span>{" "}
            {reject !== undefined && (
              <span className={`text-base font-semibold ${redText}`} {...(rejectTestId ? { "data-testid": rejectTestId } : {})}>({num(reject)})</span>
            )}
          </p>
        </div>
        <p className={`text-right text-xs ${text2}`}>{note}</p>
      </div>
      <ProgressBar value={value} scale={scale} {...(barTestId ? { testId: barTestId } : {})} {...(barColor ? { color: barColor } : {})} />
    </div>
  );
}

/** Sample / Released / Reject counters. */
export function QaCounters({ qaStats, icon, testId }: { qaStats: { sample: number; released: number; reject: number }; icon?: ReactNode; testId: string }) {
  const item = (name: string, v: number, cls: string, ic?: ReactNode) => (
    <div className="flex items-center gap-1.5">
      <p className={`${label} flex items-center gap-1 ${cls}`}>{ic}{name}</p>
      <p className={`text-lg font-bold ${cls}`}>{v}</p>
    </div>
  );
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1" data-testid={testId}>
      {item("Sample", qaStats.sample, "", icon)}
      {item("Released", qaStats.released, "text-[color:var(--fro-qa-green)] [&]:text-[color:var(--fro-qa-green)]")}
      {item("Reject", qaStats.reject, "text-[color:var(--fro-qa-red)] [&]:text-[color:var(--fro-qa-red)]")}
    </div>
  );
}

/** Mulai (PO start) and the Sisa chip. */
export function MulaiRow({ start, sisa, icon, testId }: { start: string; sisa: string; icon: ReactNode; testId?: string }) {
  return (
    <>
      <hr className="border-0 border-t border-[color:var(--fro-card-border)]" />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--fro-card-border)] bg-[color:var(--fro-zebra)] px-3 py-2.5">
        <div className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          <p className={`text-xs ${text2}`}>Mulai</p>
          <p className="text-sm font-bold">{start}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "var(--fro-sisa-bg)", color: "var(--fro-sisa-fg)" }} {...(testId ? { "data-testid": testId } : {})}>
          <Hourglass className="size-3.5" />
          <p className="text-xs font-semibold">Sisa {sisa}</p>
        </div>
      </div>
    </>
  );
}

/** FG Release button: asks for the QC name first ("Nama QC", "Jalankan" disabled until filled). */
export function FgReleaseButton({ name }: { name: "A" | "B" }) {
  const [open, setOpen] = useState(false);
  const [qc, setQc] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={btn.gray} data-testid={`fg-release-${name}`}>FG Release {name}</button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        <label className="block space-y-1">
          <span className={label}>Nama QC</span>
          <input
            value={qc}
            onChange={(e) => setQc(e.target.value)}
            placeholder="Masukkan nama QC..."
            data-testid={`fg-release-${name}-qc`}
            className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <button
          type="button"
          className={`${btn.danger} w-full bg-primary`}
          disabled={qc.trim() === ""}
          data-testid={`fg-release-${name}-run`}
          onClick={() => {
            toast.success(`AMR FG Release ${name} dijalankan oleh ${qc.trim()} (mock).`);
            setQc("");
            setOpen(false);
          }}
        >
          Jalankan
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** Process Order header box: SKU name, then Process Order / Material / Sediaan, plus the operator select. */
export function PoHeaderBox({
  sku,
  po,
  material,
  sediaan,
  operator,
  operators,
  lineId,
  onOperator,
  icon,
}: {
  sku: string;
  po: string;
  material: string;
  sediaan: string;
  operator: string;
  operators: string[];
  lineId: string;
  onOperator: (v: string) => void;
  icon: ReactNode;
}) {
  const col = (k: string, v: string, first = false, testId?: string) => (
    <div className="relative min-w-0">
      {!first && <span aria-hidden className="absolute left-0 top-3 h-[18px] w-px bg-[color:var(--fro-card-border)]" />}
      <p className={`text-sm ${text2} ${first ? "" : "pl-3"}`}>{k}</p>
      <p className={`truncate text-sm font-semibold ${first ? "" : "pl-3"}`} {...(testId ? { "data-testid": testId } : {})}>{v}</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg bg-[color:var(--fro-oee-card-bg)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--fro-chip-blue-bg)] text-[color:var(--fro-chip-blue-fg)] [&_svg]:size-4">{icon}</span>
          <p className="min-w-0 truncate text-base font-bold leading-snug" data-testid="po-sku-name" title={sku}>{sku}</p>
        </div>
        <hr className="my-1 border-0 border-t border-border" />
        <div className="grid grid-cols-3">
          {col("Process Order", po, true, "po-number")}
          {col("Material", material)}
          {col("Sediaan", sediaan)}
        </div>
      </div>
      <label className="flex flex-col gap-1">
        <span className={label}>Operator</span>
        <FroSelect value={operator} onChange={onOperator} testId="po-operator">
          {operators.map((op) => (
            <option key={op} value={op}>
              {op} ({lineId})
            </option>
          ))}
        </FroSelect>
      </label>
    </div>
  );
}
