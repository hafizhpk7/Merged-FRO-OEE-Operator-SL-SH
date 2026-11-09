import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatTimeWib } from "@/lib/oee/shiftClock";
import { getPoForLine } from "@/lib/oee/poMaster";
import { getPoBom, getPoFgInfo, hasActivePo, validateQty } from "@/lib/oee/summarizationMock";
import {
  RECON_COLS,
  RECON_LABELS,
  summarizationStore,
  useSummarization,
  type ReconCol,
  type ReconcileState,
} from "@/lib/oee/summarizationStore";

type Vals = ReconcileState["values"];

/**
 * CR 3 section 3.3 (mock): Rekonsiliasi All Batch with Sample/Reject prefilled from the latest saved
 * summarization (SM-11), Return empty (SM-12), markers + source + restore (SM-13), empty form when
 * there is no summarization (SM-14), confirm locks summarization (SM-15). BOM confirmation, SAP posting,
 * Terpakai/Dimusnahkan status and FG Release are disabled placeholders (SM-16).
 */
export function ReconcilePage({ plantId, lineId }: { plantId: string; lineId: string }) {
  if (!hasActivePo(lineId)) {
    return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Tidak ada PO FG aktif pada line {lineId}.</div>;
  }
  return <Inner plantId={plantId} lineId={lineId} />;
}

