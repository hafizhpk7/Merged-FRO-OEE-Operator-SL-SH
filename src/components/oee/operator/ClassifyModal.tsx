import { useMemo, useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PARENTS, type LossCategoryNode, type LossParent } from "@/lib/oee/lossTree";
import {
  CLASSIFIABLE_LABEL,
  CLASSIFY_ALLOW_PARTIAL_SAVE,
  REASON_L1_BY_TYPE,
  type ClassifiableType,
} from "@/lib/oee/reasonConstants";
import { reasonTagStore, useReasonTags, type TaggedCause } from "@/lib/oee/reasonTagStore";
import {
  notifyClassificationChanged,
  operatorCauseKey,
  type MachineEvent,
} from "@/lib/oee/machineEvents";
import { formatTimeWib, getNow, type ShiftInfo } from "@/lib/oee/shiftClock";
import {
  canAddCause,
  canSaveSingle as canSaveSingleDraft,
  changeEnd as changeEndDraft,
  coverage,
  endOptions as endOptionsFor,
  isCauseComplete,
  removeCause as removeCauseDraft,
  startOf as startOfDraft,
  type DraftCause,
} from "@/lib/oee/classifyDraft";

const fmtMin = (sec: number) => `${Math.round((sec / 60) * 10) / 10} min`;

const selectCls =
  "h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";
const labelCls = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

type CatOption = LossCategoryNode & { parent: LossParent };

/**
 * CR 2 classify popup. One window -> single mode (cause list with times); two or more windows
 * of the same type -> group mode (one cause applied to the full duration of every window).
 * Saves go through reasonTagStore (versioned, atomic for groups).
 * Mount with a fresh `key` per open so the expected versions are captured at open time.
 */
