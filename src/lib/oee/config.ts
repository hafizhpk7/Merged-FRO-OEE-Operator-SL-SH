/**
 * Central, easily editable configuration for the OEE prototype.
 * TODO/confirm: OEE tier thresholds and sensor warning limits are EXAMPLES only
 * (§7 point 6) — product team has not finalised them. Edit here, nowhere else.
 */

export const MACHINE_OUTPUT_LABEL = "Machine Output";

export const OEE_TIERS = {
  good: 75, // >= good  -> green
  warn: 65, // >= warn   -> orange
  // below warn -> red
} as const;

export type Tier = "good" | "warn" | "bad";

export function tierOf(value: number): Tier {
  if (value >= OEE_TIERS.good) return "good";
  if (value >= OEE_TIERS.warn) return "warn";
  return "bad";
}

export const TIER_TEXT: Record<Tier, string> = {
  good: "text-tier-good",
  warn: "text-tier-warn",
  bad: "text-tier-bad",
};

export const TIER_BG: Record<Tier, string> = {
  good: "bg-tier-good",
  warn: "bg-tier-warn",
  bad: "bg-tier-bad",
};

export const TIER_HEX: Record<Tier, string> = {
  good: "var(--tier-good)",
  warn: "var(--tier-warn)",
  bad: "var(--tier-bad)",
};

export type Status = "running" | "slow" | "down" | "idle";

export const STATUS_LABEL: Record<Status, string> = {
  running: "Running",
  slow: "Slow",
  down: "Down",
  idle: "Idle",
};

export const STATUS_HEX: Record<Status, string> = {
  running: "var(--status-running)",
  slow: "var(--status-slow)",
  down: "var(--status-down)",
  idle: "var(--status-idle)",
};

export const STATUS_DOT: Record<Status, string> = {
  running: "bg-status-running",
  slow: "bg-status-slow",
  down: "bg-status-down",
  idle: "bg-status-idle",
};

export const STATUS_LAMP_MAP: Record<Status, string> = {
  running: "green",
  slow: "amber",
  down: "red",
  idle: "off",
};

/** Machine Informations sensor spec (§4.1.5). */
export type SensorSpec = {
  key: string;
  label: string;
  group: "Temperature (°C)" | "Pressure (bar)" | "Drive & Throughput";
  unit: string;
  min: number;
  max: number;
  /** value above this renders red */
  warnAbove: number;
  decimals?: number;
};

// TODO/confirm (§7 point 7): one shared field set for every machine type in the
// prototype; business may want per-type parameter lists (filler/wrapper/cartoner).
export const SENSOR_SPEC: SensorSpec[] = [
  {
    key: "motorWinding",
    label: "Motor winding",
    group: "Temperature (°C)",
    unit: "°C",
    min: 48,
    max: 82,
    warnAbove: 75,
    decimals: 1,
  },
  {
    key: "bearing",
    label: "Bearing",
    group: "Temperature (°C)",
    unit: "°C",
    min: 32,
    max: 56,
    warnAbove: 48,
    decimals: 1,
  },
  {
    key: "gearboxOil",
    label: "Gearbox oil",
    group: "Temperature (°C)",
    unit: "°C",
    min: 40,
    max: 68,
    warnAbove: 62,
    decimals: 1,
  },
  {
    key: "fillNozzle",
    label: "Fill nozzle",
    group: "Pressure (bar)",
    unit: "bar",
    min: 1.8,
    max: 3.4,
    warnAbove: 3.1,
    decimals: 2,
  },
  {
    key: "airSupply",
    label: "Air supply",
    group: "Pressure (bar)",
    unit: "bar",
    min: 5.2,
    max: 7.2,
    warnAbove: 6.9,
    decimals: 2,
  },
  {
    key: "bottleCurrent",
    label: "Bottle current",
    group: "Drive & Throughput",
    unit: "A",
    min: 8,
    max: 21,
    warnAbove: 19,
    decimals: 1,
  },
  {
    key: "lineSpeed",
    label: "Line speed",
    group: "Drive & Throughput",
    unit: "ppm",
    min: 120,
    max: 210,
    warnAbove: 9999,
    decimals: 0,
  },
  {
    key: "cycleCount",
    label: "Cycle count",
    group: "Drive & Throughput",
    unit: "",
    min: 18000,
    max: 62000,
    warnAbove: 9999999,
    decimals: 0,
  },
  {
    key: "rejectCount",
    label: "Reject count",
    group: "Drive & Throughput",
    unit: "",
    min: 20,
    max: 480,
    warnAbove: 350,
    decimals: 0,
  },
  {
    key: "utilised",
    label: "Utilised",
    group: "Drive & Throughput",
    unit: "%",
    min: 52,
    max: 96,
    warnAbove: 9999,
    decimals: 0,
  },
];

export const LOSS_CATEGORIES = [
  "Breakdown",
  "Minor Stop",
  "Setup",
  "Speed Loss",
  "Reject",
  "Rework",
  "Planned Downtime",
] as const;

export type LossCategory = (typeof LOSS_CATEGORIES)[number];

export const OEE_ACTIVE_LINES_BY_PLANT: Record<string, string[]> = {
  J2: ["TUP01", "TUP13", "TUP14", "BOP15", "BOP16"],
};

export function isOeeActiveLine(plantId: string, lineId: string) {
  return OEE_ACTIVE_LINES_BY_PLANT[plantId]?.includes(lineId) ?? false;
}

export type LineDataSource = "SCADA" | "AUK";

export function getLineDataSource(plantId: string, lineId: string): LineDataSource {
  return isOeeActiveLine(plantId, lineId) ? "SCADA" : "AUK";
}

export const LINE_TOPOLOGY: Record<string, "SEQ" | "OR"> = {
  TUP01: "SEQ",
  TUP13: "SEQ",
  TUP14: "SEQ",
  BOP15: "SEQ",
  BOP16: "SEQ",
  LIP04: "OR",
};

export const SHIFT_REMINDER_LEAD_MIN = 10;

/** CR 4: the old "End of shift reminder" pop-up (change-shift dropdown, 10 min before end). */
export const LEGACY_SHIFT_REMINDER = false;

/** CR 4: minutes before the end of the running shift at which the tagging reminder fires. */
export const REMINDER_TRIGGER_MINUTES: readonly number[] = [60, 30, 20, 10, 0];

/** CR 4: "line" = counts are the sum over all machines of the operator's line. */
export const REMINDER_SCOPE: "line" | "machine" = "line";

/** CR 4: the T-0 reminder may still show this long after the shift end (shift already rolled over). */
export const REMINDER_T0_GRACE_MIN = 5;

export const RUN_RATE_THRESHOLDS = {
  redMax: 98,
  yellowMin: 102,
};

export type Role = "shift-leader" | "section-head" | "operator";
export const ROLE_DEFAULT: Role = "section-head";
export const ROLE_PERSISTENCE: "session" | "local" = "session";

/** CR 5: the OEE card has no SKU-ON/OFF toggle of its own; it follows the universal SRR switch. */
export const OEE_CARD_FOLLOWS_SRR_SWITCH = true;

/** Operator tabs blocked while the SRR Line of the line is missing in the Asset Management master. */
export const SRR_BLOCKED_TABS: readonly string[] = ["reason"];
