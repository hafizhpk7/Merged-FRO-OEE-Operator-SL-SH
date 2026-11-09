import { formatGapMin, formatGapPcs } from "@/lib/oee/targetEngine";

/**
 * CR 5 TG-01: from the top, bar TOTAL TARGET OUTPUT, bar TOTAL ACTUAL OUTPUT (same scale, both
 * filled), then scorecards GAP OUTPUT and GAP WAKTU. Without a standard (TG-09) the target bar and
 * both scorecards read "No standard".
 */
export function TargetBlock({
  testId,
  target,
  actual,
  scale,
  scaleLabel,
  reject,
  gap,
  gapMin,
  noStandard,
  formula,
  frozen,
}: {
  testId: string;
  target: number;
  actual: number;
  /** Denominator of both bars: total MPQ (PO) or projected shift target (shift). */
  scale: number;
  scaleLabel: string;
  reject: number;
  gap: number;
  gapMin: number | null;
  noStandard: boolean;
  formula?: string;
  frozen?: boolean;
}) {
  const pct = (v: number) => (scale > 0 ? Math.min(100, (v / scale) * 100) : 0);
  const good = gap >= 0;
  const tone = good
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200";

  return (
    <div className="space-y-3" data-testid={testId} data-frozen={frozen ? "true" : "false"}>
      {/* TOTAL TARGET OUTPUT */}
      <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Target Output
          </p>
          {formula && !noStandard && (
            <span className="text-[10px] text-muted-foreground" data-testid={`${testId}-formula`}>
              {formula}
            </span>
          )}
        </div>
        {noStandard ? (
          <p data-testid={`${testId}-nostandard`} className="py-2 text-sm font-semibold text-muted-foreground">
            No standard
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span data-testid={`${testId}-target`} className="font-mono text-2xl font-extrabold text-foreground">
                {target.toLocaleString()}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {scale > 0 ? ((target / scale) * 100).toFixed(1) : "0.0"}% dari {scaleLabel}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct(target)}%` }} />
            </div>
          </>
        )}
      </div>

      {/* TOTAL ACTUAL OUTPUT */}
      <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-xs">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Total Actual Output
        </p>
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span data-testid={`${testId}-actual`} className="font-mono text-2xl font-extrabold text-foreground">
              {actual.toLocaleString()}
            </span>
            <span className="font-mono text-sm font-bold text-red-600">({reject.toLocaleString()})</span>
          </div>
          <span className="font-mono text-[11px] font-bold text-muted-foreground">
            {actual.toLocaleString()} / {scale.toLocaleString()} ({scale > 0 ? ((actual / scale) * 100).toFixed(1) : "0.0"}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct(actual)}%` }} />
        </div>
      </div>

      {/* Scorecards */}
      <div className="grid grid-cols-2 gap-3">
        <div
          data-testid={`${testId}-gap-output`}
          data-sign={noStandard ? "none" : good ? "pos" : "neg"}
          className={`rounded-lg border p-3 ${noStandard ? "border-border bg-muted/30 text-muted-foreground" : tone}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider">GAP OUTPUT</p>
          <p className="mt-1 font-mono text-xl font-extrabold">
            <span data-testid={`${testId}-gap-output-value`}>
              {noStandard ? "No standard" : formatGapPcs(gap)}
            </span>
            {!noStandard && gap !== 0 && <span className="ml-1 text-xs font-semibold">pcs</span>}
          </p>
          <p className="text-[10px]">
            {noStandard ? "Standard belum tersedia" : gap === 0 ? "Sesuai target" : good ? "Di atas target" : "Di bawah target"}
          </p>
        </div>
        <div
          data-testid={`${testId}-gap-time`}
          data-sign={noStandard ? "none" : good ? "pos" : "neg"}
          className={`rounded-lg border p-3 ${noStandard ? "border-border bg-muted/30 text-muted-foreground" : tone}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider">GAP WAKTU</p>
          <p className="mt-1 font-mono text-xl font-extrabold">
            <span data-testid={`${testId}-gap-time-value`}>
              {noStandard || gapMin === null ? "No standard" : formatGapMin(gapMin)}
            </span>
            {!noStandard && gapMin !== null && <span className="ml-1 text-xs font-semibold">menit</span>}
          </p>
          <p className="text-[10px]">
            {noStandard ? "Standard belum tersedia" : good ? "Waktu terkejar" : "Waktu hilang"}
          </p>
        </div>
      </div>
      {frozen && (
        <p data-testid={`${testId}-frozen`} className="text-[10px] font-semibold text-muted-foreground">
          Nilai dibekukan saat Finish Work Order.
        </p>
      )}
    </div>
  );
}
