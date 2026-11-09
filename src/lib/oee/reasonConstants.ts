import type { LossParent } from "./lossTree";

/**
 * Matrix mapping OEE Event Types to allowed Parent Issues (L1).
 * Master v2 compliant.
 */
export type ClassifiableType = "downtime" | "minor_stop" | "speed_loss";

export const CLASSIFIABLE_TYPES: ClassifiableType[] = [
  "downtime",
  "minor_stop",
  "speed_loss",
];

export const CLASSIFIABLE_LABEL: Record<ClassifiableType, { code: string; name: string }> = {
  downtime: { code: "D", name: "Downtime" },
  minor_stop: { code: "MS", name: "Minor Stop" },
  speed_loss: { code: "SL", name: "Speed Loss" },
};

export const REASON_L1_BY_TYPE: Record<ClassifiableType, LossParent[]> = {
  downtime: ["Planned Downtime", "Unscheduled", "Breakdown", "Setup / Changeover"],
  minor_stop: ["Planned Downtime", "Unscheduled", "Minor Stop"],
  speed_loss: ["Speed Loss"],
};

/**
 * CR 2 GR-05: single-mode Save is enabled only when the whole window duration is covered by
 * complete causes. Set to true to restore the earlier behaviour (partial coverage can be saved;
 * the window then stays in Uncommented until fully covered).
 */
export const CLASSIFY_ALLOW_PARTIAL_SAVE = false;

/**
 * Shift Closing Blocker Mode:
 * - "soft": Allows "Finish anyway" button when unclassified losses exist
 * - "hard": Hides "Finish anyway" button, requiring 100% classification before ending shift
 */
export const END_SHIFT_BLOCK_MODE: "soft" | "hard" = "soft";

/**
 * Timeline Segment Colors (CSS Class and Hex tokens)
 */
export const TIMELINE_COLORS = {
  effective: {
    solid: "bg-emerald-500 border-emerald-600 text-white",
    hex: "#10b981",
    label: "Effective",
  },
  downtime: {
    solid: "bg-red-500 border-red-600 text-white",
    tint: "bg-red-200 border-red-300 text-red-900 dark:bg-red-950/60 dark:border-red-800 dark:text-red-200",
    hex: "#ef4444",
    tintHex: "#fca5a5",
    label: "Downtime",
  },
  minor_stop: {
    solid: "bg-purple-500 border-purple-600 text-white",
    tint: "bg-purple-200 border-purple-300 text-purple-900 dark:bg-purple-950/60 dark:border-purple-800 dark:text-purple-200",
    hex: "#a855f7",
    tintHex: "#e9d5ff",
    label: "Minor Stop",
  },
  speed_loss: {
    solid: "bg-amber-500 border-amber-600 text-white",
    tint: "bg-amber-200 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200",
    hex: "#f59e0b",
    tintHex: "#fde68a",
    label: "Speed Loss",
  },
  negative_speed_loss: {
    hatched:
      "bg-[repeating-linear-gradient(45deg,#10b981,#10b981_8px,#047857_8px,#047857_16px)] text-white",
    hex: "#047857",
    label: "Negative Speed Loss",
  },
  planned: {
    solid: "bg-slate-500 border-slate-600 text-white",
    hex: "#6b7280",
    label: "Planned Downtime",
  },
  not_available: {
    hatched:
      "bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_6px,#d1d5db_6px,#d1d5db_12px)] dark:bg-[repeating-linear-gradient(45deg,#374151,#374151_6px,#1f2937_6px,#1f2937_12px)] text-muted-foreground",
    hex: "#d1d5db",
    label: "Not Available / Unscheduled",
  },
  future: {
    hatched:
      "bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_8px,#e5e7eb_8px,#e5e7eb_16px)] dark:bg-[repeating-linear-gradient(45deg,#1e293b,#1e293b_8px,#0f172a_8px,#0f172a_16px)] text-muted-foreground/60",
    label: "Not Started",
  },
};
