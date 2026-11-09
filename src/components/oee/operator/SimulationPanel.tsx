import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, FlaskConical, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getLine } from "@/lib/oee/data";
import {
  applyPoScenario,
  currentPoScenario,
  exportSimState,
  importSimState,
  injectEvent,
  jumps,
  rejectBurst,
  requestDensity,
  resetOverrides,
  resetSimulationData,
  sim,
  triggerQaAlert,
  useSimulationActive,
  type InjectKind,
} from "@/lib/oee/simControls";
import { simStore, TIME_SCALES, type Density } from "@/lib/oee/simStore";
import { formatTimeWib, getNowMs, getShiftInfo, SHIFT_SECONDS, WIB_OFFSET_MS } from "@/lib/oee/shiftClock";
import { setSrrLine, getLineSrr } from "@/lib/oee/assetMaster";
import { applyActualVsTarget, clearActualVsTarget } from "@/lib/oee/simOutput";
import { rejectConfigStore } from "@/lib/oee/rejectConfigStore";
import { REJECT_TYPES } from "@/lib/oee/rejectConfig";
import { formatGapMin } from "@/lib/oee/targetEngine";
import { useSimWindowBucket } from "@/lib/oee/useSimTick";
import { useTargetSnapshot } from "./useTargetSnapshot";

