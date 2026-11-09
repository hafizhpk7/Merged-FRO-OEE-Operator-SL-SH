/**
 * Simulation "Actual vs Target": evaluation of an applied output override for one Effective window.
 * Only the output counts of Effective windows change; statuses, events, tags and the OEE
 * availability/performance math do not (SIM_OUTPUT_AFFECTS_OEE = false).
 */
import { simStore, type OutputOverrideSeg } from "./simStore";

export const SIM_OUTPUT_AFFECTS_OEE = false;

let suspended = false;

/** True while the natural (baseline) output is being computed. */
export const isOutputSuspended = () => suspended;

/** Runs `fn` with every override ignored, to get the baseline numbers. */
export function withNaturalOutput<T>(fn: () => T): T {
  const prev = suspended;
  suspended = true;
  try {
    return fn();
  } finally {
    suspended = prev;
  }
}

function segsOf(lineKey: string, shiftStartSec: number): OutputOverrideSeg[] {
  const all = simStore.get().outputOverrides;
  const out: OutputOverrideSeg[] = [];
  for (const s of all) if (s.lineKey === lineKey && s.shiftStartSec === shiftStartSec) out.push(s);
  return out;
}

/**
 * Output of an Effective window. `natural` is the unrounded generated output; the result equals it
 * when no override applies, otherwise it is an integer. Newest override first: a retro segment owns
 * every window (its exact integers before `appliedIdx`, factor `kAfter` after); a marginal segment
 * only owns the windows from `appliedIdx` on.
 */
export function windowOutput(lineKey: string, shiftStartSec: number, machine: string, idx: number, natural: number): number {
  if (suspended || simStore.get().outputOverrides.length === 0) return natural;
  const segs = segsOf(lineKey, shiftStartSec);
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i] as OutputOverrideSeg;
    if (idx >= s.appliedIdx) return Math.round(natural * s.kAfter);
    if (s.mode === "now") {
      if (machine === s.machine) {
        const fx = s.fixed[idx];
        return fx !== undefined ? fx : Math.round(natural * s.kPast);
      }
      return Math.round(natural * s.kPast);
    }
  }
  return natural;
}

export function hasOutputOverride(lineKey: string, shiftStartSec: number): boolean {
  return segsOf(lineKey, shiftStartSec).length > 0;
}
