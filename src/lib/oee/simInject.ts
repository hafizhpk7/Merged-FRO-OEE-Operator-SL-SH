/** Helpers to merge injected demo events (simStore.injected) into a generated schedule. */

export type Span = { startSec: number; endSec: number };

/**
 * Removes the part of every event that an injected span [a, b) overlaps. An event that starts before
 * `a` keeps its head (the tail after `b` is dropped); an event that starts inside keeps what is after `b`.
 */
export function trimForInjected<T extends Span>(
  events: T[],
  inj: Span,
  patch: (e: T, p: { startSec?: number; endSec?: number }) => T,
): T[] {
  const out: T[] = [];
  for (const e of events) {
    if (e.endSec <= inj.startSec || e.startSec >= inj.endSec) {
      out.push(e);
      continue;
    }
    if (e.startSec < inj.startSec) out.push(patch(e, { endSec: inj.startSec }));
    else if (e.endSec > inj.endSec) out.push(patch(e, { startSec: inj.endSec }));
  }
  return out;
}

export const overlapsAny = (s: Span, list: Span[]) => list.some((i) => s.endSec > i.startSec && s.startSec < i.endSec);
