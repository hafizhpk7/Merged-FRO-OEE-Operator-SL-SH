import { useMemo, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TIMELINE_COLORS } from "@/lib/oee/reasonConstants";
import { classifyWindow } from "@/lib/oee/windowEngine";
import { formatTimeWib } from "@/lib/oee/shiftClock";
import {
  countUncommentedByType,
  type MachineEvent,
  type ShiftTimelineResult,
  type TimelineWindow,
} from "@/lib/oee/machineEvents";

type SegKind =
  | "effective"
  | "negative_speed_loss"
  | "downtime"
  | "minor_stop"
  | "speed_loss"
  | "planned";

type Segment = {
  key: string;
  kind: SegKind;
  startSec: number; // from shift start
  endSec: number;
  output: number;
  event?: MachineEvent;
};

const WINDOWS_PER_HOUR = 120;

const KIND_LABEL: Record<SegKind, string> = {
  effective: "Effective",
  negative_speed_loss: "Negative Speed Loss",
  downtime: "Downtime",
  minor_stop: "Minor Stop",
  speed_loss: "Speed Loss",
  planned: "Planned Downtime",
};

const KIND_SWATCH: Record<SegKind, string> = {
  effective: "bg-emerald-600",
  negative_speed_loss: TIMELINE_COLORS.negative_speed_loss.hatched,
  downtime: "bg-red-500",
  minor_stop: "bg-purple-600",
  speed_loss: "bg-amber-500",
  planned: TIMELINE_COLORS.planned.solid,
};

function segmentClass(seg: Segment): string {
  const tagged = seg.event?.isTagged ?? true;
  switch (seg.kind) {
    case "effective":
      return "bg-emerald-600";
    case "negative_speed_loss":
      return TIMELINE_COLORS.negative_speed_loss.hatched;
    case "planned":
      return TIMELINE_COLORS.planned.solid;
    case "downtime":
      return tagged ? TIMELINE_COLORS.downtime.solid : "bg-red-200 dark:bg-red-950/60";
    case "minor_stop":
      return tagged ? TIMELINE_COLORS.minor_stop.solid : "bg-purple-200 dark:bg-purple-950/60";
    case "speed_loss":
      return tagged ? TIMELINE_COLORS.speed_loss.solid : "bg-amber-200 dark:bg-amber-950/60";
  }
}

function windowKind(w: TimelineWindow): SegKind {
  if (w.type === "downtime") return "downtime";
  if (w.type === "minor_stop") return "minor_stop";
  if (w.type === "speed_loss") return "speed_loss";
  if (w.type === "planned") return "planned";
  // Negative Speed Loss windows carry an event; an Effective window stays Effective whatever the simulated output
  return w.eventId && classifyWindow(w.naturalOutput ?? w.output, w.targetOutput) === "NSL" ? "negative_speed_loss" : "effective";
}

