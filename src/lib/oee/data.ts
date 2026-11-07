/**
 * 100% frontend mock data for the OEE prototype. Deterministic (seeded) so SSR
 * and client hydration match. Values are intentionally varied per plant / zone /
 * line / loss category (§5.3, §7 point 12) — no repeated "same numbers".
 */

import { SENSOR_SPEC, type LossCategory, type Status } from "./config";
import { makeRng, pick, rand } from "./rng";
import { J2_LINES_CONFIG, getDeterministicMachineStatus } from "./j2-layout-config";
import { matchPlcAlarmCode } from "./lossTree";

export type Machine = {
  id: string;
  key?: string;
  code?: string;
  sequence?: number;
  lineId: string;
  name: string;
  type: string;
  status: Status;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  mttr: number;
  mtbf: number;
  stopsThisShift: number;
  sensors: {
    key: string;
    label: string;
    group: string;
    value: number;
    unit: string;
    warn: boolean;
  }[];
  currentStop?:
    | {
        severity: "CRITICAL" | "HIGH" | "MEDIUM";
        fault: string;
        startedAt: string;
        elapsedMinutes: number;
        lossPath: string;
        downstream: string[];
      }
    | undefined;
};

export type Line = {
  id: string;
  zoneId: string;
  plantId: string;
  status: Status;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  outputActual: number;
  outputTarget: number;
  runningMinutes: number;
  speed: number;
  stdSpeed: number;
  sku: string;
  po: string;
  batch: string;
  mpqTarget: number;
  bottleneck: string;
  fault?: string | undefined;
  bay: { row: number; col: number };
  machines: Machine[];
};

export type Zone = {
  id: string;
  name: string;
  plantId: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  lines: Line[];
};

export type PlantPhase = "operational" | "under_planning" | "under_construction";

export const PLANT_PHASE_LABELS: Record<PlantPhase, string> = {
  operational: "Operational",
  under_planning: "Under Planning",
  under_construction: "Under Construction",
};

export type Plant = {
  id: string;
  name: string;
  block: string;
  coordinates: [number, number];
  phase: PlantPhase;
  isOperational: boolean;
  region: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  zones: Zone[];
  metrics?: null | Record<string, unknown>;
};

export { MACHINE_OUTPUT_LABEL } from "./config";

export type AlarmSource = "PLC" | "Non-PLC";

export type Alarm = {
  id: string;
  lineId: string;
  machineId: string;
  issue: string;
  start: string;
  durationMinutes: number;
  status: "OCCURRING" | "Resolved";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  timestamp?: number;
  zoneId?: string;
  l2Category?: string;
  l3Reason?: string;
  source?: AlarmSource;
  plcAlarmCode?: string;
  isTagged?: boolean;
};

const MACHINE_TYPES = [
  ["LTF", "Tube Filler"],
  ["LWR", "Wrapper"],
  ["LCT", "Cartoner"],
  ["LCP", "Case Packer"],
  ["LLB", "Labeller"],
] as const;

const SKUS = [
  "SKU-1120 Tube 65g",
  "SKU-2043 Sachet 12g",
  "SKU-3310 Bottle 200ml",
  "SKU-4187 Jar 250g",
  "SKU-5209 Pouch 500g",
];

const FAULTS = [
  "Bearing seizure on main drive",
  "Conveyor jam at infeed",
  "Servo overload trip",
  "Film splice sensor fault",
  "Vacuum pressure low",
  "Cartoner glue temperature low",
];

const LINE_PREFIX: Record<string, string[]> = {
  A: ["TUP", "BLP"],
  B: ["BOP", "SAP"],
  C: ["JRP", "PCP"],
};

function statusFor(seed: string, index: number, total: number): Status {
  // majority running, 1-2 down, 1-2 slow, a few idle (§4.1.3)
  if (index === 2) return "down";
  if (index === total - 3) return "down";
  if (index === 5 || index === total - 1) return "slow";
  if (index === 7 || index === 9) return "idle";
  return makeRng(seed)() > 0.92 ? "slow" : "running";
}

function buildMachines(line: { id: string; status: Status; plantId: string }): Machine[] {
  const count = 2 + Math.floor(makeRng(`${line.id}-mcount`)() * 3); // 2-4
  const machines: Machine[] = [];
  for (let i = 0; i < count; i++) {
    const spec = MACHINE_TYPES[i % MACHINE_TYPES.length] as readonly [string, string];
    const id = `${spec[0]}${String(i + 1).padStart(2, "0")}`;
    const seed = `${line.id}-${id}`;
    const isCulprit = line.status === "down" && i === 0;
    const status: Status = isCulprit
      ? "down"
      : line.status === "idle"
        ? "idle"
        : line.status === "slow" && i === 1
          ? "slow"
          : "running";
    const availability = isCulprit ? rand(seed + "a", 38, 58, 1) : rand(seed + "a", 78, 97, 1);
    const performance = rand(seed + "p", status === "slow" ? 58 : 74, 96, 1);
    const quality = rand(seed + "q", 92, 99.6, 1);
    machines.push({
      id,
      lineId: line.id,
      name: id,
      type: spec[1],
      status,
      availability,
      performance,
      quality,
      oee: Math.round(((availability * performance * quality) / 10000) * 10) / 10,
      mttr: rand(seed + "mttr", 12, 68, 0),
      mtbf: rand(seed + "mtbf", 180, 1400, 0),
      stopsThisShift: rand(seed + "stops", isCulprit ? 4 : 0, isCulprit ? 11 : 5, 0),
      sensors: SENSOR_SPEC.map((s) => {
        const value = rand(`${seed}-${s.key}`, s.min, s.max, s.decimals ?? 1);
        return {
          key: s.key,
          label: s.label,
          group: s.group,
          unit: s.unit,
          value,
          warn: value > s.warnAbove,
        };
      }),
      currentStop: isCulprit
        ? {
            severity: "CRITICAL",
            fault: pick(seed + "fault", FAULTS),
            startedAt: pick(seed + "time", ["06:12", "07:48", "09:05", "13:26", "21:34"]),
            elapsedMinutes: rand(seed + "elapsed", 14, 96, 0),
            lossPath: "Breakdown · Bearing seizure · Lubrication missed",
            downstream: [`LWR0${((i + 1) % 3) + 1}`, `LCT0${((i + 2) % 3) + 1}`],
          }
        : undefined,
    });
  }
  return machines;
}

