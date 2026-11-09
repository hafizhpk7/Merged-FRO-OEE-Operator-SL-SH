import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { getLine, getPlant } from "@/lib/oee/data";
import { getPoForLine } from "@/lib/oee/poMaster";
import { formatDateWib, formatTimeWib } from "@/lib/oee/shiftClock";
import { getHourlyRows } from "@/lib/oee/targetService";
import { formatGapMin, lastFullHour, type HourRow } from "@/lib/oee/targetEngine";
import { useSrrMode } from "@/lib/oee/srrStore";
import { useTargetSnapshot } from "./useTargetSnapshot";

const f = (n: number) => Math.round(n).toLocaleString("en-US");
const sg = (n: number) => (n === 0 ? "0" : `${n > 0 ? "+" : "-"}${f(Math.abs(n))}`);
const tone = (n: number) => (n >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400");

function GapCell({ v, testId }: { v: number | null; testId?: string }) {
  if (v === null) return <span data-testid={testId}>-</span>;
  return (
    <span data-testid={testId} data-sign={v >= 0 ? "pos" : "neg"} className={`font-semibold ${tone(v)}`}>
      {sg(v)}
    </span>
  );
}

/**
 * CR 5 part B "Realisasi Produksi per Jam": information section, PO/SKU segments, one row per
 * calendar hour and the last-hour scorecards. Everything comes from the shared target engine, so
 * the numbers equal the Dashboard (cumulative gap = shift GAP OUTPUT at the end of each hour).
 */
export function HourlyRealisasi({ plantId, lineId }: { plantId: string; lineId: string }) {
  const snap = useTargetSnapshot(plantId, lineId);
  const mode = useSrrMode();
  const rows = useMemo(() => getHourlyRows(snap), [snap]);
  const last = lastFullHour(rows);
  const { shift, result } = snap;

  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const po = getPoForLine(lineId);
  let operator = po.activeOperator;
  try {
    operator = (typeof window !== "undefined" && localStorage.getItem(`fro_op_${lineId}`)) || operator;
  } catch {
    // keep the master default
  }

  const cur = result.current ?? result.segments[0] ?? null;
  const isLine = mode === "LINE";
  const std = isLine ? snap.srrLine : (cur?.skuSrr ?? null);
  const stdLabel = isLine ? "SRR Line" : `SRR SKU: ${cur?.skuName ?? "-"}`;
  const hhmm = (sec: number) => formatTimeWib(shift.startSec + sec);
  const nowLabel = formatTimeWib(shift.startSec + snap.nowSec);

  const skuText = (r: HourRow) => {
    if (r.segments.length === 0) return "-";
    if (isLine) return `SRR Line (${snap.srrLine ?? "-"})`;
    return r.segments.map((s) => `${s.skuLabel} (${s.srr ?? "-"})`).join(" > ");
  };

  const info: [string, string][] = [
    ["Tanggal", formatDateWib(shift.startSec) + " " + new Date(shift.startSec * 1000).getFullYear()],
    ["Plant", getPlant(plantId)?.name ?? plantId],
    ["Zona", line?.zoneId ? `LIQUID ${line.zoneId}` : "-"],
    ["Line", lineId],
    ["Nama operator", operator],
    ["Standard Output", std ? `${std} pcs/menit (${stdLabel})` : "No standard"],
    ["Output/jam", std ? `${f(std * 60)} pcs` : "No standard"],
  ];

  return (
    <div className="space-y-5 pb-10" data-testid="hourly-page">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/operator/$plantId/$lineId"
          params={{ plantId, lineId }}
          data-testid="hourly-back"
          className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <ChevronLeft className="size-3.5" /> Dashboard
        </Link>
        <h2 className="text-base font-bold text-foreground">Realisasi produksi per jam</h2>
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">Baru</span>
        <span className="ml-auto text-[11px] text-muted-foreground" data-testid="hourly-updated">
          Diperbarui {nowLabel} · {isLine ? "SRR Line" : "SRR SKU"}
        </span>
      </div>

      {/* Information section: only these seven fields */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" data-testid="hourly-info">
        {info.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="mt-0.5 text-xs font-semibold text-foreground" data-testid={`info-${k}`}>
              {v}
            </p>
          </div>
        ))}
      </div>

      {/* Segment table */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Segmen PO / SKU pada shift ini
        </p>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-xs" data-testid="segment-table">
            <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Segmen", "Waktu", "SRR (ppm)", "Menit terjadwal", "Total target output", "Total actual output", "Gap pcs", "Gap menit"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {result.segments.map((s) => (
                <tr key={s.key} data-testid="segment-row" className={`border-t border-border ${s.started ? "" : "text-muted-foreground"}`}>
                  <td className="px-3 py-2 font-semibold">
                    {s.skuLabel}
                    {s.running && <span className="ml-1.5 text-[10px] font-semibold text-amber-600">berjalan</span>}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {hhmm(s.startSec)} - {hhmm(s.stopSec)}
                  </td>
                  <td className="px-3 py-2">{s.srr ?? "No standard"}</td>
                  {s.started ? (
                    <>
                      <td className="px-3 py-2">{s.scheduledMin}</td>
                      <td className="px-3 py-2">{s.noStandard ? "-" : f(s.target)}</td>
                      <td className="px-3 py-2">{f(s.actual)}</td>
                      <td className="px-3 py-2">{s.noStandard ? "-" : <GapCell v={s.gap} />}</td>
                      <td className="px-3 py-2">
                        {s.gapMin === null ? "-" : <span className={`font-semibold ${tone(s.gap)}`}>{formatGapMin(s.gapMin)}</span>}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="px-3 py-2 text-center">
                      -
                    </td>
                  )}
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/30 font-semibold" data-testid="segment-total">
                <td colSpan={4} className="px-3 py-2 text-right">
                  Total shift sampai {nowLabel}
                </td>
                <td className="px-3 py-2" data-testid="seg-total-target">
                  {result.shift.noStandard ? "-" : f(result.shift.target)}
                </td>
                <td className="px-3 py-2" data-testid="seg-total-actual">
                  {f(result.shift.actual)}
                </td>
                <td className="px-3 py-2">{result.shift.noStandard ? "-" : <GapCell v={result.shift.gap} testId="seg-total-gap" />}</td>
                <td className="px-3 py-2">
                  {result.shift.gapMin === null ? (
                    "-"
                  ) : (
                    <span data-testid="seg-total-gapmin" className={tone(result.shift.gap)}>
                      {formatGapMin(result.shift.gapMin)}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Hourly table (no Keterangan column) */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tabel per jam</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-xs" data-testid="hourly-table">
            <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Jam", "SKU (SRR ppm)", "Total target output (pcs)", "Total actual output (pcs)", "Gap per jam", "Gap kumulatif"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  data-testid="hourly-row"
                  data-status={r.status}
                  className={`border-t border-border ${r.status === "cur" ? "bg-amber-50 dark:bg-amber-950/20" : ""} ${r.status === "fut" ? "text-muted-foreground" : ""}`}
                >
                  <td className="px-3 py-2 font-mono">
                    {hhmm(r.startSec)} - {hhmm(r.endSec)}
                    {r.partial && <span className="ml-1.5 text-[10px] text-muted-foreground">(parsial)</span>}
                    {r.status === "cur" && (
                      <span data-testid="running-marker" className="ml-1.5 text-[10px] font-semibold text-amber-600">
                        berjalan
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px]" data-testid="row-sku">
                    {skuText(r)}
                  </td>
                  <td className="px-3 py-2" data-testid="row-target">
                    {r.noStandard ? "No standard" : f(r.target)}
                  </td>
                  <td className="px-3 py-2" data-testid="row-actual">
                    {r.actual === null ? "-" : r.status === "cur" ? <i className="text-muted-foreground">{f(r.actual)}</i> : f(r.actual)}
                  </td>
                  <td className="px-3 py-2">
                    <GapCell v={r.gap} testId="row-gap" />
                  </td>
                  <td className="px-3 py-2">
                    <GapCell v={r.cumGap} testId="row-cum" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Semua nilai dalam pcs dan terisi otomatis. Jam berjalan: target penuh, actual sampai saat ini; gap terisi
          setelah jam selesai.
        </p>
      </div>

      {/* Scorecards: last full hour (RH-09 to RH-13) */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Kondisi 1 jam terakhir
          {last ? ` (${hhmm(last.startSec)} - ${hhmm(last.endSec)})` : ""}
          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">Baru</span>
        </p>
        {last && last.gap !== null && last.cumGap !== null && last.actual !== null ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="hour-scorecards">
            <div className="rounded-lg border border-border bg-card p-3" data-testid="sc-target-actual">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target vs Actual</p>
              <div className="mt-1.5 flex gap-5">
                <div>
                  <p className="text-[10px] text-muted-foreground">TOTAL TARGET OUTPUT</p>
                  <p className="text-lg font-bold text-amber-600" data-testid="sc-target">
                    {f(last.target)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">TOTAL ACTUAL OUTPUT</p>
                  <p className="text-lg font-bold text-primary" data-testid="sc-actual">
                    {f(last.actual)}
                  </p>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">pcs, {skuText(last)}</p>
            </div>
            <div
              className={`rounded-lg border p-3 ${last.gap >= 0 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-red-300 bg-red-50 dark:bg-red-950/30"}`}
              data-testid="sc-gap-hour"
            >
              <p className={`text-[10px] font-bold uppercase tracking-wider ${tone(last.gap)}`}>Gap per jam</p>
              <p className={`mt-1 text-xl font-extrabold ${tone(last.gap)}`} data-testid="sc-gap-hour-value">
                {sg(last.gap)} pcs
              </p>
              <p className={`text-[11px] ${tone(last.gap)}`}>
                {last.gap >= 0 ? "Di atas target" : "Di bawah target"} ({formatGapMin(last.gapMin ?? 0)} menit)
              </p>
            </div>
            <div
              className={`rounded-lg border p-3 ${last.cumGap >= 0 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-red-300 bg-red-50 dark:bg-red-950/30"}`}
              data-testid="sc-gap-cum"
            >
              <p className={`text-[10px] font-bold uppercase tracking-wider ${tone(last.cumGap)}`}>Gap kumulatif</p>
              <p className={`mt-1 text-xl font-extrabold ${tone(last.cumGap)}`} data-testid="sc-gap-cum-value">
                {sg(last.cumGap)} pcs
              </p>
              <p className={`text-[11px] ${tone(last.cumGap)}`}>
                Sampai akhir {hhmm(last.endSec)} ({formatGapMin(last.cumGapMin ?? 0)} menit)
              </p>
            </div>
          </div>
        ) : (
          <p data-testid="no-full-hour" className="rounded-lg border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
            Belum ada jam penuh yang selesai
          </p>
        )}
      </div>
    </div>
  );
}