/** Merges consecutive 30 s windows of the same kind/event into contiguous segments. */
function buildSegments(
  windows: TimelineWindow[],
  eventsById: Map<string, MachineEvent>,
  hourIdx: number,
): Segment[] {
  const out: Segment[] = [];
  for (const w of windows) {
    const kind = windowKind(w);
    const evId = kind === "effective" ? undefined : w.eventId;
    const last = out[out.length - 1];
    if (last && last.kind === kind && last.event?.id === evId) {
      last.endSec = w.endSec;
      last.output += w.output;
      continue;
    }
    const event = evId ? eventsById.get(evId) : undefined;
    out.push({
      key: `${hourIdx}-${w.index}`,
      kind,
      startSec: w.startSec,
      endSec: w.endSec,
      output: w.output,
      ...(event ? { event } : {}),
    });
  }
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Tiny segments (dense events) keep a minimum visible width; they stay clickable with a tooltip. */
const MIN_SEGMENT_PX = 5;

export function ProductionTimelineCard({
  timeline,
  onOpenPendingList,
  onSelectEventToClassify,
}: {
  timeline: ShiftTimelineResult;
  onOpenPendingList: (typeFilter?: string) => void;
  onSelectEventToClassify: (event: MachineEvent) => void;
}) {
  const { events, windows, snapshot, shift } = timeline;
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const pendingByType = countUncommentedByType(events);
  const count = (type: keyof typeof pendingByType) => ({
    total: events.filter((e) => e.type === type).length,
    pending: pendingByType[type],
  });
  const d = count("downtime");
  const ms = count("minor_stop");
  const sl = count("speed_loss");

  const rows = useMemo(() => {
    const eventsById = new Map(events.map((e) => [e.id, e]));
    return Array.from({ length: 8 }, (_, h) => {
      const hourStartSec = h * 3600;
      const isFuture = hourStartSec >= shift.elapsedSec;
      // only windows already revealed by the (simulated) clock; a completed shift shows all of them
      const hourWindows = windows
        .slice(h * WINDOWS_PER_HOUR, (h + 1) * WINDOWS_PER_HOUR)
        .filter((w) => w.startSec < shift.elapsedSec);
      return {
        hourIdx: h,
        label: formatTimeWib(shift.startSec + hourStartSec),
        hourStartSec,
        isFuture,
        segments: isFuture ? [] : buildSegments(hourWindows, eventsById, h),
      };
    });
  }, [windows, events, shift.elapsedSec, shift.startSec]);

  const chips = [
    { id: "downtime", letter: "D", label: "Downtime", c: d, badge: "bg-red-500" },
    { id: "minor_stop", letter: "MS", label: "Minor Stop", c: ms, badge: "bg-purple-600" },
    { id: "speed_loss", letter: "SL", label: "Speed Loss", c: sl, badge: "bg-amber-400" },
  ];

  const legend: { label: string; cls: string }[] = [
    { label: "Effective", cls: KIND_SWATCH.effective },
    { label: "Downtime", cls: KIND_SWATCH.downtime },
    { label: "Speed Loss", cls: KIND_SWATCH.speed_loss },
    { label: "Negative Speed Loss", cls: KIND_SWATCH.negative_speed_loss },
    { label: "Minor Stop", cls: KIND_SWATCH.minor_stop },
    { label: "Planned Downtime", cls: KIND_SWATCH.planned },
    {
      label: "Not Available/Unschedule",
      cls: "bg-slate-100 border border-slate-200 dark:bg-slate-800",
    },
  ];

  const ticks = Array.from({ length: 31 }, (_, i) => i * 2);

  return (
    <Card className="fill-self flex flex-col border border-border bg-card shadow-xs">
      <CardHeader className="space-y-3 pb-2">
        <h2 className="text-lg font-bold tracking-tight text-foreground">Production Timeline</h2>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Reason Classification
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onOpenPendingList(chip.id)}
              data-testid={`chip-${chip.id}`}
              className="flex min-w-48 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-2xs transition-colors hover:bg-accent"
            >
              <span
                className={`flex size-6 items-center justify-center rounded text-[10px] font-bold text-white ${chip.badge}`}
              >
                {chip.letter}
              </span>
              <span>
                {chip.label} · <strong>{chip.c.total}</strong>
              </span>
              <span
                data-testid={`chip-badge-${chip.id}`}
                data-pending={chip.c.pending}
                className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                  chip.c.pending > 0
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                    : chip.c.total > 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {chip.c.pending > 0 ? (
                  <>
                    {chip.c.pending}
                    <AlertCircle className="size-3.5" />
                  </>
                ) : chip.c.total > 0 ? (
                  <Check className="size-3.5" aria-label="Selesai" />
                ) : (
                  0
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-muted-foreground">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`h-3 w-6 rounded-xs ${l.cls}`} />
              {l.label}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col pt-4">
        <div className="flex flex-1 flex-col gap-3.5">
          {rows.map((row) => (
            <div key={row.hourIdx} className="flex max-h-28 flex-1 items-stretch gap-3">
              <span className="w-12 shrink-0 self-center text-sm text-muted-foreground">{row.label}</span>
              <div className="relative flex min-h-10 flex-1 overflow-hidden rounded-md bg-muted/30">
                {row.isFuture ? (
                  <div
                    className={`flex h-full w-full items-center justify-center ${TIMELINE_COLORS.future.hatched}`}
                  >
                    {row.hourIdx === rows.find((r) => r.isFuture)?.hourIdx && (
                      <span className="text-[11px] font-bold uppercase tracking-widest">
                        Not started
                      </span>
                    )}
                  </div>
                ) : (
                  row.segments.map((seg) => (
                    <SegmentCell
                      key={seg.key}
                      seg={seg}
                      shiftStartSec={shift.startSec}
                      rejectRatePct={snapshot.rejectRatePct}
                      open={activeKey === seg.key}
                      onOpenChange={(o) => setActiveKey(o ? seg.key : null)}
                      onClassify={(ev) => {
                        setActiveKey(null);
                        onSelectEventToClassify(ev);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Minute axis */}
        <div className="relative mt-2 ml-15 h-4 text-[11px] text-muted-foreground">
          {ticks.map((m) => (
            <span
              key={m}
              className="absolute top-0 hidden -translate-x-1/2 sm:block"
              style={{ left: `${(m / 60) * 100}%` }}
            >
              :{pad2(m)}
            </span>
          ))}
          <span className="absolute right-0 top-0 translate-x-1/2 hidden sm:block">:60</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SegmentCell({
  seg,
  shiftStartSec,
  rejectRatePct,
  open,
  onOpenChange,
  onClassify,
}: {
  seg: Segment;
  shiftStartSec: number;
  rejectRatePct: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClassify: (event: MachineEvent) => void;
}) {
  const ev = seg.event;
  const isLoss =
    !!ev &&
    (ev.type === "downtime" || ev.type === "minor_stop" || ev.type === "speed_loss");
  const startSec = ev ? ev.startSec : seg.startSec;
  const endSec = ev ? ev.endSec : seg.endSec;
  const durationMin = Math.max(1, Math.round((endSec - startSec) / 60));
  const classifiedMin = ev
    ? ev.isTagged && ev.source === "PLC"
      ? durationMin
      : Math.min(durationMin, Math.round((ev.classifiedSec ?? 0) / 60))
    : 0;
  const fully = !!ev?.isTagged;

  // Output over the whole event (loss) or this stretch (effective).
  const output = ev
    ? Math.round(
        (seg.output * (endSec - startSec)) / Math.max(30, seg.endSec - seg.startSec),
      )
    : seg.output;
  const reject = Math.round((output * rejectRatePct) / 100);

  const widthPct = ((seg.endSec - seg.startSec) / 3600) * 100;

  // Negative Speed Loss (speed gain) stays visible but is not clickable and needs no action.
  if (seg.kind === "negative_speed_loss") {
    return (
      <div
        role="img"
        data-testid="nsl-segment"
        title="Negative Speed Loss (speed gain)"
        aria-label={`Negative Speed Loss (speed gain) ${formatTimeWib(shiftStartSec + startSec)}`}
        style={{ flex: `${Math.max(1, seg.endSec - seg.startSec)} 1 0%`, minWidth: MIN_SEGMENT_PX }}
        className={`h-full shrink-0 cursor-default ${segmentClass(seg)}`}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${KIND_LABEL[seg.kind]} ${formatTimeWib(shiftStartSec + startSec)}`}
          title={`${KIND_LABEL[seg.kind]} ${formatTimeWib(shiftStartSec + startSec)} - ${formatTimeWib(shiftStartSec + endSec)}`}
          style={{ flex: `${Math.max(1, seg.endSec - seg.startSec)} 1 0%`, minWidth: MIN_SEGMENT_PX }}
          className={`h-full shrink-0 cursor-pointer transition-[filter] hover:brightness-95 focus-visible:outline-2 ${segmentClass(seg)} ${
            open ? "outline-2 -outline-offset-2 outline-foreground/70" : ""
          }`}
        />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-80 p-0 shadow-lg">
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-3.5 w-7 rounded-xs ${KIND_SWATCH[seg.kind]}`} />
              <span className="text-sm font-semibold text-foreground">{KIND_LABEL[seg.kind]}</span>
            </div>
            {isLoss && ev && (
              <Button
                size="sm"
                onClick={() => onClassify(ev)}
                className="h-8 bg-blue-900 px-4 text-xs font-semibold text-white hover:bg-blue-800"
              >
                {ev.source === "PLC" && ev.isTagged ? "View" : fully ? "Edit" : "Classify"}
              </Button>
            )}
          </div>

          {isLoss && (
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`rounded-md px-2 py-0.5 font-medium ${
                  fully
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                }`}
              >
                {fully ? "Classified" : "Action required"}
              </span>
              <span className="text-muted-foreground">
                {classifiedMin} / {durationMin} min
              </span>
            </div>
          )}

          <dl className="divide-y divide-border text-xs">
            <Row label="Time">
              {formatTimeWib(shiftStartSec + startSec)} - {formatTimeWib(shiftStartSec + endSec)}
            </Row>
            <Row label="Duration">{durationMin} min</Row>
            <Row label="Output / Reject">
              {output} pcs ({reject} pcs)
            </Row>
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="font-semibold text-foreground">{children}</dd>
    </div>
  );
}