function buildLine(plantId: string, zoneId: string, index: number, total: number): Line {
  const prefixes = LINE_PREFIX[zoneId] ?? ["TUP"];
  const prefix = (index === total - 1 ? prefixes[1] : prefixes[0]) ?? "TUP";
  const id = `${prefix}${String(index + 1).padStart(2, "0")}`;
  const seed = `${plantId}-${zoneId}-${id}`;
  const status = statusFor(seed, index, total);
  const availability =
    status === "down" ? rand(seed + "a", 34, 56, 1) : rand(seed + "a", 76, 96, 1);
  const performance = status === "slow" ? rand(seed + "p", 54, 68, 1) : rand(seed + "p", 72, 97, 1);
  const quality = rand(seed + "q", 91, 99.5, 1);
  const outputTarget = rand(seed + "ot", 8000, 21000, 0);
  const base: Line = {
    id,
    zoneId,
    plantId,
    status,
    availability,
    performance,
    quality,
    oee: Math.round(((availability * performance * quality) / 10000) * 10) / 10,
    outputTarget,
    outputActual: Math.round(outputTarget * rand(seed + "oa", 0.52, 1.04, 3)),
    runningMinutes: rand(seed + "rm", 180, 462, 0),
    speed: rand(seed + "sp", 108, 198, 0),
    stdSpeed: rand(seed + "std", 160, 200, 0),
    sku: pick(seed + "sku", SKUS),
    po: `PO-${rand(seed + "po", 41000, 49999, 0)}`,
    batch: `B${rand(seed + "b", 2201, 2299, 0)}`,
    mpqTarget: rand(seed + "mpq", 150, 200, 0),
    bottleneck: "",
    fault: status === "down" ? pick(seed + "lf", FAULTS) : undefined,
    bay: { row: Math.floor(index / 5), col: index % 5 },
    machines: [],
  };
  base.machines = buildMachines(base);
  base.bottleneck = base.machines[0]?.id ?? "-";
  return base;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  // §7 point 8: simple average for the prototype, no weighting.
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function buildZone(plantId: string, zoneId: "A" | "B" | "C"): Zone {
  const total = 15;
  const lines: Line[] = [];
  for (let i = 0; i < total; i++) lines.push(buildLine(plantId, zoneId, i, total));
  return {
    id: zoneId,
    name: `Zone ${zoneId}`,
    plantId,
    lines,
    oee: avg(lines.map((l) => l.oee)),
    availability: avg(lines.map((l) => l.availability)),
    performance: avg(lines.map((l) => l.performance)),
    quality: avg(lines.map((l) => l.quality)),
  };
}

function buildPlant(
  id: string,
  name: string,
  block: string,
  coordinates: [number, number],
  region: string,
): Plant {
  const zones = (["A", "B", "C"] as const).map((z) => buildZone(id, z));
  return {
    id,
    name,
    block,
    coordinates,
    phase: "operational",
    isOperational: true,
    region,
    zones,
    oee: avg(zones.map((z) => z.oee)),
    availability: avg(zones.map((z) => z.availability)),
    performance: avg(zones.map((z) => z.performance)),
    quality: avg(zones.map((z) => z.quality)),
    metrics: {},
  };
}

function buildJ2Machines(lineCode: string, zoneId: string): Machine[] {
  const lineCfg = J2_LINES_CONFIG.find((l) => l.code === lineCode);
  if (!lineCfg) return [];

  return lineCfg.machines.map((mCfg, idx) => {
    const key = `${lineCode}-${mCfg.code}`;
    const mock = getDeterministicMachineStatus(key);
    const isCulprit = mock.status === "down";

    return {
      id: mCfg.code,
      key,
      code: mCfg.code,
      sequence: idx + 1,
      lineId: lineCode,
      name: mCfg.name ?? mCfg.code,
      type: mCfg.type ?? "Production Machine",
      status: mock.status,
      oee: mock.oee,
      availability: mock.availability,
      performance: mock.performance,
      quality: mock.quality,
      mttr: rand(`${key}-mttr`, 12, 68, 0),
      mtbf: rand(`${key}-mtbf`, 180, 1400, 0),
      stopsThisShift: rand(`${key}-stops`, isCulprit ? 4 : 0, isCulprit ? 11 : 5, 0),
      sensors: SENSOR_SPEC.map((s) => {
        const value = rand(`${key}-${s.key}`, s.min, s.max, s.decimals ?? 1);
        return {
          key: s.key,
          label: s.label,
          group: s.group,
          unit: s.unit,
          value,
          warn: value > s.warnAbove,
        };
      }),
      currentStop: isCulprit
        ? {
            severity: "CRITICAL",
            fault: pick(`${key}-fault`, FAULTS),
            startedAt: pick(`${key}-time`, ["06:12", "07:48", "09:05", "13:26", "21:34"]),
            elapsedMinutes: rand(`${key}-elapsed`, 14, 96, 0),
            lossPath: "Breakdown · Mechanical component · Maintenance required",
            downstream: lineCfg.machines.slice(idx + 1).map((dm) => dm.code),
          }
        : undefined,
    };
  });
}

function buildJ2Line(lineCfg: (typeof J2_LINES_CONFIG)[number]): Line {
  const machines = buildJ2Machines(lineCfg.code, lineCfg.zoneId);
  const seed = `J2-${lineCfg.zoneId}-${lineCfg.code}`;

  const availability = avg(machines.map((m) => m.availability));
  const performance = avg(machines.map((m) => m.performance));
  const quality = avg(machines.map((m) => m.quality));
  const oee = avg(machines.map((m) => m.oee));

  // Determine line status from machines
  let status: Status = "running";
  if (machines.some((m) => m.status === "down")) {
    status = "down";
  } else if (machines.some((m) => m.status === "slow")) {
    status = "slow";
  } else if (machines.every((m) => m.status === "idle")) {
    status = "idle";
  }

  const outputTarget = rand(seed + "ot", 8000, 21000, 0);
  const culprit = machines.find((m) => m.status === "down");

  return {
    id: lineCfg.code,
    zoneId: lineCfg.zoneId,
    plantId: "J2",
    status,
    availability,
    performance,
    quality,
    oee,
    outputTarget,
    outputActual: Math.round(
      outputTarget * (status === "down" ? 0.62 : status === "slow" ? 0.78 : 0.96),
    ),
    runningMinutes: rand(seed + "rm", 180, 462, 0),
    speed: rand(seed + "sp", 108, 198, 0),
    stdSpeed: rand(seed + "std", 160, 200, 0),
    sku: pick(seed + "sku", SKUS),
    po: `PO-${rand(seed + "po", 41000, 49999, 0)}`,
    batch: `B${rand(seed + "b", 2201, 2299, 0)}`,
    mpqTarget: rand(seed + "mpq", 150, 200, 0),
    bottleneck: culprit?.code ?? machines[0]?.code ?? "-",
    fault:
      status === "down" ? (culprit?.currentStop?.fault ?? pick(seed + "lf", FAULTS)) : undefined,
    bay: { row: Math.floor(lineCfg.rowOrder / 5), col: lineCfg.rowOrder % 5 },
    machines,
  };
}

function buildJ2Zone(zoneId: "A" | "B" | "C"): Zone {
  const lineConfigs = J2_LINES_CONFIG.filter((l) => l.zoneId === zoneId);
  const lines = lineConfigs.map(buildJ2Line);

  return {
    id: zoneId,
    name: `Zone ${zoneId}`,
    plantId: "J2",
    lines,
    oee: avg(lines.map((l) => l.oee)),
    availability: avg(lines.map((l) => l.availability)),
    performance: avg(lines.map((l) => l.performance)),
    quality: avg(lines.map((l) => l.quality)),
  };
}

function buildJ2Plant(): Plant {
  const zones = (["A", "B", "C"] as const).map(buildJ2Zone);
  return {
    id: "J2",
    name: "Paragon Jatake 2",
    block: "Blok 7",
    coordinates: [-6.184949799707473, 106.54310371083848],
    phase: "operational",
    isOperational: true,
    region: "Tangerang, Banten, Indonesia",
    zones,
    oee: avg(zones.map((z) => z.oee)),
    availability: avg(zones.map((z) => z.availability)),
    performance: avg(zones.map((z) => z.performance)),
    quality: avg(zones.map((z) => z.quality)),
    metrics: {},
  };
}

export const PLANTS: Plant[] = [
  buildPlant(
    "J1",
    "Paragon Jatake 1",
    "Blok 3",
    [-6.185704300026386, 106.54094433967391],
    "Tangerang, Banten, Indonesia",
  ),
  buildJ2Plant(),
  buildPlant(
    "J4",
    "Paragon Jatake 4",
    "Blok 12",
    [-6.188150724806095, 106.53732155079985],
    "Tangerang, Banten, Indonesia",
  ),
  {
    id: "KLANG",
    name: "Paragon Klang",
    block: "Malaysia",
    coordinates: [3.0390240596644933, 101.44151455222334],
    phase: "under_planning",
    isOperational: false,
    region: "Klang, Selangor, Malaysia",
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    zones: [],
    metrics: null,
  },
  {
    id: "BATANG",
    name: "Paragon Batang",
    block: "Central Java",
    coordinates: [-6.9064232253866935, 109.73409916262433],
    phase: "under_planning",
    isOperational: false,
    region: "Batang, Central Java, Indonesia",
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    zones: [],
    metrics: null,
  },
];

/** TODO/confirm (§7 point 9): default plant hardcoded for the prototype. */
export const DEFAULT_PLANT_ID = "J2";
export const DEFAULT_ZONE_ID = "A";

export const GROUP = {
  oee: avg(PLANTS.filter((p) => p.isOperational).map((p) => p.oee)),
  availability: avg(PLANTS.filter((p) => p.isOperational).map((p) => p.availability)),
  performance: avg(PLANTS.filter((p) => p.isOperational).map((p) => p.performance)),
  quality: avg(PLANTS.filter((p) => p.isOperational).map((p) => p.quality)),
};

export function getPlant(plantId: string): Plant | undefined {
  return PLANTS.find((p) => p.id === plantId);
}

export function getZone(plantId: string, zoneId: string): Zone | undefined {
  return getPlant(plantId)?.zones.find((z) => z.id === zoneId);
}

export function getLine(plantId: string, zoneId: string, lineId: string): Line | undefined {
  return getZone(plantId, zoneId)?.lines.find((l) => l.id === lineId);
}

export function getMachine(
  plantId: string,
  zoneId: string,
  lineId: string,
  machineId: string,
): Machine | undefined {
  return getLine(plantId, zoneId, lineId)?.machines.find(
    (m) => m.id === machineId || m.key === machineId || m.code === machineId,
  );
}

export function allLines(plantId?: string, zoneIds?: string[]): Line[] {
  const plants = plantId
    ? PLANTS.filter((p) => p.id === plantId)
    : PLANTS.filter((p) => p.isOperational);
  return plants.flatMap((p) =>
    (p.zones ?? [])
      .filter((z) => !zoneIds || zoneIds.length === 0 || zoneIds.includes(z.id))
      .flatMap((z) => z.lines),
  );
}

export function allSkus(lines: Line[]): string[] {
  return Array.from(new Set(lines.map((l) => l.sku))).sort();
}

/* ------------------------------------------------------------------ alarms */

export function plantAlarms(plant: Plant): Alarm[] {
  if (!plant.isOperational || !plant.zones?.length) return [];
  const alarms: Alarm[] = [];
  plant.zones.forEach((z) =>
    z.lines.forEach((l) => {
      if (l.status === "down" || l.status === "slow") {
        const m = l.machines[0];
        const seed = `${plant.id}-${l.id}-alarm`;
        const issue = l.fault ?? "Pneumatic cylinder seal leak";
        const match = matchPlcAlarmCode(issue);
        alarms.push({
          id: `${l.id}-1`,
          lineId: l.id,
          machineId: m?.id ?? "-",
          issue,
          start: pick(seed + "s", ["05:41", "06:12", "07:48", "09:05", "11:22", "13:26"]),
          durationMinutes: Math.max(10, rand(seed + "d", 10, 124, 0)),
          status: l.status === "down" ? "OCCURRING" : "Resolved",
          severity: l.status === "down" ? "CRITICAL" : "MEDIUM",
          source: match ? "PLC" : "Non-PLC",
          l2Category: match ? match.l2CategoryName : "Not Tagged Yet",
          l3Reason: match ? match.l3ReasonName : "Not Tagged Yet",
          isTagged: Boolean(match),
        });
      }
    }),
  );
  return alarms.sort((a, b) => (a.status === b.status ? 0 : a.status === "OCCURRING" ? -1 : 1));
}

export function lineAlarms(line: Line): Alarm[] {
  const seed = `${line.id}-la`;
  const list: Alarm[] = [];
  const culprit = line.machines.find((m) => m.status === "down");
  const culpritMachineId = culprit
    ? culprit.code || culprit.id
    : line.bottleneck && line.bottleneck !== "-"
      ? line.bottleneck
      : (line.machines[0]?.id ?? "-");

  if (line.status === "down" || line.fault) {
    const issue = line.fault || culprit?.currentStop?.fault || "Filler Error";
    const match = matchPlcAlarmCode(issue);
    list.push({
      id: `${line.id}-active`,
      lineId: line.id,
      machineId: culpritMachineId,
      issue,
      start: culprit?.currentStop?.startedAt || "06:12",
      durationMinutes: Math.max(
        10,
        culprit?.currentStop?.elapsedMinutes ?? rand(seed + "1", 12, 92, 0),
      ),
      status: "OCCURRING",
      severity: "CRITICAL",
      source: match ? "PLC" : "Non-PLC",
      l2Category: match ? match.l2CategoryName : "Not Tagged Yet",
      l3Reason: match ? match.l3ReasonName : "Not Tagged Yet",
      isTagged: Boolean(match),
    });
  }

  // Secondary resolved alarm for realism if machines exist
  if (line.machines.length > 1) {
    const otherMachine =
      line.machines.find((m) => (m.code || m.id) !== culpritMachineId) || line.machines[1];
    const issue = pick(seed + "i", [
      "Air Hose Leakage",
      "Carton Magazine Error",
      "Mechanical drive failure",
    ]);
    const match = matchPlcAlarmCode(issue);
    list.push({
      id: `${line.id}-r1`,
      lineId: line.id,
      machineId: otherMachine?.code || otherMachine?.id || "-",
      issue,
      start: "04:55",
      durationMinutes: Math.max(10, rand(seed + "2", 10, 38, 0)),
      status: "Resolved",
      severity: "MEDIUM",
      source: match ? "PLC" : "Non-PLC",
      l2Category: match ? match.l2CategoryName : "Not Tagged Yet",
      l3Reason: match ? match.l3ReasonName : "Not Tagged Yet",
      isTagged: Boolean(match),
    });
  }
  return list;
}

/* ------------------------------------------------------------------ trends */

export type Point = { label: string; [key: string]: number | string };

export function trendSeries(
  seed: string,
  buckets: string[],
  keys: string[],
  base: number,
  spread: number,
): Point[] {
  return buckets.map((label, i) => {
    const point: Point = { label };
    keys.forEach((k, ki) => {
      const wave = Math.sin((i + ki * 2) / 1.9) * spread * 0.4;
      point[k] =
        Math.round((base + wave + rand(`${seed}-${k}-${i}`, -spread, spread, 1)) * 10) / 10;
    });
    return point;
  });
}

export function bucketsFor(resolutionMinutes: number, days: number): string[] {
  if (resolutionMinutes <= 15) {
    return Array.from(
      { length: 12 },
      (_, i) =>
        `${String(6 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
    );
  }
  if (resolutionMinutes <= 60) {
    return Array.from({ length: 8 }, (_, i) => `${String(6 + i).padStart(2, "0")}:00`);
  }
  if (resolutionMinutes <= 720) {
    return Array.from(
      { length: Math.max(4, days * 2) },
      (_, i) => `D${Math.floor(i / 2) + 1} ${i % 2 === 0 ? "AM" : "PM"}`,
    );
  }
  return Array.from({ length: Math.max(5, Math.min(days, 14)) }, (_, i) => `D${i + 1}`);
}

/* -------------------------------------------------------------- loss anatomy */

export type LossNode = {
  id: string;
  label: string;
  minutes: number;
  occurrences: number;
  children?: LossNode[];
  /** Rank by machines (§7 point 3) */
  machines: { id: string; minutes: number; occurrences: number }[];
};

const LOSS_TREE_SHAPE: Record<string, Record<string, string[]>> = {
  Breakdown: {
    "Filling System": [
      "Filler Error",
      "Filling Error",
      "Nozzle Tailing",
      "Filling Pump Sensor Error",
      "Piston Pump Sensor Error",
    ],
    "Carton Handling": [
      "Carton Magazine Error",
      "Chute Transfer / Swivel Arm Jam",
      "Carton Flap (Top & Bottom) Error",
    ],
    "Pneumatic System": ["Air Hose Leakage"],
    "Sensor / Detection": [
      "Ejector Error",
      "Product Sensing Error",
      "Screw Sensor Error",
      "Min/Max Lead Sensor Error",
      "Plug Sensor Error",
    ],
    "General Machine Breakdown": [
      "Machine Breakdown",
      "Piston Disassembly (O-Ring Contamination)",
      "Unstable Net Weight",
    ],
    "Bulk / Material": ["Bulk Shortage", "Bulk Viscosity Above Standard", "Waiting for Bulk"],
    "Tube Feeding": ["Tube Infeed Error", "Tube Magazine Error"],
    "Turntable / Holder": ["Turntable & Holder Error"],
  },
  "Minor Stop": {
    "Carton Handling": [
      "Bad Carton Not Ejected",
      "Dedusting Alarm",
      "Carton Flap (Top & Bottom) Error / Alarm",
      "Carton Not Vacuumed / Dropped",
      "Carton Stuck in Carton Sealer",
    ],
    "Filling System": [
      "Filling Error",
      "Unstable Net Weight",
      "Nozzle Tailing",
      "Filling Pump Sensor Error",
      "Piston Pump Sensor Error",
      "NPD Net Weight Setting",
    ],
    "Machine Performance": [
      "Piston Disassembly (O-Ring Contamination)",
      "Chute Transfer Error",
      "FG Stuck in Robopacker",
      "Flipper Error",
      "Loose / Wobbly Orientation Gear",
      "Carton Infeed Error",
    ],
    "Sensor / Detection": [
      "DYN Sensor Alarm",
      "Product Sensing Error",
      "Screw Sensor Error",
      "Bulk / Hopper Sensor Error",
      "Eyemark Sensor Error",
    ],
    Sealing: [
      "Seal Leakage",
      "Seal Blistering",
      "Skewed Seal",
      "Seal Position Too High",
      "Hooked Seal",
    ],
  },
  Setup: {
    Changeover: ["Changeover & Setup"],
    Checking: ["Setup Checking"],
    Cleaning: ["General Cleaning", "Cleaning, Changeover & Setup", "Cleaning & Setup"],
    "Loading Material": ["Material Loading"],
    "Material Preparation": ["Water Weighing"],
    "Setup Activity": ["Machine Setup"],
  },
  "Speed Loss": {
    "Reduced Speed for Quality": [
      "Slow run to prevent foaming",
      "Slow run due to delicate packaging",
      "Reduced speed during heat tunnel heating",
      "Capper torque stabilization speed",
    ],
    "Line Balancing & Flow Constraints": [
      "Downstream machine bottleneck throttling",
      "Upstream supply starvation",
      "Operator training pace",
    ],
  },
  Reject: {
    "Fill / Volume Rejection": [
      "Underfilled bottle (< lower spec limit)",
      "Overfilled bottle (> upper spec limit)",
      "Nozzle splash / external contamination",
    ],
    "Capping / Seal Defect": [
      "Canted / crooked cap",
      "Loose cap (insufficient torque)",
      "Stripped cap thread (over-torque)",
      "Induction foil seal missing or incomplete",
    ],
    "Labelling & Code Defect": [
      "Skewed / bubbled label",
      "Missing expiry / batch inkjet code",
      "Unreadable barcode scan",
    ],
  },
  Rework: {
    "Packaging Rework": [
      "Manual cap retorquing",
      "Manual label removal and re-application",
      "Carton repack due to damaged carton box",
    ],
  },
  "Planned Downtime": {
    "Breaks & Meetings": ["Line Clearance", "Break", "Briefing", "Pre-Shift Talk (Hello Time)"],
    "Planned Maintenance": ["Autonomous Maintenance (AM)", "Preventive Maintenance (PM)"],
  },
};

function nodeMachines(seed: string, minutes: number) {
  return ["LTF01", "LWR02", "LCT01", "LCP03", "LLB01"]
    .map((id) => ({
      id,
      minutes: Math.max(1, Math.round(minutes * rand(`${seed}-${id}`, 0.05, 0.42, 3))),
      occurrences: rand(`${seed}-${id}-o`, 1, 14, 0),
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Independent, non-uniform dataset per scope + category (§7 point 12). */
export function lossTree(scopeSeed: string): LossNode[] {
  return Object.entries(LOSS_TREE_SHAPE).map(([category, children]) => {
    const catSeed = `${scopeSeed}-${category}`;
    const kids = Object.entries(children).map(([child, grandChildren], ci) => {
      const childSeed = `${catSeed}-${child}-${ci}`;
      const grandKids = grandChildren.map((gc, gi) => {
        const gSeed = `${childSeed}-${gc}-${gi}`;
        const minutes = rand(gSeed, 4, 58, 0);
        return {
          id: gSeed,
          label: gc,
          minutes,
          occurrences: rand(gSeed + "o", 1, 16, 0),
          machines: nodeMachines(gSeed, minutes),
        } satisfies LossNode;
      });
      const minutes =
        grandKids.reduce((a, b) => a + b.minutes, 0) + rand(childSeed + "x", 2, 24, 0);
      return {
        id: childSeed,
        label: child,
        minutes,
        occurrences:
          grandKids.reduce((a, b) => a + b.occurrences, 0) + rand(childSeed + "o", 1, 6, 0),
        children: grandKids,
        machines: nodeMachines(childSeed, minutes),
      } satisfies LossNode;
    });
    const minutes = kids.reduce((a, b) => a + b.minutes, 0);
    return {
      id: catSeed,
      label: category,
      minutes,
      occurrences: kids.reduce((a, b) => a + b.occurrences, 0),
      children: kids,
      machines: nodeMachines(catSeed, minutes),
    } satisfies LossNode;
  });
}

export function findNode(nodes: LossNode[], id: string): LossNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = n.children ? findNode(n.children, id) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/** OEE Waterfall per standard cascading logic. */
export function waterfall(scopeSeed: string) {
  const calendar = 1440;
  const unscheduled = rand(scopeSeed + "un", 120, 260, 0);
  const planned = rand(scopeSeed + "pd", 30, 90, 0);
  const breakdown = rand(scopeSeed + "bd", 25, 130, 0);
  const setup = rand(scopeSeed + "st", 15, 75, 0);
  const minorStop = rand(scopeSeed + "ms", 10, 60, 0);
  const speedLoss = rand(scopeSeed + "sl", 20, 95, 0);
  const reject = rand(scopeSeed + "rj", 8, 45, 0);
  const rework = rand(scopeSeed + "rw", 4, 26, 0);

  const losses = [
    { label: "Unscheduled", value: unscheduled, group: "Loading" as const },
    { label: "Planned Downtime", value: planned, group: "Loading" as const },
    { label: "Breakdown", value: breakdown, group: "Availability" as const },
    { label: "Setup", value: setup, group: "Availability" as const },
    { label: "Minor Stop", value: minorStop, group: "Performance" as const },
    { label: "Speed Loss", value: speedLoss, group: "Performance" as const },
    { label: "Reject", value: reject, group: "Quality" as const },
    { label: "Rework", value: rework, group: "Quality" as const },
  ];

  const sumGroup = (group: "Loading" | "Availability" | "Performance" | "Quality") =>
    losses.filter((l) => l.group === group).reduce((sum, l) => sum + l.value, 0);

  const scheduled = calendar - sumGroup("Loading");
  const gross = scheduled - sumGroup("Availability");
  const net = gross - sumGroup("Performance");
  const effective = net - sumGroup("Quality");

  return {
    milestones: [
      { label: "Calendar Time", value: calendar },
      { label: "Scheduled Time", value: scheduled },
      { label: "Gross Operating Time", value: gross },
      { label: "Net Operating Time", value: net },
      { label: "Effective Time", value: effective },
    ],
    losses,
  };
}

export function biggestLoss(scopeSeed: string) {
  const tree = lossTree(scopeSeed);
  return tree.reduce((a, b) => (b.minutes > a.minutes ? b : a));
}

/* --------------------------------------------------- comparison (new panel) */

export function comparison(scopeSeed: string, lines: Line[]) {
  const before = rand(scopeSeed + "cb", 58, 82, 1);
  const after = rand(scopeSeed + "ca", 58, 84, 1);
  return {
    before,
    after,
    delta: Math.round((after - before) * 10) / 10,
    components: (["Availability", "Performance", "Quality"] as const).map((label) => ({
      label,
      delta: rand(`${scopeSeed}-${label}`, -6.5, 7.5, 1),
    })),
    byLine: lines.slice(0, 8).map((l) => ({
      label: l.id,
      delta: rand(`${scopeSeed}-${l.id}-cmp`, -9, 9, 1),
    })),
  };
}

/* ------------------------------------------ shift performance (§6, bonus) */

export function shiftPerformance(plantId: string) {
  const leaders = ["Andi P.", "Bagus S.", "Citra W.", "Dedi K.", "Eka R."];
  return {
    opeByLeader: [
      ...leaders.map((name) => ({
        name,
        ope: rand(`${plantId}-${name}-ope`, 48, 88, 1),
        batches: rand(`${plantId}-${name}-b`, 12, 48, 0),
      })),
      // TODO/confirm (§7 point 11): "Non Shift" and "Unmap" have no final definition.
      { name: "Non Shift", ope: rand(plantId + "ns", 20, 45, 1), batches: 0 },
      { name: "Unmap", ope: rand(plantId + "um", 10, 30, 1), batches: 0 },
    ],
    weekly: Array.from({ length: 7 }, (_, i) => ({
      label: `D${i + 1}`,
      "Shift 1": rand(`${plantId}-w1-${i}`, 58, 86, 1),
      "Shift 2": rand(`${plantId}-w2-${i}`, 54, 84, 1),
      "Shift 3": rand(`${plantId}-w3-${i}`, 50, 80, 1),
      "Non Shift": rand(`${plantId}-w4-${i}`, 24, 48, 1),
    })),
    operators: leaders.map((name) => ({
      name,
      output: rand(`${plantId}-${name}-out`, 6200, 18400, 0),
    })),
  };
}

/* -------------------------------- KPI Strips & Analytics Helpers -------------------------------- */

/** Dynamically map any span filter label/id to comparison label */
export function getCompareLabel(span: string): string {
  const s = (span || "").toLowerCase();
  if (s.includes("week")) return "vs Last week";
  if (s.includes("day") || s.includes("today") || s.includes("yesterday")) return "vs Yesterday";
  if (s.includes("month")) return "vs Last month";
  return "vs Previous period";
}

/** Standardized delta percentage formatter */
export function formatDeltaPercent(current: number, previous: number) {
  const currFmt = Math.round(current * 10) / 10;
  const prevFmt = Math.round(previous * 10) / 10;
  const deltaVal = Math.round((currFmt - prevFmt) * 10) / 10;
  const absVal = Math.abs(deltaVal).toFixed(1);

  const text = deltaVal > 0 ? `+${absVal}%` : deltaVal < 0 ? `-${absVal}%` : "0.0%";
  const tone: "positive" | "negative" | "neutral" =
    deltaVal > 0 ? "positive" : deltaVal < 0 ? "negative" : "neutral";

  const ariaLabel =
    deltaVal > 0
      ? `plus ${absVal} percentage points`
      : deltaVal < 0
        ? `minus ${absVal} percentage points`
        : "0.0 percentage points";

  return { text, tone, ariaLabel, deltaVal };
}

export type PriorPeriodKpis = {
  // Aggregate / Waterfall KPIs (Loss Anatomy)
  scheduledTime: number;
  grossOperatingTime: number;
  netOperatingTime: number;
  effectiveTime: number;
  totalLossMinutes: number;
  availabilityPct: number;
  performancePct: number;
  qualityPct: number;
  oeePct: number;

  // Homepage Line-Averaged KPIs
  avgOee: number;
  avgAvailability: number;
  avgPerformance: number;
  avgQuality: number;
  goodOutput: number;

  /** Get prior period minutes for a specific loss category */
  getCategoryMinutes: (categoryLabel: string) => number;
};

/** Deterministic prior period KPIs for Loss Anatomy and Homepage cards */
export function getPriorPeriodKpis(scopeSeed: string, lines?: Line[]): PriorPeriodKpis {
  const priorSeed = `${scopeSeed}-prior`;
  const wf = waterfall(priorSeed);
  const scheduledTime = wf.milestones.find((m) => m.label === "Scheduled Time")?.value ?? 0;
  const grossOperatingTime =
    wf.milestones.find((m) => m.label === "Gross Operating Time")?.value ?? 0;
  const netOperatingTime = wf.milestones.find((m) => m.label === "Net Operating Time")?.value ?? 0;
  const effectiveTime = wf.milestones.find((m) => m.label === "Effective Time")?.value ?? 0;

  const totalLossMinutes = wf.losses.reduce((sum, l) => sum + l.value, 0);

  const availabilityPct = scheduledTime > 0 ? (grossOperatingTime / scheduledTime) * 100 : 0;
  const performancePct = grossOperatingTime > 0 ? (netOperatingTime / grossOperatingTime) * 100 : 0;
  const qualityPct = netOperatingTime > 0 ? (effectiveTime / netOperatingTime) * 100 : 0;
  const oeePct = scheduledTime > 0 ? (effectiveTime / scheduledTime) * 100 : 0;

  // Homepage line-averaged prior values
  const activeLines = lines && lines.length > 0 ? lines : [];
  const currAvgOee = activeLines.length
    ? activeLines.reduce((a, l) => a + l.oee, 0) / activeLines.length
    : 75;
  const currAvgAvail = activeLines.length
    ? activeLines.reduce((a, l) => a + l.availability, 0) / activeLines.length
    : 80;
  const currAvgPerf = activeLines.length
    ? activeLines.reduce((a, l) => a + l.performance, 0) / activeLines.length
    : 85;
  const currAvgQual = activeLines.length
    ? activeLines.reduce((a, l) => a + l.quality, 0) / activeLines.length
    : 95;
  const currGoodOutput = activeLines.reduce((a, l) => a + l.outputActual, 0);

  const avgOee = Math.min(
    100,
    Math.max(0, currAvgOee * (1 + rand(`${priorSeed}-avg-oee`, -0.05, 0.05, 3))),
  );
  const avgAvailability = Math.min(
    100,
    Math.max(0, currAvgAvail * (1 + rand(`${priorSeed}-avg-avail`, -0.05, 0.05, 3))),
  );
  const avgPerformance = Math.min(
    100,
    Math.max(0, currAvgPerf * (1 + rand(`${priorSeed}-avg-perf`, -0.05, 0.05, 3))),
  );
  const avgQuality = Math.min(
    100,
    Math.max(0, currAvgQual * (1 + rand(`${priorSeed}-avg-qual`, -0.05, 0.05, 3))),
  );
  const goodOutput = Math.max(
    0,
    Math.round(currGoodOutput * (1 + rand(`${priorSeed}-good-out`, -0.05, 0.05, 3))),
  );

  const getCategoryMinutes = (categoryLabel: string) => {
    const found = priorTree.find((n) => n.label === categoryLabel);
    return found ? found.minutes : 0;
  };

  return {
    scheduledTime,
    grossOperatingTime,
    netOperatingTime,
    effectiveTime,
    totalLossMinutes,
    availabilityPct,
    performancePct,
    qualityPct,
    oeePct,
    avgOee,
    avgAvailability,
    avgPerformance,
    avgQuality,
    goodOutput,
    getCategoryMinutes,
  };
}

export type LossCategoryKind = "stop" | "event";

export const CATEGORY_KIND_MAP: Record<string, LossCategoryKind> = {
  Breakdown: "stop",
  "Minor Stop": "stop",
  Setup: "stop",
  "Setup / Changeover": "stop",
  "Setup + Idle": "stop",
  "Planned Downtime": "stop",
  Unscheduled: "stop",
  "Speed Loss": "event",
  Reject: "event",
  "Scrap / Defect": "event",
  Rework: "event",
};

export function getLossCategoryKind(categoryName: string, parentName?: string): LossCategoryKind {
  if (!categoryName || categoryName === "All loss categories") return "event";
  if (CATEGORY_KIND_MAP[categoryName]) return CATEGORY_KIND_MAP[categoryName];
  if (parentName && CATEGORY_KIND_MAP[parentName]) return CATEGORY_KIND_MAP[parentName];
  return "event";
}

export type LossNodeStats = {
  minutes: number;
  events: number;
  longest: number;
  kind: LossCategoryKind;
};

/** Get statistics for a loss node at any level (parent / child L1 / child L2 / root) */
export function getLossNodeStats(
  scopeSeed: string,
  nodeKey?: string,
  treeNodes?: LossNode[],
): LossNodeStats {
  const tree = treeNodes ?? lossTree(scopeSeed);

  // If root / no node selected ("All loss categories")
  if (!nodeKey || nodeKey === "all") {
    const totalMinutes = tree.reduce((sum, n) => sum + n.minutes, 0);
    const totalEvents = tree.reduce((sum, n) => sum + n.occurrences, 0);
    const maxLongest = tree.reduce((max, n) => {
      const nodeStats = getLossNodeStats(scopeSeed, n.id, tree);
      return Math.max(max, nodeStats.longest);
    }, 0);

    return {
      minutes: totalMinutes,
      events: totalEvents,
      longest: maxLongest || Math.min(totalMinutes, 45),
      kind: "event",
    };
  }

  const targetNode = findNode(tree, nodeKey);
  if (!targetNode) {
    // Fallback if node not found
    return {
      minutes: 0,
      events: 0,
      longest: 0,
      kind: "event",
    };
  }

  // Find parent category to determine stop vs event classification
  let parentCategoryName = targetNode.label;
  for (const p of tree) {
    if (p.id === targetNode.id) {
      parentCategoryName = p.label;
      break;
    }
    if (
      p.children?.some(
        (c) => c.id === targetNode.id || c.children?.some((gc) => gc.id === targetNode.id),
      )
    ) {
      parentCategoryName = p.label;
      break;
    }
  }

  const kind = getLossCategoryKind(targetNode.label, parentCategoryName);
  const minutes = targetNode.minutes;
  // Events must satisfy 1 <= events <= minutes when minutes > 0
  const events = minutes > 0 ? Math.min(targetNode.occurrences, minutes) : 0;

  // Calculate deterministic longest single stop/event duration
  let longest = 0;
  if (minutes > 0 && events > 0) {
    const avgDuration = minutes / events;
    const rngVal = rand(`${scopeSeed}-${targetNode.id}-longest`, 1.1, 2.5, 2);
    longest = Math.min(minutes, Math.max(Math.ceil(avgDuration), Math.round(avgDuration * rngVal)));
  }

  return {
    minutes,
    events,
    longest,
    kind,
  };
}

/** Per-line ideal speed in PPM */
export function getLinePpm(lineId: string): number {
  return 24;
}

export function getScopePpm(lines: Line[]): number {
  if (!lines.length) return 24;
  const speeds = lines.map((l) => getLinePpm(l.id));
  const avgPpm = Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);
  return avgPpm || 24;
}
