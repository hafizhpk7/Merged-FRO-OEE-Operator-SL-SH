/**
 * Simulation "Actual vs Target (%)": makes TOTAL ACTUAL OUTPUT (gross, before reject) equal
 * pct x TOTAL TARGET OUTPUT of the same scope and SRR switch the dashboard uses (CR 5 target logic,
 * reused through getTargetSnapshot; the formula is not duplicated here).
 *
 * - "now" (Hit now, retro): k = (pct x target(now) - output of non-Effective windows) / output of
 *   Effective windows, computed once at apply time. The Effective windows up to now get exact integer
 *   outputs (largest-remainder style rounding in line units, so the total is within +-1 pcs); later
 *   windows keep the same k. Past windows never change afterwards.
 * - "marginal" (From now on): k is computed so that the windows after the apply time give
 *   pct x their own target; earlier windows stay as they are.
 * Minor Stop, Downtime, Speed Loss and NSL windows keep their output; events, statuses, tags and the OEE
 * availability/performance math do not change (SIM_OUTPUT_AFFECTS_OEE = false).
 */
import { getMachineStandard, getRepresentativeAsset } from "./assetMaster";
import { getMachineProfile, getShiftTimeline } from "./machineEvents";
import { withNaturalOutput } from "./outputOverride";
import { getNowMs, getShiftInfo } from "./shiftClock";
import { simStore, type OutputApplyMode, type OutputOverrideSeg } from "./simStore";
import { srrStore } from "./srrStore";
import { getTargetSnapshot } from "./targetService";

export type ApplyResult = { ok: boolean; notice?: string; k?: number };

type Row = { i: number; line: number; machine: number; f: number; scalable: boolean };

/**
 * One row per revealed window. `machine` is the machine output the factor k applies to and `f` the
 * machine -> line conversion, so scalable output in line units is machine x f. Normal mode scales the
 * Effective windows. Spread mode (no Effective window exists) uses the Downtime / Minor Stop windows
 * with the nominal running output instead, so output can still be simulated.
 */
function rowsOf(
  snap: ReturnType<typeof getTargetSnapshot>,
  tl: ReturnType<typeof getShiftTimeline>,
  spread: boolean,
  ideal: number,
): Row[] {
  const evType = new Map(tl.events.map((e) => [e.id, e.type]));
  const rows: Row[] = [];
  for (let i = 0; i < snap.windows.length; i++) {
    const mw = tl.windows[i];
    const lw = snap.windows[i];
    if (!mw || !lw) break;
    if (!spread) {
      const scalable = mw.type === "run" && !(mw.eventId && evType.get(mw.eventId) === "negative_speed_loss");
      rows.push({ i, line: lw.output, machine: mw.output, f: mw.output > 0 ? lw.output / mw.output : 0, scalable });
      continue;
    }
    const mid = mw.startSec + 15;
    const seg = snap.plan.segments.find((sg) => mid >= sg.startSec && mid < sg.stopSec);
    const skuRate = seg ? (seg.srr ?? snap.srrLine ?? ideal) : 0;
    const scalable = (mw.type === "downtime" || mw.type === "minor_stop") && skuRate > 0;
    rows.push({ i, line: lw.output, machine: scalable ? ideal / 2 : mw.output, f: scalable ? skuRate / ideal : mw.output > 0 ? lw.output / mw.output : 0, scalable });
  }
  return rows;
}

