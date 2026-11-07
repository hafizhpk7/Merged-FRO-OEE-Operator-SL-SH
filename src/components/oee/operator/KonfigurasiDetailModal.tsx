import { useEffect, useState } from "react";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MOCK_OPERATORS, type RejectSlot } from "@/lib/oee/rejectConfig";
import { rejectStore, useRejectStore } from "@/lib/oee/rejectStore";
import { formatTimeWib, getShiftInfo } from "@/lib/oee/shiftClock";

type DraftRow = { key: string; minute: string; qty: string };
type BucketDraft = { rows: DraftRow[]; removeIds: string[] };

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * "Konfigurasi Detail": the operator corrects the output reject of one slot per hourly bucket.
 * Corrections are per minute; a negative qty reduces the actual (sensor) value.
 */
export function KonfigurasiDetailModal({
  open,
  onOpenChange,
  slot,
  plantId,
  lineId,
  shiftKey,
  machineCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: RejectSlot | null;
  plantId: string;
  lineId: string;
  shiftKey: string;
  machineCode: string;
}) {
  // Re-render when the store changes.
  useRejectStore(plantId, lineId, shiftKey);

  const shift = getShiftInfo();
  const isCurrentShift = shiftKey === shift.shiftKey;
  const nowSec = Math.floor(Date.now() / 1000);
  const currentIdx = isCurrentShift
    ? Math.max(0, Math.min(7, Math.floor((nowSec - shift.startSec) / 3600)))
    : 7;

  const [operator, setOperator] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, BucketDraft>>({});
  const [seq, setSeq] = useState(0);

  // Reset local state whenever the dialog is (re)opened for a slot.
  useEffect(() => {
    if (open) {
      setOperator("");
      setDrafts({});
      setSelected(null);
    }
  }, [open, slot?.slotId]);

  const rejectTypeId = slot?.rejectTypeId ?? "";
  const series = slot
    ? rejectStore.getHourlySeries(plantId, lineId, shiftKey, rejectTypeId, machineCode)
    : { actual: [] as number[], current: [] as number[] };
  const saved = slot
    ? rejectStore.getCorrections(plantId, lineId, shiftKey, rejectTypeId, machineCode)
    : [];

  if (!slot) return null;

  const hourLabel = (h: number) => formatTimeWib(shift.startSec + h * 3600);
  // An hour still in progress cannot be corrected yet.
  const isBucketDisabled = (h: number) => isCurrentShift && h === currentIdx;

  const draftOf = (h: number): BucketDraft => drafts[h] ?? { rows: [], removeIds: [] };
  const patchDraft = (h: number, fn: (d: BucketDraft) => BucketDraft) =>
    setDrafts((prev) => ({ ...prev, [h]: fn(prev[h] ?? { rows: [], removeIds: [] }) }));

  // Value of a bucket as it would be after the pending (unsaved) edits.
  const projected = (h: number): number => {
    const base = series.current[h] ?? 0;
    const d = draftOf(h);
    const removed = saved
      .filter((c) => c.hourIdx === h && d.removeIds.includes(c.id))
      .reduce((s, c) => s + c.delta, 0);
    const added = d.rows.reduce((s, r) => s + (parseInt(r.qty, 10) || 0), 0);
    return base - removed + added;
  };

  const totalProjected = Array.from({ length: currentIdx + 1 }, (_, h) => projected(h)).reduce(
    (a, b) => a + b,
    0,
  );

  const hasChanges = Object.values(drafts).some((d) => d.rows.length > 0 || d.removeIds.length > 0);
  const rowError = (h: number, r: DraftRow): string | null => {
    if (r.minute === "") return "Pilih menit";
    const q = Number(r.qty);
    if (r.qty.trim() === "" || !Number.isInteger(q) || q === 0) return "Qty harus bilangan bulat ≠ 0";
    return null;
  };
  const bucketErrors = Object.entries(drafts).flatMap(([hk, d]) => {
    const h = Number(hk);
    const errs = d.rows.map((r) => rowError(h, r)).filter((e): e is string => !!e);
    if (projected(h) < 0) errs.push(`Total ${hourLabel(h)} tidak boleh di bawah 0`);
    return errs;
  });
  const canSave = !!operator && hasChanges && bucketErrors.length === 0;

  const addRow = () => {
    if (selected === null || !operator) return;
    setSeq((s) => s + 1);
    patchDraft(selected, (d) => ({
      ...d,
      rows: [...d.rows, { key: `new-${selected}-${seq}`, minute: "", qty: "-1" }],
    }));
  };

  const handleSave = () => {
    if (!canSave) return;
    const add: { hourIdx: number; minute: number; delta: number }[] = [];
    const removeIds: string[] = [];
    for (const [hk, d] of Object.entries(drafts)) {
      removeIds.push(...d.removeIds);
      for (const r of d.rows)
        add.push({ hourIdx: Number(hk), minute: Number(r.minute), delta: parseInt(r.qty, 10) });
    }
    rejectStore.applyCorrections({
      plantId,
      lineId,
      shiftKey,
      machineCode,
      rejectTypeId,
      rejectTypeName: slot.rejectTypeName ?? "",
      category: slot.category ?? "Reject",
      operator,
      removeIds,
      add,
    });
    toast.success(`Koreksi ${slot.rejectTypeName} disimpan oleh ${operator}.`);
    onOpenChange(false);
  };

  const sel = selected;
  const selDraft = sel !== null ? draftOf(sel) : null;
  const selSaved = sel !== null ? saved.filter((c) => c.hourIdx === sel) : [];
  const usedMinutes = new Set<number>([
    ...selSaved.filter((c) => !selDraft?.removeIds.includes(c.id)).map((c) => c.minute),
    ...(selDraft?.rows.filter((r) => r.minute !== "").map((r) => Number(r.minute)) ?? []),
  ]);
  const selActual = sel !== null ? (series.actual[sel] ?? 0) : 0;
  const selProjected = sel !== null ? projected(sel) : 0;
  const barMax = Math.max(1, selActual, selProjected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle className="text-lg font-semibold">{slot.rejectTypeName}</DialogTitle>
          <DialogDescription className="text-sm">
            Total {totalProjected} pcs reject
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-2">
          {/* Operator */}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Nama operator</p>
            <p className="text-xs text-muted-foreground">
              Wajib dipilih sebelum menambah, mengubah, atau menghapus koreksi menit.
            </p>
            <div className="relative">
              <select
                aria-label="Nama operator"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-border bg-card px-3 pr-14 text-sm text-foreground"
              >
                <option value="">Pilih operator…</option>
                {MOCK_OPERATORS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {operator && (
                <button
                  type="button"
                  aria-label="Hapus pilihan operator"
                  onClick={() => setOperator("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* Time buckets */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Time Buckets</p>
              <p className="text-xs text-muted-foreground">Pilih slot waktu yang ingin dikoreksi</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: currentIdx + 1 }, (_, h) => {
                const disabled = isBucketDisabled(h);
                const active = sel === h;
                const edited = (drafts[h]?.rows.length ?? 0) + (drafts[h]?.removeIds.length ?? 0) > 0;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelected(h)}
                    className={`rounded-md border px-2 py-2 text-center transition-colors ${
                      disabled
                        ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground"
                        : active
                          ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950/50"
                          : "border-transparent bg-muted/50 text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{hourLabel(h)}</span>
                    <span
                      className={`mt-0.5 inline-block rounded px-1.5 text-xs ${
                        edited ? "bg-red-100 font-bold text-red-700" : ""
                      }`}
                    >
                      {projected(h)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Correction panel */}
          {sel !== null && selDraft && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">
                Koreksi {hourLabel(sel)} – {hourLabel(sel).slice(0, 2)}:59
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Silakan input angka minus untuk mengurangi nilai actual. Pilih menit dari daftar —
                menit yang sudah dipakai tidak ditampilkan. Baris merah = ditandai hapus (bisa
                dibatalkan).
              </p>

              {/* Actual vs corrected bar */}
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-red-600 transition-all"
                    style={{ width: `${(Math.max(0, selProjected) / barMax) * 100}%` }}
                  />
                </div>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {selProjected} pcs
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Actual: {selActual} pcs</p>

              {selSaved.length === 0 && selDraft.rows.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  Belum ada koreksi menit. Tambahkan baris untuk set qty per menit.
                </p>
              )}

              <div className="space-y-2">
                {selSaved.map((c) => {
                  const marked = selDraft.removeIds.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                        marked
                          ? "border-red-300 bg-red-50 text-red-800 line-through dark:bg-red-950/40"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <span className="w-14 font-mono">
                        {hourLabel(sel).slice(0, 2)}:{pad2(c.minute)}
                      </span>
                      <span className="w-16 font-mono font-semibold">
                        {c.delta > 0 ? `+${c.delta}` : c.delta} pcs
                      </span>
                      <span className="flex-1 truncate text-xs text-muted-foreground">
                        {c.operator}
                      </span>
                      <button
                        type="button"
                        disabled={!operator}
                        aria-label={marked ? "Batalkan hapus" : "Tandai hapus"}
                        onClick={() =>
                          patchDraft(sel, (d) => ({
                            ...d,
                            removeIds: marked
                              ? d.removeIds.filter((id) => id !== c.id)
                              : [...d.removeIds, c.id],
                          }))
                        }
                        className="text-muted-foreground hover:text-red-700 disabled:opacity-40"
                      >
                        {marked ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                      </button>
                    </div>
                  );
                })}

                {selDraft.rows.map((r) => {
                  const mine = Number(r.minute);
                  const options = Array.from({ length: 60 }, (_, m) => m).filter(
                    (m) => !usedMinutes.has(m) || (r.minute !== "" && m === mine),
                  );
                  return (
                    <div key={r.key} className="flex items-center gap-3">
                      <select
                        aria-label="Menit koreksi"
                        value={r.minute}
                        onChange={(e) =>
                          patchDraft(sel, (d) => ({
                            ...d,
                            rows: d.rows.map((x) =>
                              x.key === r.key ? { ...x, minute: e.target.value } : x,
                            ),
                          }))
                        }
                        className="h-9 w-28 rounded-md border border-border bg-card px-2 text-sm"
                      >
                        <option value="">Menit…</option>
                        {options.map((m) => (
                          <option key={m} value={m}>
                            {hourLabel(sel).slice(0, 2)}:{pad2(m)}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label="Qty koreksi"
                        type="number"
                        step={1}
                        value={r.qty}
                        onChange={(e) =>
                          patchDraft(sel, (d) => ({
                            ...d,
                            rows: d.rows.map((x) =>
                              x.key === r.key ? { ...x, qty: e.target.value } : x,
                            ),
                          }))
                        }
                        className="h-9 w-24 rounded-md border border-border bg-card px-2 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">pcs</span>
                      <button
                        type="button"
                        aria-label="Hapus baris"
                        onClick={() =>
                          patchDraft(sel, (d) => ({
                            ...d,
                            rows: d.rows.filter((x) => x.key !== r.key),
                          }))
                        }
                        className="ml-auto text-muted-foreground hover:text-red-700"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!operator || usedMinutes.size >= 60}
                onClick={addRow}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-red-300 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" /> Tambah Menit Koreksi
              </button>
            </div>
          )}

          {bucketErrors.length > 0 && <p className="text-xs text-destructive">{bucketErrors[0]}</p>}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-red-600 px-6 text-white hover:bg-red-700"
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
