/**
 * Event density (simulation): splits the SAME loss time of a shift into more, shorter events.
 *
 * Minor Stop and Speed Loss windows of the base schedule are re-laid as pieces that alternate
 * Effective / Minor Stop / Effective / Speed Loss every 1-3 minutes ("high") or every 30-60 s
 * ("extreme"). Per type the number of 30 s windows is unchanged, so totals, OEE and the calibration
 * check do not move. Downtime (> 10 min), Planned Downtime and Negative Speed Loss spans stay as is.
 * Pure and deterministic per (seed, density); shared by the timeline and the closed-shift totals.
 */
import { makeRng } from "./rng";
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { simStore, type Density } from "./simStore";
import { EVENT_DENSITY } from "./config";


const WINDOW_SEC = 30;
const WINDOWS = 960;
/** Minor Stop is 10 min or less (20 windows). */
const MAX_MS_WINDOWS = 20;

export type DenseSpanType = "planned" | "downtime" | "minor_stop" | "speed_loss" | "nsl";
export type DenseSpan = {
  startSec: number;
  endSec: number;
  type: DenseSpanType;
  speedPct?: number;
  /** Kept (Planned / Downtime) spans: index of the input span they come from. */
  src?: number;
};
export type Obstacle = { startSec: number; endSec: number; speedPct?: number };

/** Density of a machine: simulation override, else the line default (pilot lines "high"). */
export function getMachineDensity(plantId: string, machineCode: string): Density {
  const o = simStore.get().density;
  if (o) return o;
  const line = J2_LINES_CONFIG.find((l) => l.machines.some((m) => m.code === machineCode));
  if (plantId === "J2" && line && EVENT_DENSITY.pilotLines.includes(line.code)) return EVENT_DENSITY.pilot;
  return EVENT_DENSITY.other;
}

const RANGE: Record<Exclude<Density, "normal">, [number, number]> = {
  high: [2, 6], // 1-3 minutes
  extreme: [1, 2], // 30-60 seconds
};

type Owned = { start: number; end: number; type: string; pct?: number; src?: number };

/** Owner (index into `all`) of every window, with the same walker the window loops use. */
function ownersOf(all: Owned[]): number[] {
  const owner = new Array<number>(WINDOWS).fill(-1);
  let ei = 0;
  for (let w = 0; w < WINDOWS; w++) {
    const mid = w * WINDOW_SEC + WINDOW_SEC / 2;
    while (ei < all.length && (all[ei]?.end ?? 0) <= mid) ei++;
    const cur = all[ei];
    if (cur && cur.start <= mid && mid < cur.end) owner[w] = ei;
  }
  return owner;
}

