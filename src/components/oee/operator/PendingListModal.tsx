import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CLASSIFIABLE_LABEL, CLASSIFIABLE_TYPES } from "@/lib/oee/reasonConstants";
import type { ClassifiableType } from "@/lib/oee/reasonConstants";
import { formatTimeWib } from "@/lib/oee/shiftClock";
import type { MachineEvent } from "@/lib/oee/machineEvents";

const fmtMin = (sec: number) => `${Math.round((sec / 60) * 10) / 10} min`;

function causeText(e: MachineEvent): string {
  const isGroup = e.causes.some((c) => c.groupedBy);
  if (e.causes.length === 0) return "-";
  if (isGroup || e.causes.length === 1) {
    const c = e.causes[0];
    return c ? `${c.l2CategoryName} > ${c.l3ReasonName}` : "-";
  }
  // single mode with several causes: show the breakdown
  return e.causes
    .map((c) => `${c.l2CategoryName} > ${c.l3ReasonName} (${fmtMin(c.durationSec)})`)
    .join(" + ");
}

/**
 * CR 2 Overview popup, always for ONE classifiable type (GR-01).
 * Uncommented: checkbox per row + "Pilih semua" + bulk classify (GR-02/03). Committed: read-only.
 */
export function PendingListModal({
  open,
  onOpenChange,
  events,
  initialFilter = "downtime",
  onClassify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: MachineEvent[];
  initialFilter?: string;
  onClassify: (events: MachineEvent[]) => void;
}) {
  const filter: ClassifiableType = (CLASSIFIABLE_TYPES as string[]).includes(initialFilter)
    ? (initialFilter as ClassifiableType)
    : "downtime";
  const label = CLASSIFIABLE_LABEL[filter];

  const [tab, setTab] = useState<"uncommented" | "committed">("uncommented");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Dense shifts have hundreds of rows: render a page at a time (selection still covers every row).
  const PAGE = 50;
  const [limit, setLimit] = useState(PAGE);
  const allRef = useRef<HTMLInputElement>(null);

  // Opening or switching the type chip resets tab and selection (GR-01).
  useEffect(() => {
    setTab("uncommented");
    setSelected(new Set());
    setLimit(PAGE);
  }, [open, filter]);

  useEffect(() => setLimit(PAGE), [tab]);

  const ofType = useMemo(() => events.filter((e) => e.type === filter), [events, filter]);
  const uncommented = useMemo(() => ofType.filter((e) => !e.isTagged), [ofType]);
  const committed = useMemo(() => ofType.filter((e) => e.isTagged), [ofType]);

  // Selection only ever contains windows that are still uncommented of the active type.
  const selectedEvents = uncommented.filter((e) => selected.has(e.id));
  const selCount = selectedEvents.length;
  const selSec = selectedEvents.reduce((s, e) => s + e.durationSec, 0);
  const allChecked = uncommented.length > 0 && selCount === uncommented.length;
  const someChecked = selCount > 0 && selCount < uncommented.length;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someChecked;
  }, [someChecked, tab, open]);

  const rows = tab === "uncommented" ? uncommented : committed;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="overview-modal"
        className="max-h-[88vh] gap-4 overflow-y-auto p-4 sm:p-6 sm:max-w-2xl [&>*]:min-w-0"
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
          <DialogTitle className="text-lg font-semibold">{label.name} overview</DialogTitle>
          {uncommented.length > 0 && (
            <span
              data-testid="overview-badge"
              className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300"
            >
              {uncommented.length} action required
            </span>
          )}
        </DialogHeader>

        <div className="inline-flex w-fit rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["uncommented", `Uncommented (${uncommented.length})`],
              ["committed", `Committed (${committed.length})`],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              data-testid={`tab-${id}`}
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                tab === id
                  ? id === "uncommented"
                    ? "bg-card text-orange-600 shadow-xs"
                    : "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground"
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        {/* Selection bar: only on Uncommented (GR-02) */}
        {tab === "uncommented" && uncommented.length > 0 && (
          <div
            className={`flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-xs ${
              selCount > 0 ? "bg-blue-50 dark:bg-blue-950/40" : "bg-muted/40"
            }`}
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                ref={allRef}
                data-testid="select-all"
                type="checkbox"
                checked={allChecked}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(uncommented.map((x) => x.id)) : new Set())
                }
                className="size-4 accent-blue-700"
              />
              Pilih semua ({uncommented.length})
            </label>
            <span
              data-testid="selection-summary"
              className={selCount > 0 ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}
            >
              {selCount > 0
                ? `${selCount} dipilih | total ${fmtMin(selSec)}`
                : "Belum ada yang dipilih"}
            </span>
            <span className="ml-auto flex gap-2">
              {selCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="clear-selection"
                  className="h-8 text-xs"
                  onClick={() => setSelected(new Set())}
                >
                  Batal pilih
                </Button>
              )}
              <Button
                size="sm"
                data-testid="classify-selected"
                disabled={selCount === 0}
                onClick={() => onClassify(selectedEvents)}
                className="h-8 bg-blue-900 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Classify {selCount > 0 ? `${selCount} ` : ""}terpilih
              </Button>
            </span>
          </div>
        )}

        {rows.length > PAGE && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground" data-testid="overview-pager">
            <span>
              Menampilkan {Math.min(limit, rows.length)} dari {rows.length}
            </span>
            {limit < rows.length && (
              <Button variant="outline" size="sm" className="h-7 text-xs" data-testid="overview-more" onClick={() => setLimit((n) => n + PAGE)}>
                Tampilkan {Math.min(PAGE, rows.length - limit)} lagi
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              {tab === "uncommented"
                ? `Semua ${label.name.toLowerCase()} sudah diklasifikasi.`
                : "Belum ada yang di-commit."}
            </div>
          ) : (
            rows.slice(0, limit).map((e) => {
              const checked = selected.has(e.id);
              return (
                <div
                  key={e.id}
                  data-testid="overview-row"
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-3 sm:px-4 ${
                    checked && tab === "uncommented"
                      ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30"
                      : "border-border bg-card"
                  }`}
                >
                  {tab === "uncommented" && (
                    <input
                      type="checkbox"
                      data-testid="row-checkbox"
                      aria-label={`Pilih ${formatTimeWib(e.startAt)} - ${formatTimeWib(e.endAt)}`}
                      checked={checked}
                      onChange={(ev) => toggle(e.id, ev.target.checked)}
                      className="size-4 shrink-0 accent-blue-700"
                    />
                  )}
                  <Cell label="Time range" grow={1.1}>
                    {formatTimeWib(e.startAt)} - {formatTimeWib(e.endAt)}
                  </Cell>
                  <Cell label="Duration" grow={1}>
                    {fmtMin(e.durationSec)}
                  </Cell>
                  {tab === "uncommented" ? (
                    <>
                      <Cell label="Status" grow={1.2}>
                        <span className="inline-block rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                          Action required
                        </span>
                      </Cell>
                      <Button
                        size="sm"
                        data-testid="row-classify"
                        onClick={() => onClassify([e])}
                        className="h-8 bg-blue-900 px-4 text-xs font-semibold text-white hover:bg-blue-800"
                      >
                        Classify
                      </Button>
                    </>
                  ) : (
                    <Cell label="Category / reason" grow={2.2}>
                      <span className="text-xs font-semibold">{causeText(e)}</span>
                    </Cell>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Cell({
  label,
  grow,
  children,
}: {
  label: string;
  grow: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0" style={{ flex: grow }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{children}</p>
    </div>
  );
}
