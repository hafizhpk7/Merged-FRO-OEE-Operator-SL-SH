import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CloudCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getShiftInfo, formatTimeWib } from "@/lib/oee/shiftClock";
import { useWorkOrder } from "@/lib/oee/workOrderStore";
import {
  FLOW_LABELS,
  getFlowType,
  getPoBom,
  getPoFgInfo,
  getUnboxingSeed,
  hasActivePo,
  validateQty,
  type BomItem,
} from "@/lib/oee/summarizationMock";
import {
  emptyData,
  emptyItem,
  resumeRow,
  summarizationStore,
  useSummarization,
  validateData,
  type RejectMode,
  type SumData,
} from "@/lib/oee/summarizationStore";
import { getPoForLine } from "@/lib/oee/poMaster";

const STEPS = [
  { k: "Sample", d: "Input quantity sample" },
  { k: "Reject", d: "Input quantity reject" },
  { k: "Resume", d: "Ringkasan summarization" },
];
const SAMPLE_COLS = ["Sample QC", "Retain", "RND dan PIV", "PID Marketing Comm"];
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Qty({
  value,
  uom,
  disabled,
  onChange,
  testId,
}: {
  value: number;
  uom: "PC" | "ROLL";
  disabled?: boolean;
  onChange: (v: number) => void;
  testId: string;
}) {
  const err = validateQty(value, uom);
  return (
    <input
      type="number"
      min={0}
      step={uom === "ROLL" ? 0.1 : 1}
      value={Number.isNaN(value) ? "" : value}
      disabled={disabled}
      data-testid={testId}
      aria-invalid={err ? true : undefined}
      title={err ?? undefined}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className={`h-8 w-20 rounded border bg-background px-2 text-right text-xs disabled:opacity-60 ${
        err ? "border-red-500 bg-red-50" : "border-input"
      }`}
    />
  );
}

export function SummarizationPage({ plantId, lineId }: { plantId: string; lineId: string }) {
  if (!hasActivePo(lineId)) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="sum-no-po">
        Tidak ada PO FG aktif pada line {lineId}. Summarization tersedia saat ada work order aktif.
      </div>
    );
  }
  return <SummarizationInner plantId={plantId} lineId={lineId} />;
}