export function densifySpans(
  base: DenseSpan[],
  nsl: Obstacle[],
  seed: string,
  density: Density,
): DenseSpan[] {
  if (density === "normal") return base;
  const [lo, hi] = RANGE[density];
  const all: Owned[] = [
    ...base.map((b, i) => ({ start: b.startSec, end: b.endSec, type: b.type, src: i, ...(b.speedPct !== undefined ? { pct: b.speedPct } : {}) })),
    ...nsl.map((n) => ({ start: n.startSec, end: n.endSec, type: "nsl", pct: (n as Obstacle & { speedPct?: number }).speedPct ?? 125 })),
  ].sort((a, b) => a.start - b.start);
  const owner = ownersOf(all);
  const typeAt = (w: number) => (owner[w] === -1 ? "run" : (all[owner[w] as number]?.type ?? "run"));
  const isFree = (w: number) => {
    const t = typeAt(w);
    return t === "run" || t === "minor_stop" || t === "speed_loss";
  };

  // MS / SL events that own windows, in order, with their window ranges
  type Ev = { idx: number; type: "minor_stop" | "speed_loss"; pct: number; first: number; last: number; n: number };
  const evs: Ev[] = [];
  const byIdx = new Map<number, Ev>();
  for (let w = 0; w < WINDOWS; w++) {
    const oi = owner[w] as number;
    if (oi === -1) continue;
    const o = all[oi] as Owned;
    if (o.type !== "minor_stop" && o.type !== "speed_loss") continue;
    let e = byIdx.get(oi);
    if (!e) {
      e = { idx: oi, type: o.type, pct: o.pct ?? 78, first: w, last: w, n: 0 };
      byIdx.set(oi, e);
      evs.push(e);
    }
    e.last = w;
    e.n += 1;
  }

  // groups of up to two consecutive MS/SL events with nothing but free windows between them
  const groups: Ev[][] = [];
  for (const e of evs) {
    const g = groups[groups.length - 1];
    const prev = g?.[g.length - 1];
    let adjacent = !!g && g.length < 2 && !!prev;
    if (adjacent && prev) for (let w = prev.last + 1; w < e.first; w++) if (!isFree(w)) adjacent = false;
    if (adjacent && g) g.push(e);
    else groups.push([e]);
  }

  const pieces: DenseSpan[] = [];
  let prevRegionEnd = -1;
  groups.forEach((g, gi) => {
    const fw = (g[0] as Ev).first;
    const lw = (g[g.length - 1] as Ev).last;
    const nextFw = groups[gi + 1]?.[0]?.first ?? WINDOWS;
    let re = lw;
    while (re + 1 < Math.min(nextFw, WINDOWS) && isFree(re + 1)) re++;
    const rs = Math.max(fw, prevRegionEnd + 1);
    prevRegionEnd = re;

    // budgets
    let msLeft = g.filter((e) => e.type === "minor_stop").reduce((a, e) => a + e.n, 0);
    const slRuns = g.filter((e) => e.type === "speed_loss").map((e) => ({ pct: e.pct, n: e.n }));
    const rng = makeRng(`${seed}:dense:${density}:${gi}`);
    const len = () => lo + Math.floor(rng() * (hi - lo + 1));

    const list: { type: "minor_stop" | "speed_loss"; n: number; pct: number }[] = [];
    let want: "minor_stop" | "speed_loss" = (g[0] as Ev).type;
    while (msLeft > 0 || slRuns.length > 0) {
      let t = want;
      if (t === "minor_stop" && msLeft === 0) t = "speed_loss";
      if (t === "speed_loss" && slRuns.length === 0) t = "minor_stop";
      if (t === "minor_stop") {
        const n = Math.max(1, Math.min(len(), msLeft, MAX_MS_WINDOWS));
        list.push({ type: t, n, pct: 0 });
        msLeft -= n;
      } else {
        const run = slRuns[0] as { pct: number; n: number };
        const n = Math.max(1, Math.min(len(), run.n));
        list.push({ type: t, n, pct: run.pct });
        run.n -= n;
        if (run.n <= 0) slRuns.shift();
      }
      want = t === "minor_stop" ? "speed_loss" : "minor_stop";
    }

    const L = list.reduce((a, p) => a + p.n, 0);
    const gaps = list.map(() => len());
    const regionLen = re - rs + 1;
    let total = L + gaps.reduce((a, b) => a + b, 0);
    while (total > regionLen) {
      let k = 0;
      for (let i = 1; i < gaps.length; i++) if ((gaps[i] ?? 0) > (gaps[k] ?? 0)) k = i;
      if ((gaps[k] ?? 0) <= 0) break;
      gaps[k] = (gaps[k] ?? 0) - 1;
      total -= 1;
    }
    let w = rs;
    list.forEach((p, i) => {
      w += gaps[i] ?? 0;
      const startSec = w * WINDOW_SEC;
      const endSec = (w + p.n) * WINDOW_SEC;
      {
        pieces.push({
          startSec,
          endSec,
          type: p.type,
          ...(p.type === "speed_loss" ? { speedPct: p.pct } : {}),
        });
      }
      w += p.n;
    });
  });

  // Kept spans are normalized to the windows they own (overlaps of the base schedule resolved the
  // same way the window loops do), so pieces and kept spans never overlap and every window keeps its type.
  const kept: DenseSpan[] = [];
  const runs = new Map<number, { first: number; last: number }>();
  for (let w = 0; w < WINDOWS; w++) {
    const oi = owner[w] as number;
    if (oi === -1) continue;
    const o = all[oi] as Owned;
    if (o.type === "minor_stop" || o.type === "speed_loss") continue;
    const r = runs.get(oi);
    if (r) r.last = w;
    else runs.set(oi, { first: w, last: w });
  }
  for (const [oi, r] of runs) {
    const o = all[oi] as Owned;
    kept.push({
      startSec: r.first * WINDOW_SEC,
      endSec: (r.last + 1) * WINDOW_SEC,
      type: o.type as DenseSpanType,
      ...(o.type === "nsl" ? { speedPct: o.pct ?? 125 } : {}),
      ...(o.src !== undefined ? { src: o.src } : {}),
    });
  }
  return [...kept, ...pieces].sort((a, b) => a.startSec - b.startSec);
}