export function ClassifyModal({
  shift,
  events,
  open,
  onOpenChange,
}: {
  shift: ShiftInfo;
  events: MachineEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useReasonTags(); // re-render on committed changes
  const first = events[0];
  const isGroup = events.length >= 2;

  const eventType = ((first?.type ?? "downtime") as ClassifiableType) in REASON_L1_BY_TYPE
    ? ((first?.type ?? "downtime") as ClassifiableType)
    : "downtime";
  const typeLabel = CLASSIFIABLE_LABEL[eventType];

  const keys = useMemo(
    () => events.map((e) => operatorCauseKey(shift.shiftKey, e.machineCode, e.id)),
    [events, shift.shiftKey],
  );
  // Versions at the moment the modal opened: used for the conflict check on save (GR-10).
  const [expected] = useState(() => reasonTagStore.getVersions(keys));

  const groups = useMemo(
    () =>
      (REASON_L1_BY_TYPE[eventType] ?? [])
        .map((l1) => PARENTS.find((p) => p.id === l1))
        .filter((p): p is NonNullable<typeof p> => !!p),
    [eventType],
  );
  const categories: CatOption[] = useMemo(
    () => groups.flatMap((g) => g.categories.map((c) => ({ ...c, parent: g.id as LossParent }))),
    [groups],
  );

  const isPlcMapped = !isGroup && Boolean(first?.source === "PLC" && first?.isTagged);
  const totalSec = first ? first.durationSec : 0;

  // ---- single mode state -------------------------------------------------------------
  const existing: TaggedCause[] = !isGroup && first && !isPlcMapped ? reasonTagStore.getCauses(keys[0] ?? "") : [];
  const [causes, setCauses] = useState<DraftCause[]>(() => {
    if (isGroup || !first) return [];
    if (existing.length > 0) {
      return existing.map((c, i) => ({
        key: `d${i}`,
        categoryId: c.l2CategoryId,
        reasonId: c.l3ReasonId,
        end: c.endSec - first.startSec,
        desc: c.description ?? "",
      }));
    }
    return [{ key: "d0", categoryId: "", reasonId: "", end: first.durationSec, desc: "" }];
  });
  const [seq, setSeq] = useState(1);

  // ---- group mode state --------------------------------------------------------------
  const [gCategoryId, setGCategoryId] = useState("");
  const [gReasonId, setGReasonId] = useState("");
  const [gDesc, setGDesc] = useState("");

  const [error, setError] = useState<{ message: string; windows: string[] } | null>(null);
  const [confirmPd, setConfirmPd] = useState(false);

  if (!first || !open) return null;

  const abs = (sec: number, withSec = false) => formatTimeWib(shift.startSec + sec, withSec);
  const windowLabel = (e: MachineEvent) => `${abs(e.startSec)} - ${abs(e.endSec)}`;
  const catOf = (id: string) => categories.find((c) => c.id === id);

  // ---- single mode helpers -----------------------------------------------------------
  const startOf = (i: number) => startOfDraft(causes, i);
  const isComplete = isCauseComplete;
  const { coveredSec } = coverage(causes, totalSec);
  const canSaveSingle = canSaveSingleDraft(causes, totalSec, CLASSIFY_ALLOW_PARTIAL_SAVE);
  const endOptions = (i: number) => endOptionsFor(causes, i, totalSec);

  const patchCause = (i: number, patch: Partial<DraftCause>) =>
    setCauses((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  // Changing an end time cuts all later causes (GR-05).
  const changeEnd = (i: number, end: number) => setCauses((prev) => changeEndDraft(prev, i, end));

  const addCause = () => {
    setSeq((s) => s + 1);
    setCauses((prev) => [
      ...prev,
      { key: `d${seq}`, categoryId: "", reasonId: "", end: totalSec, desc: "" },
    ]);
  };

  const removeCause = (i: number) => setCauses((prev) => removeCauseDraft(prev, i, totalSec));

  const toTagged = (c: DraftCause, i: number): TaggedCause | null => {
    const cat = catOf(c.categoryId);
    const reason = cat?.reasons.find((r) => r.id === c.reasonId);
    if (!cat || !reason) return null;
    return {
      id: `OC-${keys[0]}-${i + 1}`,
      startSec: first.startSec + startOf(i),
      endSec: first.startSec + c.end,
      l1Parent: cat.parent,
      l2CategoryId: cat.id,
      l2CategoryName: cat.name,
      l3ReasonId: reason.id,
      l3ReasonName: reason.name,
      ...(c.desc.trim() ? { description: c.desc.trim() } : {}),
      taggedAt: getNow().toISOString(),
    };
  };

  const saveSingle = () => {
    if (!canSaveSingle) return;
    const list = causes
      .map((c, i) => (isComplete(c) ? toTagged(c, i) : null))
      .filter((c): c is TaggedCause => !!c);
    const res = reasonTagStore.saveSingle(keys[0] ?? "", list, expected[keys[0] ?? ""] ?? 0);
    if (!res.ok) {
      setError({ message: res.message, windows: [windowLabel(first)] });
      return;
    }
    notifyClassificationChanged();
    toast.success("Klasifikasi disimpan.");
    onOpenChange(false);
  };

  // ---- group mode --------------------------------------------------------------------
  const gCat = catOf(gCategoryId);
  const gReason = gCat?.reasons.find((r) => r.id === gReasonId);
  const groupTotalSec = events.reduce((s, e) => s + e.durationSec, 0);
  const canSaveGroup = !!gCat && !!gReason;
  // OI-2.1: Planned Downtime on Downtime windows changes them to PD, so confirm first.
  const needsPdConfirm = eventType === "downtime" && gCat?.parent === "Planned Downtime";

  const doSaveGroup = () => {
    if (!gCat || !gReason) return;
    const res = reasonTagStore.saveGroup(
      events.map((e, i) => ({ id: keys[i] ?? "", startSec: e.startSec, endSec: e.endSec })),
      {
        l1Parent: gCat.parent,
        l2CategoryId: gCat.id,
        l2CategoryName: gCat.name,
        l3ReasonId: gReason.id,
        l3ReasonName: gReason.name,
        ...(gDesc.trim() ? { description: gDesc.trim() } : {}),
      },
      expected,
    );
    setConfirmPd(false);
    if (!res.ok) {
      const bad = new Set(res.conflicts);
      setError({
        message: res.message,
        windows: events.filter((_, i) => bad.has(keys[i] ?? "")).map(windowLabel),
      });
      return;
    }
    notifyClassificationChanged();
    toast.success(`${events.length} ${typeLabel.name.toLowerCase()} berhasil diklasifikasi.`);
    onOpenChange(false);
  };

  const onSaveGroupClick = () => (needsPdConfirm ? setConfirmPd(true) : doSaveGroup());

  const modeTag = isGroup ? `Grup: ${events.length} window` : "Satuan";
  const codeBadge: Record<ClassifiableType, string> = {
    downtime: "bg-red-500",
    minor_stop: "bg-purple-600",
    speed_loss: "bg-amber-500",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="classify-modal"
        data-mode={isGroup ? "group" : "single"}
        className="max-h-[92vh] overflow-y-auto p-8 sm:max-w-3xl"
      >
        <DialogHeader className="text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`flex h-6 min-w-6 items-center justify-center rounded px-1 text-[10px] font-bold text-white ${codeBadge[eventType]}`}
            >
              {typeLabel.code}
            </span>
            <DialogTitle className="text-xl font-semibold">
              {isGroup
                ? `Classify ${events.length} ${typeLabel.name}`
                : `Classify ${typeLabel.name}`}
            </DialogTitle>
            <span
              data-testid="mode-tag"
              className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200"
            >
              {modeTag}
            </span>
          </div>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            data-testid="classify-error"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            <p className="font-semibold">{error.message}</p>
            {error.windows.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {error.windows.map((w) => (
                  <li key={w}>Window bermasalah: {w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ============ GROUP MODE ============ */}
        {isGroup && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Total {fmtMin(groupTotalSec)}. Satu cause diterapkan penuh ke seluruh durasi tiap
              window.
            </p>
            <div className="space-y-1.5">
              <p className={labelCls}>Window yang dipilih</p>
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3 text-sm" data-testid="group-window">
                  <span className="w-32 font-mono text-xs">{windowLabel(e)}</span>
                  <span className="w-20 text-xs text-muted-foreground">{fmtMin(e.durationSec)}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: canSaveGroup ? "100%" : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelCls}>Category</label>
                <select
                  aria-label="Category"
                  value={gCategoryId}
                  onChange={(e) => {
                    setGCategoryId(e.target.value);
                    setGReasonId("");
                  }}
                  className={selectCls}
                >
                  <option value="">Pilih category</option>
                  {groups.map((g) => (
                    <optgroup key={g.id} label={g.id}>
                      {g.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Reason</label>
                <select
                  aria-label="Reason"
                  value={gReasonId}
                  disabled={!gCat}
                  onChange={(e) => setGReasonId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Pilih reason</option>
                  {gCat?.reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Description (opsional, berlaku untuk semua)</label>
              <Textarea
                aria-label="Description"
                placeholder="Catatan untuk cause ini..."
                value={gDesc}
                onChange={(e) => setGDesc(e.target.value)}
                className="h-20 text-sm"
              />
            </div>

            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Waktu mulai dan selesai tidak diubah di mode grup. Untuk memecah satu window ke
                beberapa cause, pakai Classify satuan.
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                data-testid="save-group"
                onClick={onSaveGroupClick}
                disabled={!canSaveGroup}
                className="bg-blue-600 px-6 text-white hover:bg-blue-700"
              >
                Save {events.length} classification
              </Button>
            </div>
          </div>
        )}

        {/* ============ SINGLE MODE ============ */}
        {!isGroup && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={labelCls}>Connect Time</p>
                  <p className="mt-1 text-xs text-foreground">
                    {windowLabel(first)} | {fmtMin(totalSec)} duration
                  </p>
                </div>
                <p data-testid="progress" className="text-sm font-semibold text-foreground">
                  {fmtMin(isPlcMapped ? totalSec : coveredSec)} / {fmtMin(totalSec)}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${Math.min(100, ((isPlcMapped ? totalSec : coveredSec) / Math.max(1, totalSec)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {isPlcMapped && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200">
                  <Info className="size-4 shrink-0" />
                  <span>
                    Auto-tagged by PLC alarm code{first.plcAlarm ? `: ${first.plcAlarm}` : ""}{" "}
                    (Read-Only)
                  </span>
                </div>
                {first.causes.map((c, i) => (
                  <div key={c.id ?? i} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-semibold">{c.l3ReasonName}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.l2CategoryName} · {c.l1Parent}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {!isPlcMapped && (
              <>
                <div className="flex items-center justify-between">
                  <p className={labelCls}>Cause List</p>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="add-cause"
                    disabled={!canAddCause(causes, totalSec)}
                    onClick={addCause}
                    className="h-9 text-xs font-medium"
                  >
                    <Plus className="mr-1 size-3.5" /> Add cause
                  </Button>
                </div>

                {causes.map((c, i) => {
                  const cat = catOf(c.categoryId);
                  const ready = isComplete(c);
                  return (
                    <div
                      key={c.key}
                      data-testid="cause-card"
                      className={`space-y-4 rounded-lg border p-4 ${
                        ready ? "border-emerald-300" : "border-orange-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Cause #{i + 1}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            ready
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {ready ? "Ready" : "Draft"}
                        </span>
                        {i > 0 && (
                          <button
                            type="button"
                            aria-label={`Hapus cause ${i + 1}`}
                            onClick={() => removeCause(i)}
                            className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className={labelCls}>Category</label>
                          <select
                            aria-label={`Category ${i + 1}`}
                            value={c.categoryId}
                            onChange={(e) => patchCause(i, { categoryId: e.target.value, reasonId: "" })}
                            className={selectCls}
                          >
                            <option value="">Pilih category</option>
                            {groups.map((g) => (
                              <optgroup key={g.id} label={g.id}>
                                {g.categories.map((cc) => (
                                  <option key={cc.id} value={cc.id}>
                                    {cc.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelCls}>Reason</label>
                          <select
                            aria-label={`Reason ${i + 1}`}
                            value={c.reasonId}
                            disabled={!cat}
                            onChange={(e) => patchCause(i, { reasonId: e.target.value })}
                            className={selectCls}
                          >
                            <option value="">Pilih reason</option>
                            {cat?.reasons.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelCls}>Start Time</label>
                          <input
                            aria-label={`Start time ${i + 1}`}
                            disabled
                            value={abs(first.startSec + startOf(i), true)}
                            className={selectCls}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {i === 0 ? "Awal window." : "Locked, lanjut dari cause sebelumnya."}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelCls}>End Time</label>
                          <select
                            aria-label={`End time ${i + 1}`}
                            value={c.end}
                            onChange={(e) => changeEnd(i, Number(e.target.value))}
                            className={selectCls}
                          >
                            {endOptions(i).map((t) => (
                              <option key={t} value={t}>
                                {abs(first.startSec + t, true)}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-muted-foreground">Harus setelah start.</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelCls}>Description</label>
                        <Textarea
                          aria-label={`Description ${i + 1}`}
                          placeholder="Catatan untuk cause ini..."
                          value={c.desc}
                          onChange={(e) => patchCause(i, { desc: e.target.value })}
                          className="h-16 text-sm"
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    data-testid="save-single"
                    onClick={saveSingle}
                    disabled={!canSaveSingle}
                    className="bg-blue-600 px-6 text-white hover:bg-blue-700"
                  >
                    Save
                  </Button>
                </div>
                {!canSaveSingle && (
                  <p className="text-right text-[11px] text-muted-foreground">
                    Save aktif setelah seluruh durasi tercakup oleh cause yang lengkap.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* OI-2.1: extra confirmation before windows become Planned Downtime */}
        <AlertDialog open={confirmPd} onOpenChange={setConfirmPd}>
          <AlertDialogContent data-testid="pd-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Jadikan Planned Downtime?</AlertDialogTitle>
              <AlertDialogDescription>
                {events.length} window dengan total {fmtMin(groupTotalSec)} akan dijadikan PD
                (Planned Downtime) dan keluar dari Scheduled Production Time (SPT = T - NA - US -
                PD).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={doSaveGroup}>
                Ya, jadikan PD ({events.length})
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