/** Integer machine outputs m_i = k x natural_i with sum(m_i x f_i) as close as possible to `want`. */
function fitIntegers(rows: Row[], k: number, want: number): Record<number, number> {
  const sc = rows.filter((r) => r.scalable && r.f > 0);
  const m = new Map<number, number>();
  for (const r of sc) m.set(r.i, Math.max(0, Math.round(k * r.machine)));
  const total = () => sc.reduce((a, r) => a + (m.get(r.i) as number) * r.f, 0);
  let err = want - total();
  const fmin = sc.length ? Math.min(...sc.map((r) => r.f)) : 1;
  // largest remainder: spend the error one unit at a time on the windows rounded furthest the wrong way
  const frac = (r: Row) => k * r.machine - (m.get(r.i) as number);
  for (let guard = 0; guard < sc.length * 4 && Math.abs(err) > fmin / 2; guard++) {
    const order = [...sc].sort((a, b) => (err > 0 ? frac(b) - frac(a) : frac(a) - frac(b)));
    let moved = false;
    for (const r of order) {
      if (Math.abs(err) <= fmin / 2) break;
      const cur = m.get(r.i) as number;
      if (err > 0) {
        m.set(r.i, cur + 1);
        err -= r.f;
        moved = true;
      } else if (cur > 0) {
        m.set(r.i, cur - 1);
        err += r.f;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const out: Record<number, number> = {};
  for (const r of sc) out[r.i] = m.get(r.i) as number;
  return out;
}

export function applyActualVsTarget(plantId: string, lineId: string, pct: number, mode: OutputApplyMode): ApplyResult {
  const shift = getShiftInfo();
  const lineKey = `${plantId}:${lineId}`;
  const bn = getRepresentativeAsset(plantId, lineId);
  const srrMode = srrStore.get();
  const nowMs = getNowMs();

  // keep earlier marginal segments when this one is marginal; everything else is replaced
  const prior = simStore.get().outputOverrides.filter((o) => o.lineKey === lineKey && o.shiftStartSec === shift.startSec);
  const keepPrior = mode === "marginal" ? prior : [];

  // baseline = natural output (every override ignored) for the retro maths; marginal also needs the current state
  const base = withNaturalOutput(() => {
    const snap = getTargetSnapshot(plantId, lineId, srrMode, nowMs, null);
    const tl = getShiftTimeline(bn, shift, snap.nowSec, plantId, "this-shift", lineId);
    return { snap, tl };
  });
  const N = base.snap.windows.length;
  const T = base.snap.result.shift.target;
  if (base.snap.result.shift.noStandard || !(T > 0)) {
    simStore.setOutputOverrides(lineKey, shift.startSec, keepPrior);
    return { ok: false, notice: "Tidak ada standard (target 0): override tidak diterapkan." };
  }
  const ideal = Math.max(1, getMachineStandard(plantId, lineId, bn) ?? getMachineProfile(bn).idealRatePpm);
  let spread = false;
  let rows = rowsOf(base.snap, base.tl, false, ideal);
  if (mode === "now" && !rows.some((r) => r.scalable && r.line > 0)) {
    // no Effective window yet: spread the output over the stopped windows so it can still be simulated
    spread = true;
    rows = rowsOf(base.snap, base.tl, true, ideal);
  }
  const sumLine = rows.reduce((a, r) => a + r.line, 0);
  const offset = base.snap.result.shift.actual - sumLine;
  let seg: OutputOverrideSeg;
  let notice: string | undefined;

  if (mode === "now") {
    const E = rows.filter((r) => r.scalable).reduce((a, r) => a + r.machine * r.f, 0);
    const S = rows.filter((r) => !r.scalable).reduce((a, r) => a + r.line, 0);
    if (!(E > 0)) {
      simStore.setOutputOverrides(lineKey, shift.startSec, keepPrior);
      return { ok: false, notice: "Belum ada output Effective untuk diskalakan: override tidak diterapkan." };
    }
    const want = Math.round((pct / 100) * T) - offset;
    let k = (want - S) / E;
    if (k < 0) {
      k = 0;
      notice = "Target tidak tercapai: output Speed Loss dan NSL sudah melebihi nilai yang diminta, Effective dibatasi ke 0.";
    }
    if (spread) notice = "Belum ada window Effective: output disimulasikan merata di window Downtime/Minor Stop (status window tidak berubah)." + (notice ? " " + notice : "");
    seg = {
      lineKey,
      shiftStartSec: shift.startSec,
      mode,
      pct,
      appliedIdx: N,
      machine: bn,
      fixed: fitIntegers(rows, k, Math.max(0, want - S)),
      kPast: k,
      kAfter: k,
      ...(spread ? { spread: true } : {}),
      ...(notice ? { notice } : {}),
    };
  } else {
    // marginal: the rest of the shift gives pct x its own target (computed once, from the natural schedule)
    const endSnap = withNaturalOutput(() => getTargetSnapshot(plantId, lineId, srrMode, shift.endSec * 1000 - 1, null));
    const endTl = withNaturalOutput(() => getShiftTimeline(bn, shift, endSnap.nowSec, plantId, "this-shift", lineId));
    let mSpread = false;
    let endRows = rowsOf(endSnap, endTl, false, ideal).filter((r) => r.i >= N);
    if (!endRows.some((r) => r.scalable && r.line > 0)) {
      mSpread = true;
      endRows = rowsOf(endSnap, endTl, true, ideal).filter((r) => r.i >= N);
    }
    const Tf = endSnap.result.shift.target - T;
    const Ef = endRows.filter((r) => r.scalable).reduce((a, r) => a + r.machine * r.f, 0);
    const Sf = endRows.filter((r) => !r.scalable).reduce((a, r) => a + r.line, 0);
    if (!(Ef > 0) || !(Tf > 0)) {
      simStore.setOutputOverrides(lineKey, shift.startSec, keepPrior);
      return { ok: false, notice: "Sisa shift tidak punya output Effective atau target: override tidak diterapkan." };
    }
    let k = (Math.round((pct / 100) * Tf) - Sf) / Ef;
    if (k < 0) {
      k = 0;
      notice = "Target tidak tercapai: output Speed Loss dan NSL sudah melebihi nilai yang diminta, Effective dibatasi ke 0.";
    }
    seg = {
      lineKey,
      shiftStartSec: shift.startSec,
      mode,
      pct,
      appliedIdx: N,
      machine: bn,
      fixed: {},
      kPast: 1,
      kAfter: k,
      ...(mSpread ? { spread: true } : {}),
      ...(notice ? { notice } : {}),
    };
    if (mSpread) seg.notice = "Belum ada window Effective: output disimulasikan merata di window Downtime/Minor Stop (status window tidak berubah)." + (notice ? " " + notice : "");
  }
  const merged = [...keepPrior.filter((p) => !(p.mode === "marginal" && p.appliedIdx === seg.appliedIdx)), seg];
  simStore.setOutputOverrides(lineKey, shift.startSec, merged);
  simStore.setOutputUi({ pct, mode, natural: false });
  const note = seg.notice ?? notice;
  return { ok: true, k: seg.kAfter, ...(note ? { notice: note } : {}) };
}

/** Natural output again for this line and shift (baseline numbers restored exactly). */
export function clearActualVsTarget(plantId: string, lineId: string): void {
  const shift = getShiftInfo();
  simStore.setOutputOverrides(`${plantId}:${lineId}`, shift.startSec, []);
  simStore.setOutputUi({ natural: true });
}

/** Gross actual / target of the dashboard scope now (same snapshot the dashboard reads). */
export function actualVsTargetNow(plantId: string, lineId: string): { ratioPct: number | null; target: number; actual: number } {
  const snap = getTargetSnapshot(plantId, lineId, srrStore.get());
  const t = snap.result.shift.target;
  const a = snap.result.shift.actual;
  return { ratioPct: t > 0 ? (a / t) * 100 : null, target: t, actual: a };
}