const OPEN_KEY = "fro_sim_panel_open";
const TIME_FMT = (ms: number) => {
  const d = new Date(ms + WIB_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
const PARSE_WIB = (v: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) - WIB_OFFSET_MS;
};

const box = "rounded-lg border border-border bg-card p-3 space-y-2";
const h = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";
const inp = "h-8 rounded-md border border-border bg-background px-2 text-xs";
const btn = "h-7 px-2 text-[11px]";

function readOpen(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Simulation panel: collapsible section above the operator header (pushes the page down). All
 * controls act through the shared stores, so every page and the SL/SH views follow within a tick.
 */
export function SimulationPanel({ plantId, lineId }: { plantId: string; lineId: string }) {
  const [open, setOpen] = useState(readOpen);
  const toggle = () =>
    setOpen((o) => {
      try {
        sessionStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {
        // ignore
      }
      return !o;
    });
  const active = useSimulationActive();

  return (
    <section
      aria-label="Simulation panel"
      data-testid="sim-panel"
      data-open={open}
      className="mb-3 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20"
    >
      <button
        type="button"
        data-testid="sim-toggle"
        aria-expanded={open}
        aria-controls="sim-panel-body"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <FlaskConical className="size-4 text-violet-700" />
        <span className="text-xs font-bold uppercase tracking-wider text-violet-900 dark:text-violet-200">Simulation</span>
        {active && (
          <span data-testid="sim-badge" className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Simulation active
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{open ? "Minimize" : "Maximize"}</span>
      </button>
      {open && <PanelBody plantId={plantId} lineId={lineId} />}
    </section>
  );
}

function PanelBody({ plantId, lineId }: { plantId: string; lineId: string }) {
  const st = useSyncExternalStore(simStore.subscribe, () => simStore.version(), () => 0);
  void st;
  const s = simStore.get();
  useSimWindowBucket(5);
  const snap = useTargetSnapshot(plantId, lineId);
  const shift = getShiftInfo();
  const prevStart = shift.startSec - SHIFT_SECONDS;

  const line = getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const machines = (line?.machines ?? []).map((m) => m.code || m.id);
  const [machine, setMachine] = useState(machines[0] ?? "");
  const mc = machines.includes(machine) ? machine : (machines[0] ?? "");

  // ---- time
  const nowMs = getNowMs();
  const [timeText, setTimeText] = useState("");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setTimeText(TIME_FMT(nowMs));
  });
  const applyTime = (v: string) => {
    const ms = PARSE_WIB(v);
    if (ms === null) return;
    const lo = prevStart * 1000;
    const hi = shift.endSec * 1000 - 1000;
    simStore.setSimNowMs(Math.max(lo, Math.min(hi, ms)));
  };

  // ---- readouts
  const r = snap.result.shift;
  const pct = r.target > 0 ? (r.gap / r.target) * 100 : null;
  const progress = Math.round((snap.nowSec / SHIFT_SECONDS) * 100);

  // ---- output
  const [outPct, setOutPct] = useState(s.outputPct);
  useEffect(() => setOutPct(s.outputPct), [s.outputPct]);
  const [outNotice, setOutNotice] = useState("");
  const overridden = s.outputOverrides.some((o) => o.lineKey === `${plantId}:${lineId}` && o.shiftStartSec === shift.startSec);
  const ratioNow = r.target > 0 ? (r.actual / r.target) * 100 : null;

  // ---- SRR
  const srrLine = getLineSrr(plantId, lineId);
  const [srrText, setSrrText] = useState("");
  useEffect(() => setSrrText(srrLine === null ? "" : String(srrLine)), [srrLine]);
  const segs = snap.plan.segments;
  const running = snap.result.current;

  // ---- events / rejects
  const [kind, setKind] = useState<InjectKind>("downtime");
  const [minutes, setMinutes] = useState(15);
  const cards = rejectConfigStore.getCards(plantId, lineId, mc);
  const [slot, setSlot] = useState("");
  const slotId = cards.some((c) => c.l3Id === slot) ? slot : (cards[0]?.l3Id ?? "");
  const [qty, setQty] = useState(10);

  const plc = s.plcDowntimeRatio ?? 0.875;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div id="sim-panel-body" className="grid grid-cols-1 gap-3 px-3 pb-3 text-xs md:grid-cols-2 xl:grid-cols-3">
      {/* 1. Time */}
      <fieldset className={box}>
        <legend className={h}>Waktu</legend>
        <label className="block space-y-1">
          <span className="text-[11px] text-muted-foreground">Tanggal dan jam simulasi (shift sebelumnya dan shift berjalan, WIB)</span>
          <input
            type="datetime-local"
            data-testid="sim-datetime"
            className={`${inp} w-full`}
            min={TIME_FMT(prevStart * 1000)}
            max={TIME_FMT(shift.endSec * 1000 - 60000)}
            value={timeText}
            onFocus={() => (focused.current = true)}
            onBlur={() => (focused.current = false)}
            onChange={(e) => {
              setTimeText(e.target.value);
              applyTime(e.target.value);
            }}
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" className={btn} data-testid="sim-playpause" onClick={() => (s.paused ? simStore.resume() : simStore.pause())}>
            {s.paused ? <Play className="mr-1 size-3" /> : <Pause className="mr-1 size-3" />}
            {s.paused ? "Play" : "Pause"}
          </Button>
          {TIME_SCALES.map((x) => (
            <Button key={x} size="sm" variant={s.timeScale === x ? "default" : "outline"} className={btn} data-testid={`sim-speed-${x}`} aria-pressed={s.timeScale === x} onClick={() => simStore.setTimeScale(x)}>
              x{x}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lompat waktu">
          <Button size="sm" variant="outline" className={btn} data-testid="sim-jump-start" onClick={jumps.shiftStart}>Awal shift</Button>
          <Button size="sm" variant="outline" className={btn} data-testid="sim-jump-plus15" onClick={() => jumps.plusMinutes(15)}>+15 mnt</Button>
          {[60, 30, 20, 10, 0].map((m) => (
            <Button key={m} size="sm" variant="outline" className={btn} data-testid={`sim-jump-t${m}`} onClick={() => jumps.beforeEnd(m)}>T-{m}</Button>
          ))}
          <Button size="sm" variant="outline" className={btn} data-testid="sim-jump-next" onClick={jumps.nextShift}>Shift berikutnya</Button>
          <Button size="sm" variant="ghost" className={btn} data-testid="sim-reset-time" onClick={jumps.realTime}>Reset ke waktu nyata</Button>
        </div>
        <p className="text-[11px] text-muted-foreground" data-testid="sim-clock">
          {formatTimeWib(nowMs, true)} WIB | shift {shift.code} {formatTimeWib(shift.startSec)}-{formatTimeWib(shift.endSec)}
        </p>
      </fieldset>

      {/* 2. Actual vs Target + readouts */}
      <fieldset className={box}>
        <legend className={h}>Output</legend>
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>Actual vs Target (%)</span>
            <b data-testid="sim-output-value" className="text-foreground">{outPct}%</b>
          </span>
          <input
            type="range"
            min={50}
            max={130}
            step={1}
            data-testid="sim-output-slider"
            aria-label="Actual vs Target persen"
            value={outPct}
            onChange={(e) => {
              const v = Number(e.target.value);
              setOutPct(v);
              const r = applyActualVsTarget(plantId, lineId, v, s.outputApplyMode);
              setOutNotice(r.notice ?? "");
            }}
            className="w-full accent-violet-600"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Mode terapkan">
          {(
            [
              ["now", "Hit now (retro)"],
              ["marginal", "From now on (marginal)"],
            ] as const
          ).map(([m, label]) => (
            <label key={m} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="sim-apply"
                data-testid={`sim-apply-${m}`}
                checked={s.outputApplyMode === m}
                onChange={() => {
                  simStore.setOutputUi({ mode: m });
                  if (overridden) {
                    const r = applyActualVsTarget(plantId, lineId, outPct, m);
                    setOutNotice(r.notice ?? "");
                  }
                }}
              />
              {label}
            </label>
          ))}
          <Button
            size="sm"
            variant="outline"
            className={btn}
            data-testid="sim-output-reset"
            disabled={!overridden}
            onClick={() => {
              clearActualVsTarget(plantId, lineId);
              setOutNotice("");
            }}
          >
            Reset ke natural
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground" data-testid="sim-avt-now">
          Actual vs target now: <b className="text-foreground">{ratioNow === null ? "-" : `${ratioNow.toFixed(1)}%`}</b>
          {overridden ? ` (requested ${outPct}%)` : " (natural)"}
        </p>
        {outNotice && (
          <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800" data-testid="sim-output-notice">{outNotice}</p>
        )}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-muted/40 p-2" data-testid="sim-readouts">
          <dt className="text-muted-foreground">TOTAL TARGET OUTPUT</dt>
          <dd className="text-right font-mono font-bold" data-testid="sim-target">{r.target.toLocaleString()} pcs</dd>
          <dt className="text-muted-foreground">TOTAL ACTUAL OUTPUT</dt>
          <dd className="text-right font-mono font-bold" data-testid="sim-actual">{r.actual.toLocaleString()} pcs</dd>
          <dt className="text-muted-foreground">GAP OUTPUT</dt>
          <dd className="text-right font-mono font-bold" data-testid="sim-gap">
            {r.noStandard ? "-" : `${r.gap > 0 ? "+" : ""}${r.gap.toLocaleString()} pcs (${pct === null ? "-" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`})`}
          </dd>
          <dt className="text-muted-foreground">GAP WAKTU</dt>
          <dd className="text-right font-mono font-bold" data-testid="sim-gapmin">{r.gapMin === null ? "-" : formatGapMin(r.gapMin)}</dd>
          <dt className="text-muted-foreground">Progres shift</dt>
          <dd className="text-right font-mono font-bold" data-testid="sim-progress">{progress}%</dd>
        </dl>
      </fieldset>

      {/* 3. SRR */}
      <fieldset className={box}>
        <legend className={h}>SRR</legend>
        <div className="flex flex-wrap items-end gap-1.5">
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">SRR Line (pcs/min)</span>
            <input type="number" min={1} data-testid="sim-srr-line" className={`${inp} w-24`} value={srrText} placeholder="belum ada" onChange={(e) => setSrrText(e.target.value)} />
          </label>
          <Button size="sm" variant="outline" className={btn} data-testid="sim-srr-line-set" onClick={() => { const v = Number(srrText); if (v > 0) setSrrLine(plantId, lineId, v); }}>Terapkan</Button>
          <Button size="sm" variant="outline" className={btn} data-testid="sim-srr-line-unset" onClick={() => setSrrLine(plantId, lineId, null)}>Unset SRR Line</Button>
          <Button size="sm" variant="ghost" className={btn} data-testid="sim-srr-line-clear" onClick={() => setSrrLine(plantId, lineId, undefined)}>Master</Button>
        </div>
        <div className="space-y-1.5">
          {segs.map((seg) => (
            <SkuRow key={seg.key} po={seg.poNumber} label={seg.skuLabel} srr={seg.srr} running={running?.key === seg.key} />
          ))}
        </div>
      </fieldset>

      {/* 4a. Events */}
      <fieldset className={box}>
        <legend className={h}>Event dan reject</legend>
        <div className="flex flex-wrap items-end gap-1.5">
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">Mesin</span>
            <select data-testid="sim-machine" className={inp} value={mc} onChange={(e) => setMachine(e.target.value)}>
              {machines.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">Jenis</span>
            <select data-testid="sim-inject-kind" className={inp} value={kind} onChange={(e) => setKind(e.target.value as InjectKind)}>
              <option value="downtime">Downtime</option>
              <option value="minor_stop">Minor Stop</option>
              <option value="speed_loss">Speed Loss</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">Menit</span>
            <input type="number" min={kind === "downtime" ? 11 : 1} data-testid="sim-inject-min" className={`${inp} w-16`} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </label>
          <Button size="sm" className={btn} data-testid="sim-inject" disabled={!mc} onClick={() => { injectEvent(mc, kind, minutes); toast.success(`${kind} disisipkan di ${mc}`); }}>
            Sisipkan event
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-1.5">
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">Slot reject</span>
            <select data-testid="sim-reject-slot" className={inp} value={slotId} onChange={(e) => setSlot(e.target.value)}>
              {cards.map((c) => <option key={c.l3Id} value={c.l3Id}>{c.name} ({c.l2})</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">Qty</span>
            <input type="number" min={1} data-testid="sim-reject-qty" className={`${inp} w-16`} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </label>
          <Button size="sm" className={btn} data-testid="sim-reject-burst" disabled={!slotId} onClick={() => {
            const name = REJECT_TYPES.find((t) => t.id === slotId)?.name ?? slotId;
            rejectBurst(plantId, lineId, mc, slotId, name, qty);
            toast.success(`${qty} pcs reject ditambahkan`);
          }}>
            Reject burst
          </Button>
        </div>
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>Rasio alarm Downtime terhubung PLC</span>
            <b data-testid="sim-plc-value" className="text-foreground">{Math.round(plc * 100)}%</b>
          </span>
          <input type="range" min={0} max={100} step={5} data-testid="sim-plc-slider" aria-label="Rasio alarm PLC" value={Math.round(plc * 100)} onChange={(e) => sim.setPlcMappedRatio(Number(e.target.value) / 100)} className="w-full accent-violet-600" />
        </label>
      </fieldset>

      {/* 4b. Scenario + data */}
      <fieldset className={box}>
        <legend className={h}>Skenario dan data</legend>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Density</span>
            <select data-testid="sim-density" className={inp} value={s.density ?? "default"} onChange={(e) => e.target.value !== "default" && requestDensity(e.target.value as Density)}>
              <option value="default" disabled>Default per line</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="extreme">Extreme</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">PO</span>
            <select data-testid="sim-po-scenario" className={inp} value={currentPoScenario()} onChange={(e) => applyPoScenario(e.target.value as "single" | "three-sku" | "continued")}>
              <option value="single">Single SKU</option>
              <option value="three-sku">3 SKU + changeover (CR 5)</option>
              <option value="continued">PO lanjutan shift sebelumnya</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className={btn} data-testid="sim-qa" onClick={triggerQaAlert}>Trigger QA alert</Button>
          <Button size="sm" variant="outline" className={btn} data-testid="sim-reset-overrides" onClick={() => { resetOverrides(); toast.info("Override dikembalikan ke default live"); }}>Reset override</Button>
          <Button size="sm" variant="outline" className={btn} data-testid="sim-reset-data" onClick={() => { resetSimulationData(); toast.info("Data demo direset"); }}>Reset data demo</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className={btn} data-testid="sim-export" onClick={() => {
            const blob = new Blob([JSON.stringify(exportSimState(), null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "simulation-state.json";
            a.click();
            URL.revokeObjectURL(a.href);
          }}>
            Export state
          </Button>
          <Button size="sm" variant="outline" className={btn} data-testid="sim-import" onClick={() => fileRef.current?.click()}>Import state</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            data-testid="sim-import-file"
            className="sr-only"
            aria-label="Import state simulasi"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const err = importSimState(JSON.parse(await f.text()));
                if (err) toast.error(err);
                else toast.success("State simulasi dipulihkan");
              } catch {
                toast.error("File tidak bisa dibaca");
              }
            }}
          />
        </div>
      </fieldset>
    </div>
  );
}

function SkuRow({ po, label, srr, running }: { po: string; label: string; srr: number | null; running: boolean }) {
  const [txt, setTxt] = useState(srr === null ? "" : String(srr));
  useEffect(() => setTxt(srr === null ? "" : String(srr)), [srr]);
  return (
    <div className="flex flex-wrap items-end gap-1.5" data-testid={`sim-sku-${po}`}>
      <label className="space-y-1">
        <span className="block text-[11px] text-muted-foreground">
          SRR {label} ({po}){running ? " - berjalan" : ""}
        </span>
        <input type="number" min={1} className={`${inp} w-24`} data-testid={`sim-sku-input-${po}`} value={txt} placeholder="belum ada" onChange={(e) => setTxt(e.target.value)} />
      </label>
      <Button size="sm" variant="outline" className={btn} data-testid={`sim-sku-set-${po}`} onClick={() => { const v = Number(txt); if (v > 0) simStore.setSrrSkuOverride(po, v); }}>Terapkan</Button>
      {running && (
        <Button size="sm" variant="outline" className={btn} data-testid="sim-sku-unset" onClick={() => simStore.setSrrSkuOverride(po, null)}>Unset SRR SKU</Button>
      )}
    </div>
  );
}
