import { useEffect, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
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
import { REJECT_L2, rejectConfigStore, type L2Id } from "@/lib/oee/rejectConfigStore";
import { rejectStore } from "@/lib/oee/rejectStore";
import { formatTimeWib, getNowMs, getShiftInfo } from "@/lib/oee/shiftClock";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * "Reject lain" (CR 1 OP-20): record reject for a reason that has no card on this machine.
 * Order: Kategori (L2) first, then search a reason (L3) bound to it and scoped to the line's zone,
 * then hour, minute and qty. Reason and leader are mandatory like in Konfigurasi detail.
 */
export function RejectLainModal({
  open,
  onOpenChange,
  plantId,
  lineId,
  shiftKey,
  machineCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string;
  lineId: string;
  shiftKey: string;
  machineCode: string;
}) {
  const shift = getShiftInfo();
  const isCurrentShift = shiftKey === shift.shiftKey;
  const nowSec = Math.floor(getNowMs() / 1000);
  const currentIdx = isCurrentShift
    ? Math.max(0, Math.min(7, Math.floor((nowSec - shift.startSec) / 3600)))
    : 7;
  const nowMinute = isCurrentShift ? Math.floor(((nowSec - shift.startSec) % 3600) / 60) : 59;

  const [operator, setOperator] = useState("");
  const [l2, setL2] = useState<L2Id | "">("");
  const [search, setSearch] = useState("");
  const [l3Id, setL3Id] = useState("");
  const [hour, setHour] = useState(currentIdx);
  const [minute, setMinute] = useState(0);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [leader, setLeader] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      setOperator("");
      setL2("");
      setSearch("");
      setL3Id("");
      setHour(currentIdx);
      setMinute(0);
      setQty(1);
      setReason("");
      setLeader("");
      setNotice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const options = l2 ? rejectConfigStore.getOtherL3Options(plantId, lineId, machineCode, l2) : [];
  const filtered = options.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));
  const chosen = options.find((o) => o.l3Id === l3Id);

  const hourLabel = (h: number) => formatTimeWib(shift.startSec + h * 3600);
  const maxMinute = isCurrentShift && hour === currentIdx ? nowMinute : 59;

  const missing: string[] = [];
  if (!operator) missing.push("nama operator");
  if (!l2) missing.push("kategori");
  if (l2 && !chosen) missing.push("reason");
  if (!Number.isInteger(qty) || qty < 1) missing.push("qty (bilangan bulat > 0)");
  if (!reason.trim()) missing.push("alasan");
  if (!leader.trim()) missing.push("nama leader");
  const canSave = missing.length === 0;

  const handleSave = () => {
    if (!canSave || !l2 || !chosen) return;
    const res = rejectStore.saveCorrections({
      plantId,
      lineId,
      shiftKey,
      machineCode,
      l3Id: chosen.l3Id,
      l3Name: chosen.name,
      category: chosen.category,
      operator,
      reason,
      leader,
      changes: [{ hourIdx: hour, minute: Math.min(minute, maxMinute), l2Id: l2, after: qty }],
    });
    if (!res.ok) {
      setNotice({ kind: "error", text: res.errors.join(" ") });
      return;
    }
    toast.success(`Reject lain: ${chosen.name} (${l2}) ${qty} pcs dicatat oleh ${operator}.`);
    setNotice({ kind: "ok", text: "Reject lain tersimpan dan dicatat di audit trail." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="reject-lain-modal"
        className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-xl"
      >
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle className="text-lg font-semibold">Reject lain</DialogTitle>
          <DialogDescription className="text-sm">
            Mesin {machineCode}. Pilih kategori (RM, RP, RS) lalu cari reason yang tidak ada di
            kartu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-2 pb-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Nama operator</p>
            <div className="relative">
              <select
                aria-label="Nama operator"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-border bg-card px-3 pr-12 text-sm"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* 1. Kategori */}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">1. Kategori (L2)</p>
            <div className="flex flex-wrap gap-2">
              {REJECT_L2.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`lain-l2-${c.id}`}
                  aria-pressed={l2 === c.id}
                  disabled={!operator}
                  onClick={() => {
                    setL2(c.id);
                    setL3Id("");
                    setSearch("");
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                    l2 === c.id
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  {c.chipLabel}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Reason */}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">2. Reason (L3)</p>
            <input
              aria-label="Cari reason"
              data-testid="lain-search"
              placeholder={l2 ? "Cari reason…" : "Pilih kategori dulu"}
              disabled={!l2}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50"
            />
            <div className="max-h-36 overflow-y-auto rounded-md border border-border">
              {!l2 ? (
                <p className="p-3 text-xs text-muted-foreground">Reason muncul setelah kategori dipilih.</p>
              ) : filtered.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Tidak ada reason tanpa kartu untuk kategori ini.
                </p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.l3Id}
                    type="button"
                    data-testid="lain-l3-option"
                    data-l3={o.l3Id}
                    onClick={() => setL3Id(o.l3Id)}
                    className={`block w-full px-3 py-1.5 text-left text-sm ${
                      l3Id === o.l3Id ? "bg-red-50 font-semibold text-red-800" : "hover:bg-accent"
                    }`}
                  >
                    {o.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 3. Waktu dan qty */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Jam</p>
              <select
                aria-label="Jam"
                data-testid="lain-hour"
                value={hour}
                disabled={!chosen}
                onChange={(e) => {
                  setHour(Number(e.target.value));
                  setMinute(0);
                }}
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm disabled:opacity-50"
              >
                {Array.from({ length: currentIdx + 1 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Menit</p>
              <select
                aria-label="Menit"
                data-testid="lain-minute"
                value={Math.min(minute, maxMinute)}
                disabled={!chosen}
                onChange={(e) => setMinute(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm disabled:opacity-50"
              >
                {Array.from({ length: maxMinute + 1 }, (_, m) => (
                  <option key={m} value={m}>
                    {pad2(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Qty (pcs)</p>
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label="Kurangi"
                  disabled={!chosen || qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex size-9 items-center justify-center rounded-l-md border border-border bg-card disabled:opacity-40"
                >
                  <Minus className="size-3.5" />
                </button>
                <input
                  type="number"
                  step={1}
                  min={1}
                  aria-label="Qty"
                  data-testid="lain-qty"
                  disabled={!chosen}
                  value={qty}
                  onChange={(e) => setQty(e.target.value === "" ? 0 : Number(e.target.value))}
                  className="h-9 w-14 border-y border-border bg-card px-1 text-center text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  aria-label="Tambah"
                  disabled={!chosen}
                  onClick={() => setQty((q) => q + 1)}
                  className="flex size-9 items-center justify-center rounded-r-md border border-border bg-card disabled:opacity-40"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Konfirmasi */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-semibold">Konfirmasi perubahan</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr]">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Alasan perubahan <span className="text-red-600">*</span>
                </label>
                <Textarea
                  aria-label="Alasan perubahan"
                  data-testid="lain-reason"
                  rows={2}
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
                  data-testid="lain-leader"
                  value={leader}
                  onChange={(e) => setLeader(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                />
              </div>
            </div>
            <p data-testid="lain-status" data-ready={canSave} className="text-xs text-muted-foreground">
              {canSave
                ? `Siap disimpan: ${chosen?.name} (${l2}) ${qty} pcs pada ${hourLabel(hour)}:${pad2(Math.min(minute, maxMinute))}.`
                : `Lengkapi: ${missing.join(", ")}.`}
            </p>
            {notice && (
              <p className={`text-xs ${notice.kind === "ok" ? "text-emerald-700" : "text-destructive"}`}>
                {notice.text}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button
                data-testid="lain-save"
                disabled={!canSave}
                onClick={handleSave}
                className="bg-red-600 px-6 text-white hover:bg-red-700"
              >
                Simpan
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