function SummarizationInner({ plantId, lineId }: { plantId: string; lineId: string }) {
  const po = getPoForLine(lineId);
  const info = getPoFgInfo(lineId);
  const bom = useMemo(() => getPoBom(po.poNumber), [po.poNumber]);
  const shift = getShiftInfo();
  const wo = useWorkOrder(lineId, shift.shiftKey);
  const rec = useSummarization(lineId, po.poNumber);
  const locked = rec?.status === "locked";
  const ctx = { plantId, lineId, poNumber: po.poNumber, user: info.user };

  const [data, setData] = useState<SumData>(() => ({ ...emptyData(bom), ...(rec?.data ?? {}) }));
  const [mode, setMode] = useState<RejectMode>(rec?.rejectMode ?? "only");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");

  const lanjutan = summarizationStore.currentLanjutan(lineId, po.poNumber);
  const flow = FLOW_LABELS[getFlowType(lineId)];
  const partial = wo.status !== "running" || lanjutan > 1;
  const errors = validateData(data, bom);

  const upd = (code: string, fn: (d: ReturnType<typeof emptyItem>) => void) =>
    setData((cur) => {
      const d = { ...cur };
      const item = JSON.parse(JSON.stringify(d[code] ?? emptyItem())) as ReturnType<typeof emptyItem>;
      fn(item);
      d[code] = item;
      return d;
    });

  const goStep = (n: number) => {
    if (n === step) return;
    if (!locked) {
      const r = summarizationStore.saveDraft(ctx, data, mode); // autosave draft on step change (SM-08)
      if (!r.ok) {
        setMsg(`Perbaiki nilai sebelum pindah langkah: ${r.reason ?? ""}`);
        return;
      }
    }
    setMsg("");
    setStep(n);
  };

  const apply = (col: number | "all") => {
    for (const b of bom) {
      if (!checked[b.code]) continue;
      upd(b.code, (d) => {
        if (col === "all") d.sample = [...form];
        else d.sample[col] = form[col] ?? 0;
      });
    }
  };

  const reset = () => {
    setMsg("");
    if (step === 0) {
      setData((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { ...v, sample: [0, 0, 0, 0] as typeof v.sample }])));
      setForm([0, 0, 0, 0]);
    } else if (step === 1) {
      setData((c) =>
        Object.fromEntries(
          Object.entries(c).map(([k, v]) => [k, { ...v, pack: [0, 0, 0] as typeof v.pack, bulk: [0, 0, 0, 0] as typeof v.bulk }]),
        ),
      );
    }
  };

  const save = () => {
    const r = summarizationStore.save(ctx, data, mode);
    if (!r.ok) {
      setMsg(r.reason ?? "Gagal menyimpan");
      return;
    }
    setMsg("");
    toast.success(`Summarization ${flow} tersimpan. Akan terisi otomatis di Rekonsiliasi All Batch.`);
  };

  const th = "border px-2 py-1.5 text-[11px] font-semibold bg-muted/50 text-center";
  const td = "border px-2 py-1 text-xs text-center";
  const tdl = "border px-2 py-1 text-xs text-left";
  const nm = (b: BomItem) => (
    <>
      <b>[{b.code}]</b> {b.name}
    </>
  );

  const savedLabel = rec?.updatedAt ? `Tersimpan otomatis ${formatTimeWib(rec.updatedAt / 1000)}` : "Tersimpan otomatis";

  return (
    <div className="space-y-4" data-testid="summarization-page">
      <nav className="text-xs text-muted-foreground" aria-label="breadcrumb">
        Beranda &gt; Pengemasan &gt; Kemas sekunder &gt; <span className="font-semibold text-foreground">Summarization</span>
      </nav>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-bold" data-testid="sum-flow-label">
            {flow}
            {partial ? " (stop parsial)" : ""}
          </h1>
          <span
            data-testid="sum-status"
            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
              locked ? "bg-slate-200 text-slate-700" : rec?.status === "saved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {locked ? "Terkunci" : rec?.status === "saved" ? "Tersimpan" : "Draft"}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid="sum-autosave">
            <CloudCheck className="size-3.5" /> {savedLabel}
          </span>
          <Link
            to="/operator/$plantId/$lineId/reconcile"
            params={{ plantId, lineId }}
            className="ml-auto text-xs font-semibold text-primary underline"
            data-testid="to-reconcile"
          >
            Rekonsiliasi All Batch
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-5" data-testid="sum-po-info">
          <div><dt className="text-muted-foreground">PO FG</dt><dd className="font-mono font-semibold">{po.poNumber}</dd></div>
          <div className="md:col-span-2"><dt className="text-muted-foreground">Material</dt><dd className="font-semibold">{info.material}</dd></div>
          <div><dt className="text-muted-foreground">Line</dt><dd className="font-semibold">{lineId}</dd></div>
          <div><dt className="text-muted-foreground">Lanjutan / Shift</dt><dd className="font-semibold">Lanjutan {lanjutan} · {shift.label}</dd></div>
        </dl>
        <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Data ini akan terisi otomatis di Rekonsiliasi All Batch. Tidak ada konfirmasi BOM dan tidak ada posting SAP di halaman ini.
        </div>
        {locked && (
          <div className="flex items-center gap-2 rounded border bg-muted px-3 py-2 text-xs" data-testid="sum-locked-banner">
            <Lock className="size-3.5" /> Reconcile All Batch sudah dikonfirmasi. Summarization terkunci (read-only) dan hanya dapat dilihat sebagai riwayat.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="sum-steps">
        {STEPS.map((s, i) => (
          <button
            key={s.k}
            type="button"
            data-testid={`sum-step-${s.k.toLowerCase()}`}
            aria-current={i === step ? "step" : undefined}
            onClick={() => goStep(i)}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-left text-xs ${i === step ? "border-primary bg-primary/5" : ""}`}
          >
            <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {i + 1}
            </span>
            <span>
              <b>{s.k}</b>
              <br />
              <span className="text-[10px] text-muted-foreground">{s.d}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card p-4">
        {step === 0 && (
          <div className="space-y-3">
            <div className="rounded border-l-4 pl-3">
              <div className="flex items-center">
                <span className="text-sm font-semibold">Form input sample FG</span>
                <Button size="sm" variant="outline" className="ml-auto h-7 text-[11px]" disabled={locked} data-testid="apply-all" onClick={() => apply("all")}>
                  Apply ke semua komponen
                </Button>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">Centang komponen, isi nilai, lalu Apply pada kolom yang diinginkan. Hanya komponen yang dicentang yang terisi.</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {SAMPLE_COLS.map((c, j) => (
                  <div key={c}>
                    <div className="mb-1 text-[11px] text-muted-foreground">{c}</div>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        value={form[j]}
                        disabled={locked}
                        data-testid={`form-${j}`}
                        onChange={(e) => setForm((f) => f.map((v, k) => (k === j ? Number(e.target.value) || 0 : v)) as typeof f)}
                        className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                      />
                      <Button size="sm" variant="outline" className="h-8 text-[11px]" disabled={locked} data-testid={`apply-${j}`} onClick={() => apply(j)}>
                        Apply
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <table className="w-full border-collapse" data-testid="sample-table">
              <thead>
                <tr>
                  <th className={th} />
                  <th className={th}>Item packaging</th>
                  {SAMPLE_COLS.map((c) => <th key={c} className={th}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {bom.map((b) => (
                  <tr key={b.code}>
                    <td className={td}>
                      <input type="checkbox" disabled={locked} checked={!!checked[b.code]} data-testid={`chk-${b.code}`} onChange={(e) => setChecked((c) => ({ ...c, [b.code]: e.target.checked }))} />
                    </td>
                    <td className={tdl}>{nm(b)} <span className="text-muted-foreground">({b.uom})</span></td>
                    {SAMPLE_COLS.map((_, j) => (
                      <td key={j} className={td}>
                        <Qty testId={`sample-${b.code}-${j}`} uom={b.uom} disabled={locked} value={data[b.code]?.sample[j] ?? 0} onChange={(v) => upd(b.code, (d) => { d.sample[j] = v; })} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="inline-flex overflow-hidden rounded-md border text-xs" role="group">
              {(["only", "bulk"] as const).map((m) => (
                <button key={m} type="button" data-testid={`mode-${m}`} onClick={() => setMode(m)} className={`px-3 py-1.5 font-medium ${mode === m ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                  {m === "only" ? "Reject packaging only" : "Reject with bulk"}
                </button>
              ))}
            </div>
            {mode === "only" ? (
              <table className="w-full border-collapse" data-testid="reject-only-table">
                <thead>
                  <tr>
                    <th className={th} rowSpan={2}>Item packaging</th>
                    <th className={th} rowSpan={2}>Qty supply</th>
                    <th className={th} colSpan={3}>Reject unboxing (read-only)</th>
                    <th className={th} colSpan={3}>Reject packaging only</th>
                  </tr>
                  <tr>
                    {["Supply", "Mesin", "Proses", "Supply", "Mesin", "Proses"].map((c, i) => <th key={i} className={th}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {bom.map((b) => {
                    const un = getUnboxingSeed(po.poNumber, b);
                    return (
                      <tr key={b.code}>
                        <td className={tdl}>{nm(b)}</td>
                        <td className={td}>{fmt(b.supply)}</td>
                        {un.map((v, i) => <td key={i} className={`${td} bg-muted/40 text-muted-foreground`}>{fmt(v)}</td>)}
                        {[0, 1, 2].map((j) => (
                          <td key={j} className={td}>
                            <Qty testId={`pack-${b.code}-${j}`} uom={b.uom} disabled={locked} value={data[b.code]?.pack[j] ?? 0} onChange={(v) => upd(b.code, (d) => { d.pack[j] = v; })} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse" data-testid="reject-bulk-table">
                <thead>
                  <tr>
                    <th className={th} rowSpan={2}>Item packaging</th>
                    <th className={th} rowSpan={2}>Qty supply</th>
                    <th className={th} colSpan={2}>Reject layak pakai</th>
                    <th className={th} colSpan={2}>Reject tidak layak pakai</th>
                  </tr>
                  <tr>{["Mesin", "Proses", "Mesin", "Proses"].map((c, i) => <th key={i} className={th}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {bom.map((b) => (
                    <tr key={b.code}>
                      <td className={tdl}>{nm(b)}</td>
                      <td className={td}>{fmt(b.supply)}</td>
                      {[0, 1, 2, 3].map((j) => (
                        <td key={j} className={td}>
                          <Qty testId={`bulk-${b.code}-${j}`} uom={b.uom} disabled={locked} value={data[b.code]?.bulk[j] ?? 0} onChange={(v) => upd(b.code, (d) => { d.bulk[j] = v; })} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <table className="w-full border-collapse" data-testid="resume-table">
              <thead>
                <tr>
                  <th className={th}>Item packaging</th>
                  {SAMPLE_COLS.map((c) => <th key={c} className={th}>{c}</th>)}
                  <th className={th}>Reject packaging only</th>
                  <th className={th}>Reject with bulk</th>
                </tr>
              </thead>
              <tbody>
                {bom.map((b) => {
                  const r = resumeRow(data[b.code] ?? emptyItem());
                  return (
                    <tr key={b.code} data-testid={`resume-${b.code}`}>
                      <td className={tdl}>{nm(b)}</td>
                      {[r.qc, r.retain, r.rnd, r.pid, r.packOnly, r.bulk].map((v, i) => <td key={i} className={td}>{fmt(v)}</td>)}
                    </tr>
                  );
                })}
                <tr data-testid="resume-total">
                  <td className={`${tdl} font-bold`}>Total</td>
                  {(["qc", "retain", "rnd", "pid", "packOnly", "bulk"] as const).map((k) => (
                    <td key={k} className={`${td} font-bold`}>
                      {fmt(Math.round(bom.reduce((a, b) => a + resumeRow(data[b.code] ?? emptyItem())[k], 0) * 10) / 10)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">Setelah disimpan, angka ini menjadi nilai awal di Rekonsiliasi All Batch dan masih bisa diedit di sana.</p>
          </div>
        )}
      </div>

      {(msg || errors.length > 0) && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" data-testid="sum-error">
          {msg || `Ada nilai tidak valid: ${errors[0]}`}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" data-testid="sum-prev" disabled={step === 0} onClick={() => goStep(step - 1)}>
          Sebelumnya
        </Button>
        <Button variant="outline" size="sm" data-testid="sum-reset" disabled={locked || step === 2} onClick={reset}>
          Reset
        </Button>
        <div className="ml-auto" />
        {step < 2 ? (
          <Button size="sm" data-testid="sum-next" onClick={() => goStep(step + 1)}>
            Simpan &amp; lanjut
          </Button>
        ) : (
          <Button size="sm" data-testid="sum-save" disabled={locked || errors.length > 0} onClick={save}>
            Simpan summarization
          </Button>
        )}
      </div>

      {rec && rec.snapshots.length > 0 && (
        <div className="rounded-lg border bg-card p-4" data-testid="sum-history">
          <div className="mb-2 text-sm font-semibold">Riwayat penyimpanan</div>
          <table className="w-full border-collapse">
            <thead><tr><th className={th}>Lanjutan</th><th className={th}>Shift</th><th className={th}>Waktu</th><th className={th}>User</th></tr></thead>
            <tbody>
              {rec.snapshots.map((s, i) => (
                <tr key={i}>
                  <td className={td}>Lanjutan {s.lanjutan}</td>
                  <td className={td}>{s.shiftKey}</td>
                  <td className={td}>{formatTimeWib(s.savedAt / 1000, true)}</td>
                  <td className={td}>{s.savedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
