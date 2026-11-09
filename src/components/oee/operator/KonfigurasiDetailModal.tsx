import { useEffect, useState } from "react";
import { Minus, Plus, RotateCcw, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MOCK_OPERATORS } from "@/lib/oee/rejectConfig";
import type { RejectCard } from "@/lib/oee/rejectConfigStore";
import { rejectStore, useRejectStore, type CorrectionChange } from "@/lib/oee/rejectStore";
import { formatTimeWib, getNowMs, getShiftInfo } from "@/lib/oee/shiftClock";
import { L2Badge } from "./L2Badge";

type Row = { key: string; minute: number; q: number; del: boolean };

const pad2 = (n: number) => String(n).padStart(2, "0");
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * "Konfigurasi Detail" (CR 1 OP-10..OP-19, review version): the operator corrects the reject of one
 * card (one L2 + one L3 entry) per hour and minute, one Qty per row. Current = actual +
 * corrections; Actual stays the sensor value. Every save needs a reason and a leader name and is written to the audit trail.
 */
export function KonfigurasiDetailModal({
  open,
  onOpenChange,
  card,
  plantId,
  lineId,
  shiftKey,
  machineCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: RejectCard | null;
  plantId: string;
  lineId: string;
  shiftKey: string;
  machineCode: string;
}) {
  // Re-render when the store changes.
  useRejectStore(plantId, lineId, shiftKey);

  const shift = getShiftInfo();
  const isCurrentShift = shiftKey === shift.shiftKey;
  const nowSec = Math.floor(getNowMs() / 1000);
  // OP-15: only hours of the selected shift up to the running hour can be corrected
  const currentIdx = isCurrentShift
    ? Math.max(0, Math.min(7, Math.floor((nowSec - shift.startSec) / 3600)))
    : 7;
  const nowMinute = isCurrentShift ? Math.floor(((nowSec - shift.startSec) % 3600) / 60) : 59;

  const l3Id = card?.l3Id ?? "";
  const saved = card ? rejectStore.getCorrections(plantId, lineId, shiftKey, l3Id, machineCode) : [];
  const by = card ? rejectStore.getHourly(plantId, lineId, shiftKey, l3Id, machineCode) : null;

  const buildRows = (): Record<number, Row[]> => {
    const out: Record<number, Row[]> = {};
    const byKey = new Map<string, Row>();
    for (const c of saved) {
      const k = `${c.hourIdx}|${c.minute}`;
      let row = byKey.get(k);
      if (!row) {
        row = { key: `s-${k}`, minute: c.minute, q: 0, del: false };
        byKey.set(k, row);
        (out[c.hourIdx] ??= []).push(row);
      }
      row.q += c.delta;
    }
    for (const list of Object.values(out)) list.sort((a, b) => a.minute - b.minute);
    return out;
  };

  const savedSig = saved.map((c) => `${c.id}:${c.delta}`).join(",");
  const [operator, setOperator] = useState("");
  const [hr, setHr] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<number, Row[]>>({});
  const [reason, setReason] = useState("");
  const [leader, setLeader] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [seq, setSeq] = useState(0);

  // Fresh form whenever the dialog opens for a reason.
  useEffect(() => {
    if (open) {
      setOperator("");
      setReason("");
      setLeader("");
      setNotice(null);
      setHr(null);
    }
  }, [open, l3Id]);

  // Rows mirror what is stored; rebuilt on open and after every save.
  useEffect(() => {
    if (open) setRows(buildRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, l3Id, savedSig]);

  if (!card || !by) return null;

  const hourLabel = (h: number) => formatTimeWib(shift.startSec + h * 3600);
  const actualH = (h: number) => by.actual[h] ?? 0;
  const rowsOf = (h: number): Row[] => rows[h] ?? [];
  const netH = (h: number) => rowsOf(h).reduce((s, r) => (r.del ? s : s + r.q), 0);
  const savedNet = (h: number) => saved.filter((c) => c.hourIdx === h).reduce((s, c) => s + c.delta, 0);
  // Current of an hour without any stored correction, then with the edits in the form
  const baseCurrent = (h: number) => (by.current[h] ?? 0) - savedNet(h);
  const projectedH = (h: number) => baseCurrent(h) + netH(h);

  // ---- diff between the form and the stored corrections --------------------------------
  const savedMap = new Map<string, number>();
  for (const c of saved) {
    const k = `${c.hourIdx}|${c.minute}`;
    savedMap.set(k, (savedMap.get(k) ?? 0) + c.delta);
  }
  const targetMap = new Map<string, number>();
  for (const [hk, list] of Object.entries(rows)) {
    for (const r of list) {
      if (r.del) continue;
      if (r.q !== 0) targetMap.set(`${hk}|${r.minute}`, r.q);
    }
  }
  const changes: CorrectionChange[] = [];
  for (const key of new Set([...savedMap.keys(), ...targetMap.keys()])) {
    const before = savedMap.get(key) ?? 0;
    const after = targetMap.get(key) ?? 0;
    if (before !== after) {
      const [h, m] = key.split("|");
      changes.push({ hourIdx: Number(h), minute: Number(m), after });
    }
  }
  const hasChange = changes.length > 0;

  // ---- validation (OP-15) ---------------------------------------------------------------
  const nonInteger = Object.values(rows).some((list) =>
    list.some((r) => !r.del && !Number.isInteger(r.q)),
  );
  const badHour = Array.from({ length: currentIdx + 1 }, (_, h) => h).find((h) => projectedH(h) < 0);
  const validationError = nonInteger
    ? "Qty harus bilangan bulat."
    : badHour !== undefined
      ? `Pengurangan melebihi nilai actual pada ${hourLabel(badHour)}.`
      : null;

  const totalActual = Array.from({ length: currentIdx + 1 }, (_, h) => actualH(h)).reduce((a, b) => a + b, 0);
  const totalCurrent = Array.from({ length: 8 }, (_, h) => Math.max(0, projectedH(h))).reduce(
    (a, b) => a + b,
    0,
  );

  // ---- confirmation (OP-16..OP-18) ----------------------------------------------------------
  const missing: string[] = [];
  if (!operator) missing.push("nama operator");
  if (!hasChange) missing.push("perubahan nilai");
  if (hasChange && !reason.trim()) missing.push("alasan");
  if (hasChange && !leader.trim()) missing.push("nama leader");
  const canSave = missing.length === 0 && !validationError;
  const statusText = validationError
    ? validationError
    : canSave
      ? `Perubahan siap disimpan: total ${totalActual} menjadi ${totalCurrent} pcs.`
      : `Lengkapi: ${missing.join(", ")}.`;

  // ---- row editing --------------------------------------------------------------------------
  const patchRow = (h: number, key: string, fn: (r: Row) => Row) =>
    setRows((prev) => ({ ...prev, [h]: (prev[h] ?? []).map((r) => (r.key === key ? fn(r) : r)) }));

  const minuteAllowed = (h: number, m: number) => !(isCurrentShift && h === currentIdx && m > nowMinute);

  const addRow = () => {
    if (hr === null || !operator) return;
    const used = new Set(rowsOf(hr).map((r) => r.minute));
    let m = 0;
    while (m < 60 && (used.has(m) || !minuteAllowed(hr, m))) m += 1;
    if (m >= 60) return;
    setSeq((n) => n + 1);
    setRows((prev) => ({
      ...prev,
      [hr]: [...(prev[hr] ?? []), { key: `n-${hr}-${seq}`, minute: m, q: 0, del: false }],
    }));
  };

  const step = (h: number, r: Row, d: number) => patchRow(h, r.key, (x) => ({ ...x, q: x.q + d }));

  const handleSave = () => {
    if (!canSave) return;
    const res = rejectStore.saveCorrections({
      plantId,
      lineId,
      shiftKey,
      machineCode,
      l3Id,
      l3Name: card.name,
      category: card.category,
      operator,
      reason,
      leader,
      changes,
    });
    if (!res.ok) {
      setNotice({ kind: "error", text: res.errors.join(" ") });
      return;
    }
    setNotice({
      kind: "ok",
      text: `Koreksi tersimpan dan dicatat di audit trail (${res.audit.length} entri: operator, alasan, leader).`,
    });
    setReason("");
    setLeader("");
    toast.success(`Koreksi ${card.name} disimpan oleh ${operator}.`);
  };

  const audit = rejectStore.getAudit(plantId, lineId, machineCode, l3Id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="correction-modal"
        className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            Konfigurasi detail: {card.name}
            <L2Badge l2={card.l2} />
          </DialogTitle>
          <DialogDescription data-testid="header-total" className="text-sm">
            Total {totalCurrent} pcs reject
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-2">
          {/* Nama operator (OP-12) */}
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
                <option value="">Pilih operator</option>
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

          {/* Time buckets (OP-13) */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Time buckets</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: currentIdx + 1 }, (_, h) => {
                const a = actualH(h);
                const n = netH(h);
                const has = a > 0 || rowsOf(h).length > 0;
                const active = hr === h;
                const label = has ? `${a}${n !== 0 ? ` (${signed(n)})` : ""}` : "-";
                return (
                  <button
                    key={h}
                    type="button"
                    data-testid={`bucket-${h}`}
                    data-label={label}
                    disabled={!has && !active}
                    onClick={() => setHr(h)}
                    className={`rounded-md border px-2 py-2 text-center transition-colors ${
                      active
                        ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950/50"
                        : has
                          ? "border-transparent bg-muted/50 text-foreground hover:bg-muted"
                          : "cursor-not-allowed border-transparent bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{hourLabel(h)}</span>
                    <span className="mt-0.5 block text-xs">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Koreksi per menit (OP-13, OP-14) */}
          {hr !== null && (
            <div
              className="space-y-3 rounded-lg border border-border bg-card p-4"
              data-testid="correction-area"
            >
              <p className="text-sm font-semibold text-red-700">
                Koreksi {hourLabel(hr)} - {hourLabel(hr).slice(0, 2)}:59
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Input angka minus untuk mengurangi nilai actual. Menit yang sudah dipakai tidak
                ditampilkan. Baris merah = ditandai hapus (bisa dibatalkan).
              </p>

              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-red-100">
                  <div
                    className="h-full rounded-full bg-red-600 transition-all"
                    style={{
                      width: `${actualH(hr) > 0 ? Math.min(100, (Math.abs(netH(hr)) / actualH(hr)) * 100) : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-red-700">{actualH(hr)} pcs</span>
              </div>

              {rowsOf(hr).length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada koreksi pada jam ini.</p>
              )}

              <div className="space-y-2">
                {rowsOf(hr).map((r) => {
                  const used = new Set(rowsOf(hr).filter((x) => x.key !== r.key).map((x) => x.minute));
                  const minutes = Array.from({ length: 60 }, (_, m) => m).filter(
                    (m) => !used.has(m) && (minuteAllowed(hr, m) || m === r.minute),
                  );
                  return (
                    <div
                      key={r.key}
                      data-testid="correction-row"
                      data-deleted={r.del}
                      className={`flex flex-wrap items-end gap-3 rounded-md border px-3 py-2 ${
                        r.del ? "border-red-300 bg-red-50 dark:bg-red-950/40" : "border-border bg-muted/20"
                      }`}
                    >
                      <div>
                        <p className="text-[10px] text-muted-foreground">Waktu</p>
                        <div className="flex items-center gap-1 text-sm">
                          <span>{hourLabel(hr).slice(0, 2)}</span>:
                          <select
                            aria-label="Menit koreksi"
                            data-testid="row-minute"
                            disabled={!operator || r.del}
                            value={r.minute}
                            onChange={(e) =>
                              patchRow(hr, r.key, (x) => ({ ...x, minute: Number(e.target.value) }))
                            }
                            className="h-8 rounded-md border border-border bg-card px-1.5 text-sm disabled:opacity-50"
                          >
                            {minutes.map((m) => (
                              <option key={m} value={m}>
                                {pad2(m)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] text-muted-foreground">Qty</p>
                        <div className="flex items-center">
                          <button
                            type="button"
                            aria-label="Kurangi"
                            data-testid="qty-minus"
                            disabled={!operator || r.del}
                            onClick={() => step(hr, r, -1)}
                            className="flex size-8 items-center justify-center rounded-l-md border border-border bg-card hover:bg-accent disabled:opacity-40"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <input
                            type="number"
                            step={1}
                            aria-label="Qty"
                            data-testid="qty"
                            disabled={!operator || r.del}
                            value={r.q}
                            onChange={(e) =>
                              patchRow(hr, r.key, (x) => ({
                                ...x,
                                q: e.target.value === "" ? 0 : Number(e.target.value),
                              }))
                            }
                            className="h-8 w-16 border-y border-border bg-card px-1 text-center text-sm disabled:opacity-50"
                          />
                          <button
                            type="button"
                            aria-label="Tambah"
                            data-testid="qty-plus"
                            disabled={!operator || r.del}
                            onClick={() => step(hr, r, 1)}
                            className="flex size-8 items-center justify-center rounded-r-md border border-border bg-card hover:bg-accent disabled:opacity-40"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="ml-auto flex gap-1.5">
                        <button
                          type="button"
                          aria-label="Reset baris"
                          data-testid="row-reset"
                          disabled={!operator}
                          onClick={() =>
                            patchRow(hr, r.key, (x) => ({ ...x, q: 0, del: false }))
                          }
                          className="flex size-8 items-center justify-center rounded-md border border-border bg-card hover:bg-accent disabled:opacity-40"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={r.del ? "Batalkan hapus" : "Tandai hapus"}
                          data-testid="row-delete"
                          disabled={!operator}
                          onClick={() => patchRow(hr, r.key, (x) => ({ ...x, del: !x.del }))}
                          className="flex size-8 items-center justify-center rounded-md border border-border bg-card hover:bg-accent disabled:opacity-40"
                        >
                          {r.del ? <Undo2 className="size-3.5" /> : <X className="size-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="add-correction"
                disabled={!operator}
                onClick={addRow}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-red-300 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" /> Tambah menit koreksi
              </button>
            </div>
          )}

          {/* Konfirmasi perubahan (OP-16, OP-17) */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Konfirmasi perubahan</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                Baru
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                Wajib bila ada perubahan nilai
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr]">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Alasan perubahan <span className="text-red-600">*</span>
                </label>
                <Textarea
                  aria-label="Alasan perubahan"
                  data-testid="reason-input"
                  rows={2}
                  placeholder="Mis. reject sensor terhitung dobel"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Nama leader / superior <span className="text-red-600">*</span>
                </label>
                <input
                  aria-label="Nama leader"
                  data-testid="leader-input"
                  placeholder="Nama leader"
                  value={leader}
                  onChange={(e) => setLeader(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                />
              </div>
            </div>
            <p
              data-testid="status-line"
              data-ready={canSave}
              className={`text-xs ${validationError ? "text-destructive" : "text-muted-foreground"}`}
            >
              {statusText}
            </p>
            {notice && (
              <p
                data-testid="save-notice"
                className={`text-xs ${notice.kind === "ok" ? "text-emerald-700" : "text-destructive"}`}
              >
                {notice.text}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                data-testid="cancel-correction"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                data-testid="save-correction"
                onClick={handleSave}
                disabled={!canSave}
                className="bg-red-600 px-6 text-white hover:bg-red-700"
              >
                Simpan
              </Button>
            </div>
          </div>

          {/* Riwayat koreksi (OP-19, read only, newest first) */}
          <div className="space-y-2 border-t border-border pb-4 pt-4" data-testid="history">
            <p className="text-sm font-semibold text-foreground">Riwayat koreksi</p>
            {audit.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada koreksi tersimpan.</p>
            ) : (
              <ul className="space-y-1.5">
                {audit.slice(0, 30).map((a) => (
                  <li
                    key={a.id}
                    data-testid="history-row"
                    className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-muted-foreground">
                        {formatTimeWib(a.savedAt, true)}
                      </span>
                      <span className="font-semibold">{a.operator}</span>
                      <span className="font-mono">
                        {hourLabel(a.hourIdx).slice(0, 2)}:{pad2(a.minute)}
                      </span>
                      <L2Badge l2={a.l2Id} />
                      <span data-testid="history-values" className="font-mono">
                        {a.before} → {a.after} ({signed(a.delta)})
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      Alasan: {a.reason} · Leader: {a.leader}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
