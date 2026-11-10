import { formatGapMin, formatGapPcs } from "@/lib/oee/targetEngine";
import { BigOutput, label, text2 } from "./froUi";

/**
 * CR 5 TG-01: from the top, bar TOTAL TARGET OUTPUT, bar TOTAL ACTUAL OUTPUT (same scale, both
 * filled), then scorecards GAP OUTPUT and GAP WAKTU. Without a standard (TG-09) the target bar and
 * both scorecards read "No standard". Styled with the old design language (froUi).
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
  const good = gap >= 0;
  const tone = good
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
  const pctOf = (v: number) => (scale > 0 ? ((v / scale) * 100).toFixed(1) : "0.0");

  return (
    <div className="flex flex-1 flex-col gap-[var(--fro-section-gap)]" data-testid={testId} data-frozen={frozen ? "true" : "false"}>
      {/* TOTAL TARGET OUTPUT */}
      {noStandard ? (
        <div className="flex flex-col gap-0.5">
          <p className={label}>Total Target Output</p>
          <p data-testid={`${testId}-nostandard`} className={`text-xl font-bold tracking-[-0.5px] ${text2}`}>
            No standard
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-1">
          <BigOutput
            title="Total Target Output"
            value={target}
            valueTestId={`${testId}-target`}
            note={`${pctOf(target)}% dari ${scaleLabel}`}
            scale={scale}
            barColor="var(--fro-rr-high)"
          />
          {formula && (
            <p className={`text-[10px] ${text2}`} data-testid={`${testId}-formula`}>
              {formula}
            </p>
          )}
        </div>
      )}

      {/* TOTAL ACTUAL OUTPUT */}
      <BigOutput
        title="Total Actual Output"
        value={actual}
        valueTestId={`${testId}-actual`}
        reject={reject}
        note={`${actual.toLocaleString()} / ${scale.toLocaleString()} (${pctOf(actual)}%)`}
        scale={scale}
      />

      {/* Scorecards */}
      <div className="flex max-h-[104px] flex-1 gap-[var(--fro-row-gap)] [&>*]:flex-1">
        <div
          data-testid={`${testId}-gap-output`}
          data-sign={noStandard ? "none" : good ? "pos" : "neg"}
          className={`rounded-lg border px-3 py-2 ${noStandard ? "border-border bg-muted/30 text-muted-foreground" : tone}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">GAP OUTPUT</p>
          <p className="mt-1 text-xl font-bold tracking-[-0.5px]">
            <span data-testid={`${testId}-gap-output-value`}>{noStandard ? "No standard" : formatGapPcs(gap)}</span>
            {!noStandard && gap !== 0 && <span className="ml-1 text-xs font-semibold">pcs</span>}
          </p>
          <p className="text-[10px]">
            {noStandard ? "Standard belum tersedia" : gap === 0 ? "Sesuai target" : good ? "Di atas target" : "Di bawah target"}
          </p>
        </div>
        <div
          data-testid={`${testId}-gap-time`}
          data-sign={noStandard ? "none" : good ? "pos" : "neg"}
          className={`rounded-lg border px-3 py-2 ${noStandard ? "border-border bg-muted/30 text-muted-foreground" : tone}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">GAP WAKTU</p>
          <p className="mt-1 text-xl font-bold tracking-[-0.5px]">
            <span data-testid={`${testId}-gap-time-value`}>{noStandard || gapMin === null ? "No standard" : formatGapMin(gapMin)}</span>
            {!noStandard && gapMin !== null && <span className="ml-1 text-xs font-semibold">menit</span>}
          </p>
          <p className="text-[10px]">{noStandard ? "Standard belum tersedia" : good ? "Waktu terkejar" : "Waktu hilang"}</p>
        </div>
      </div>
      {frozen && (
        <p data-testid={`${testId}-frozen`} className={`text-[10px] font-semibold ${text2}`}>
          Nilai dibekukan saat Finish Work Order.
        </p>
      )}
    </div>
  );
}