function Inner({ plantId, lineId }: { plantId: string; lineId: string }) {
  const po = getPoForLine(lineId);
  const info = getPoFgInfo(lineId);
  const bom = useMemo(() => getPoBom(po.poNumber), [po.poNumber]);
  const rec = useSummarization(lineId, po.poNumber);
  const ctx = { plantId, lineId, poNumber: po.poNumber, user: info.user };
  const confirmed = Boolean(rec?.reconcile?.confirmedAt);
  const prefill = useMemo(() => summarizationStore.prefill(rec), [rec]);
  const hasSum = Boolean(rec?.saved);

  const [vals, setVals] = useState<Vals>(() => {
    const stored = rec?.reconcile?.values;
    if (stored && Object.keys(stored).length) return JSON.parse(JSON.stringify(stored)) as Vals;
    return JSON.parse(JSON.stringify(summarizationStore.prefill(rec))) as Vals;
  });
  const [err, setErr] = useState("");

  const set = (code: string, col: ReconCol, v: number) =>
    setVals((c) => ({ ...c, [code]: { ...(c[code] ?? {}), [col]: v } }));
  const restoreCell = (code: string, col: ReconCol) => {
    const p = prefill[code]?.[col];
    if (p !== undefined) set(code, col, p);
  };
  const restoreAll = () => {
    setVals((c) => {
      const n: Vals = JSON.parse(JSON.stringify(c)) as Vals;
      for (const [code, row] of Object.entries(prefill)) n[code] = { ...(n[code] ?? {}), ...row };
      return n;
    });
  };

  const validate = (): string | null => {
    for (const b of bom)
      for (const col of RECON_COLS) {
        const v = vals[b.code]?.[col];
        if (v === undefined) continue;
        const e = validateQty(v, b.uom);
        if (e) return `${b.code} ${RECON_LABELS[col]}: ${e}`;
      }
    return null;
  };

  const th = "border px-2 py-1.5 text-[11px] font-semibold bg-muted/50 text-center";
  const td = "border px-2 py-1 text-xs text-center";

  return (
    <div className="page-fill" data-testid="reconcile-page">
      <nav className="text-xs text-muted-foreground">
        Beranda &gt; Pengemasan &gt; Kemas sekunder &gt; <span className="font-semibold text-foreground">Rekonsiliasi All Batch</span>
      </nav>
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-bold">Rekonsiliasi All Batch (mock)</h1>
          <span className="font-mono text-xs">PO FG {po.poNumber}</span>
          {confirmed && <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold" data-testid="recon-confirmed">Terkonfirmasi</span>}
          <Link to="/operator/$plantId/$lineId/summarization" params={{ plantId, lineId }} className="ml-auto inline-flex min-h-10 items-center text-xs font-semibold text-primary underline">
            Lihat Summarization
          </Link>
        </div>
        {hasSum ? (
          <div className="rounded border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900" data-testid="recon-source">
            Sample dan Reject terisi dari Summarization, terakhir disimpan {formatTimeWib((rec?.savedAt ?? 0) / 1000, true)} oleh {rec?.savedBy}. Kolom Return diisi manual.
            {!confirmed && (
              <Button size="sm" variant="outline" className="ml-3 h-6 gap-1 text-[11px]" data-testid="restore-all" onClick={restoreAll}>
                <RotateCcw className="size-3" /> Kembalikan ke data summarization
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded border px-3 py-2 text-xs text-muted-foreground" data-testid="recon-empty">
            Belum ada summarization untuk PO ini. Form diisi manual seperti biasa.
          </div>
        )}
      </div>

      <div className="fill-self overflow-x-auto rounded-lg border bg-card p-4">
        <table className="w-full border-collapse" data-testid="recon-table">
          <thead>
            <tr>
              <th className={th}>Item packaging</th>
              <th className={th}>Qty supply</th>
              {RECON_COLS.map((c) => <th key={c} className={th}>{RECON_LABELS[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {bom.map((b) => (
              <tr key={b.code}>
                <td className={`${td} text-left`}><b>[{b.code}]</b> {b.name}</td>
                <td className={td}>{b.supply}</td>
                {RECON_COLS.map((col) => {
                  const p = prefill[b.code]?.[col];
                  const v = vals[b.code]?.[col];
                  const prefilled = p !== undefined;
                  const edited = prefilled && v !== p;
                  return (
                    <td key={col} className={`${td} ${prefilled ? "bg-violet-50" : ""}`} data-prefilled={prefilled ? (edited ? "edited" : "yes") : "no"}>
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step={b.uom === "ROLL" ? 0.1 : 1}
                          disabled={confirmed}
                          data-testid={`recon-${b.code}-${col}`}
                          value={v ?? ""}
                          onChange={(e) => set(b.code, col, e.target.value === "" ? 0 : Number(e.target.value))}
                          className={`h-8 w-20 rounded border bg-background px-2 text-right text-xs ${validateQty(v ?? 0, b.uom) ? "border-red-500" : "border-input"} ${prefilled ? "border-violet-400" : ""}`}
                        />
                        {prefilled && (
                          <button
                            type="button"
                            title={edited ? "Kembalikan ke nilai summarization" : "Diisi dari summarization"}
                            data-testid={`marker-${b.code}-${col}`}
                            disabled={confirmed || !edited}
                            onClick={() => restoreCell(b.code, col)}
                            className="text-[10px] font-bold text-violet-700 disabled:cursor-default"
                          >
                            {edited ? <RotateCcw className="size-3" /> : "S"}
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-[11px] text-muted-foreground">S = nilai berasal dari Summarization. Sel dapat diedit; ikon panah mengembalikan nilai.</div>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-xs" data-testid="recon-placeholders">
        <div className="mb-2 font-semibold">Hanya di Rekonsiliasi All Batch (belum aktif di prototype)</div>
        <div className="flex flex-wrap gap-2">
          {["Konfirmasi BOM", "Posting SAP", "Status Terpakai semua / Dimusnahkan", "FG Release"].map((t) => (
            <Button key={t} size="sm" variant="outline" disabled className="h-7 text-[11px]">{t}</Button>
          ))}
        </div>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" data-testid="recon-error">{err}</div>}
      <div className="flex gap-2">
        <Button
          size="sm"
          data-testid="recon-confirm"
          disabled={confirmed}
          onClick={() => {
            const e = validate();
            if (e) return setErr(e);
            setErr("");
            summarizationStore.confirmReconcile(ctx, vals);
            toast.success("Reconcile dikonfirmasi (mock). Summarization sekarang terkunci.");
          }}
        >
          Konfirmasi reconcile
        </Button>
        <Button
          size="sm"
          variant="outline"
          data-testid="recon-save"
          disabled={confirmed}
          onClick={() => {
            const e = validate();
            if (e) return setErr(e);
            setErr("");
            summarizationStore.saveReconcile(ctx, vals);
            toast.success("Draft reconcile tersimpan");
          }}
        >
          Simpan draft
        </Button>
      </div>
    </div>
  );
}
