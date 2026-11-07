/**
 * Filter rules taken from BR 2.5 / URS 3.2.1 — unchanged by the After mockups.
 * Span max 1 month, resolution options constrained by span length with auto-snap.
 */

export type SpanId =
  "today" | "yesterday" | "last-3-days" | "this-week" | "last-week" | "last-month";

export type ResolutionId = "15m" | "1h" | "12h" | "1d";

export const SPANS: { id: SpanId; label: string; days: number }[] = [
  { id: "today", label: "Today", days: 1 },
  { id: "yesterday", label: "Yesterday", days: 1 },
  { id: "last-3-days", label: "Last 3 days", days: 3 },
  { id: "this-week", label: "This week", days: 7 },
  { id: "last-week", label: "Last week", days: 7 },
  { id: "last-month", label: "Last month (max)", days: 30 },
];

export const RESOLUTIONS: { id: ResolutionId; label: string; minutes: number }[] = [
  { id: "15m", label: "15 minutes", minutes: 15 },
  { id: "1h", label: "1 hour", minutes: 60 },
  { id: "12h", label: "12 hours", minutes: 720 },
  { id: "1d", label: "1 day", minutes: 1440 },
];

export function spanDays(span: SpanId): number {
  return SPANS.find((s) => s.id === span)?.days ?? 1;
}

/** ≤1 day → down to 15 min; 2 days–1 week → down to 12 h; 1 week–1 month → down to 1 day. */
export function allowedResolutions(span: SpanId): ResolutionId[] {
  const days = spanDays(span);
  if (days <= 1) return ["15m", "1h", "12h", "1d"];
  if (days <= 7) return ["12h", "1d"];
  return ["1d"];
}

/** Snap to the nearest coarser valid resolution, never error. */
export function snapResolution(span: SpanId, current: ResolutionId): ResolutionId {
  const allowed = allowedResolutions(span);
  if (allowed.includes(current)) return current;
  return allowed[0] as ResolutionId;
}

export const PERIODS = [
  { id: "live", label: "LIVE" },
  { id: "last-shift", label: "Last Shift" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This Week" },
  { id: "last-week", label: "Last Week" },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

export function isLive(period: PeriodId) {
  return period === "live";
}
