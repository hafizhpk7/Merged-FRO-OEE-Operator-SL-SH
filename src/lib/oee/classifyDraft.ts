/**
 * Pure draft logic for the CR 2 single-mode Classify modal (GR-05).
 * Kept free of React so it can be exercised by the dev self-test.
 * All times are seconds from the START OF THE WINDOW (0..totalSec).
 */
export const STEP_SEC = 30;

export type DraftCause = {
  key: string;
  categoryId: string;
  reasonId: string;
  end: number;
  desc: string;
};

export const isCauseComplete = (c: DraftCause) => !!c.categoryId && !!c.reasonId;

/** First cause starts at the window start; later causes start at the previous end (locked). */
export function startOf(causes: DraftCause[], i: number): number {
  return i === 0 ? 0 : (causes[i - 1]?.end ?? 0);
}

/** Selectable end times: 30 s steps strictly after start, ending at the window end. */
export function endOptions(causes: DraftCause[], i: number, totalSec: number): number[] {
  const out: number[] = [];
  for (let t = startOf(causes, i) + STEP_SEC; t < totalSec; t += STEP_SEC) out.push(t);
  out.push(totalSec);
  return out;
}

/** Changing an end time cuts every later cause. */
export function changeEnd(causes: DraftCause[], i: number, end: number): DraftCause[] {
  return causes.slice(0, i + 1).map((c, idx) => (idx === i ? { ...c, end } : c));
}

/** Removing a cause removes it and all later ones; the new last cause is stretched to the end. */
export function removeCause(causes: DraftCause[], i: number, totalSec: number): DraftCause[] {
  const next = causes.slice(0, i);
  const last = next[next.length - 1];
  if (last) next[next.length - 1] = { ...last, end: totalSec };
  return next;
}

/** "+ Add cause" is available only while duration remains. */
export function canAddCause(causes: DraftCause[], totalSec: number): boolean {
  return (causes[causes.length - 1]?.end ?? 0) < totalSec;
}

export function coverage(causes: DraftCause[], totalSec: number) {
  const allComplete = causes.length > 0 && causes.every(isCauseComplete);
  const coveredSec = causes.reduce(
    (s, c, i) => (isCauseComplete(c) ? s + (c.end - startOf(causes, i)) : s),
    0,
  );
  return { coveredSec, allComplete, fullyCovered: allComplete && coveredSec >= totalSec };
}

/** Save rule: whole duration covered by complete causes, unless partial save is allowed. */
export function canSaveSingle(
  causes: DraftCause[],
  totalSec: number,
  allowPartial: boolean,
): boolean {
  return allowPartial ? causes.some(isCauseComplete) : coverage(causes, totalSec).fullyCovered;
}
