/**
 * Official Paragon OEE FRO Loss Tree Taxonomy (L0 - L3) — Master v2.
 * Single source of truth for all loss classifications, parents and reasons.
 * DO NOT RENAME, MERGE OR TRANSLATE ANY LABEL.
 */

export type LossComponent = "Loading" | "Availability" | "Performance" | "Quality";

export type LossParent =
  | "Planned Downtime"
  | "Unscheduled"
  | "Breakdown"
  | "Setup / Changeover"
  | "Minor Stop"
  | "Speed Loss"
  | "Scrap / Defect"
  | "Rework";

/**
 * Single editable constant for downtime alarm L1 classifications.
 * Classifications generated/mapped/tagged for downtime alarms come from these L1 parents.
 */
export const ALARM_L1_PARENTS: LossParent[] = ["Breakdown"];

export interface LossReasonNode {
  id: string;
  name: string;
}

export interface LossCategoryNode {
  id: string;
  name: string;
  reasons: LossReasonNode[];
}

export interface LossParentNode {
  id: LossParent;
  name: string;
  component: LossComponent;
  hint: string;
  categories: LossCategoryNode[];
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCategory(
  comp: LossComponent,
  parent: LossParent,
  catName: string,
  reasons: string[],
): LossCategoryNode {
  const cSlug = slugify(comp);
  const pSlug = slugify(parent);
  const catSlug = slugify(catName);
  const catId = `${cSlug}.${pSlug}.${catSlug}`;

  return {
    id: catId,
    name: catName,
    reasons: reasons.map((r) => ({
      id: `${catId}.${slugify(r)}`,
      name: r,
    })),
  };
}

export const COMPONENTS: { id: LossComponent; name: string; description: string }[] = [
  {
    id: "Loading",
    name: "Loading",
    description: "Scheduled non-operating time, planned downtime, and unscheduled time",
  },
  {
    id: "Availability",
    name: "Availability",
    description: "Equipment breakdowns, failures, and setup/changeover losses",
  },
  {
    id: "Performance",
    name: "Performance",
    description: "Small stops (10 min or less), idling, and reduced operating speed",
  },
  {
    id: "Quality",
    name: "Quality",
    description: "Scrap, defects, startup losses, and rework during production",
  },
];

export const PARENTS: LossParentNode[] = [
  // ------------------------------------------------------------- LOADING
  {
    id: "Planned Downtime",
    name: "Planned Downtime",
    component: "Loading",
    hint: "Scheduled maintenance, briefings, cleanings, and breaks",
    categories: [
      buildCategory("Loading", "Planned Downtime", "Breaks & Meetings", [
        "Line Clearance",
        "Break",
        "Briefing",
        "Pre-Shift Talk (Hello Time)",
      ]),
      buildCategory("Loading", "Planned Downtime", "Planned Maintenance", [
        "Autonomous Maintenance (AM)",
        "Preventive Maintenance (PM)",
      ]),
    ],
  },
  {
    id: "Unscheduled",
    name: "Unscheduled",
    component: "Loading",
    hint: "Unscheduled production periods and planned gaps",
    categories: [buildCategory("Loading", "Unscheduled", "Unscheduled", ["Unscheduled"])],
  },

  // ------------------------------------------------------------- AVAILABILITY
  {
    id: "Breakdown",
    name: "Breakdown",
    component: "Availability",
    hint: "Unscheduled equipment failures lasting more than 10 minutes",
    categories: [
      buildCategory("Availability", "Breakdown", "Bulk / Material", [
        "Bulk Shortage",
        "Bulk Viscosity Above Standard",
        "Waiting for Bulk",
      ]),
      buildCategory("Availability", "Breakdown", "Carton Handling", [
        "Carton Magazine Error",
        "Chute Transfer / Swivel Arm Jam",
        "Carton Flap (Top & Bottom) Error",
      ]),
      buildCategory("Availability", "Breakdown", "Coding / Preformer", [
        "Coding Error",
        "Coding & Preformer Error",
      ]),
      buildCategory("Availability", "Breakdown", "Cutting", ["Dull Cutting Blade"]),
      buildCategory("Availability", "Breakdown", "Filling System", [
        "Filler Error",
        "Filling Error",
        "Nozzle Tailing",
        "Filling Pump Sensor Error",
        "Piston Pump Sensor Error",
      ]),
      buildCategory("Availability", "Breakdown", "General Machine Breakdown", [
        "Machine Breakdown",
        "Piston Disassembly (O-Ring Contamination)",
        "Unstable Net Weight",
      ]),
      buildCategory("Availability", "Breakdown", "Hot Air System", ["Hot Air Error"]),
      buildCategory("Availability", "Breakdown", "Inter-machine Dependency", [
        "Paired Machine Downtime",
      ]),
      buildCategory("Availability", "Breakdown", "Operator", ["Waiting for Operator"]),
      buildCategory("Availability", "Breakdown", "Orientation System", ["Orientation Error"]),
      buildCategory("Availability", "Breakdown", "Packaging Material", [
        "Waiting for Packaging Material",
      ]),
      buildCategory("Availability", "Breakdown", "Pneumatic System", ["Air Hose Leakage"]),
      buildCategory("Availability", "Breakdown", "Pusher Mechanism", ["Pusher Error"]),
      buildCategory("Availability", "Breakdown", "Sensor / Detection", [
        "Ejector Error",
        "Product Sensing Error",
        "Screw Sensor Error",
        "Min/Max Lead Sensor Error",
        "Plug Sensor Error",
      ]),
      buildCategory("Availability", "Breakdown", "Tube Feeding", [
        "Tube Infeed Error",
        "Tube Magazine Error",
      ]),
      buildCategory("Availability", "Breakdown", "Turntable / Holder", [
        "Turntable & Holder Error",
      ]),
    ],
  },
  {
    id: "Setup / Changeover",
    name: "Setup / Changeover",
    component: "Availability",
    hint: "Product recipe changes, format tooling adjustments, and cleaning",
    categories: [
      buildCategory("Availability", "Setup / Changeover", "Changeover", ["Changeover & Setup"]),
      buildCategory("Availability", "Setup / Changeover", "Checking", ["Setup Checking"]),
      buildCategory("Availability", "Setup / Changeover", "Cleaning", [
        "General Cleaning",
        "Cleaning, Changeover & Setup",
        "Cleaning & Setup",
      ]),
      buildCategory("Availability", "Setup / Changeover", "Loading Material", ["Material Loading"]),
      buildCategory("Availability", "Setup / Changeover", "Material Preparation", [
        "Water Weighing",
      ]),
      buildCategory("Availability", "Setup / Changeover", "Move Tank", ["Move Tank Replacement"]),
      buildCategory("Availability", "Setup / Changeover", "New Product Development (NPD)", [
        "NPD Cleaning",
        "NPD Setting",
      ]),
      buildCategory("Availability", "Setup / Changeover", "Premix", ["Off-Process Premix"]),
      buildCategory("Availability", "Setup / Changeover", "Preparation", ["General Preparation"]),
      buildCategory("Availability", "Setup / Changeover", "Process Adjustment", [
        "Raw Material Adjustment",
        "Process Parameter Adjustment",
      ]),
      buildCategory("Availability", "Setup / Changeover", "Scrapping", ["Bulk Scrapping"]),
      buildCategory("Availability", "Setup / Changeover", "Setup Activity", ["Machine Setup"]),
      buildCategory("Availability", "Setup / Changeover", "Unloading", ["Material Unloading"]),
    ],
  },

  // ------------------------------------------------------------- PERFORMANCE
  {
    id: "Minor Stop",
    name: "Minor Stop",
    component: "Performance",
    hint: "Short intermittent stoppages and jams lasting 10 minutes or less",
    categories: [
      buildCategory("Performance", "Minor Stop", "Automation / AMR", ["Waiting for AMR Robot"]),
      buildCategory("Performance", "Minor Stop", "Bulk / Material", [
        "Bulk Overflow",
        "Bulk Not Rising",
        "Scrap Bulk",
        "Waiting for Bulk",
        "Bulk Viscosity Out of Standard",
      ]),
      buildCategory("Performance", "Minor Stop", "Carton Handling", [
        "Bad Carton Not Ejected",
        "Dedusting Alarm",
        "Carton Flap (Top & Bottom) Error / Alarm",
        "Carton Not Vacuumed / Dropped",
        "Carton Stuck in Carton Sealer",
      ]),
      buildCategory("Performance", "Minor Stop", "Cooling System", ["Chiller Down / Clogged"]),
      buildCategory("Performance", "Minor Stop", "Coding / Emboss", [
        "Illegible Coding",
        "Emboss Setting",
      ]),
      buildCategory("Performance", "Minor Stop", "Cutting", [
        "Skewed Cutting",
        "Dull Cutting Blade",
      ]),
      buildCategory("Performance", "Minor Stop", "Filling System", [
        "Filling Error",
        "Unstable Net Weight",
        "Nozzle Tailing",
        "Filling Pump Sensor Error",
        "Piston Pump Sensor Error",
        "NPD Net Weight Setting",
      ]),
      buildCategory("Performance", "Minor Stop", "Hot Air System", [
        "Hot Air Over-Temperature",
        "Dirty Hot Air",
      ]),
      buildCategory("Performance", "Minor Stop", "Inter-machine Dependency", [
        "Waiting for Paired Machine",
      ]),
      buildCategory("Performance", "Minor Stop", "Machine Performance", [
        "Piston Disassembly (O-Ring Contamination)",
        "Chute Transfer Error",
        "FG Stuck in Robopacker",
        "Flipper Error",
        "Loose / Wobbly Orientation Gear",
        "Robopacker Gripper Error",
        "Carton Infeed Error",
        "Machine Overheating",
        "FG Jammed at Mouthpiece",
        "Loose / Colliding Pusher",
        "Broken TZT",
      ]),
      buildCategory("Performance", "Minor Stop", "New Product Development (NPD)", [
        "NPD Minor Stop",
      ]),
      buildCategory("Performance", "Minor Stop", "Operator", ["Waiting for Operator"]),
      buildCategory("Performance", "Minor Stop", "Packaging Material", [
        "Waiting for Packaging Material",
        "Skewed Packaging",
        "Packaging Material Performance Issue",
      ]),
      buildCategory("Performance", "Minor Stop", "PLC / Control System", ["PLC Error"]),
      buildCategory("Performance", "Minor Stop", "Pneumatic System", [
        "Low Compressed Air Pressure",
        "Water in Compressor Tank",
      ]),
      buildCategory("Performance", "Minor Stop", "Sealing", [
        "Seal Leakage",
        "Seal Blistering",
        "Skewed Seal",
        "Seal Position Too High",
        "Hooked Seal",
        "Seal Dog-Ear",
        "Cracked Seal",
        "Stringy Seal",
      ]),
      buildCategory("Performance", "Minor Stop", "Sensor / Detection", [
        "DYN Sensor Alarm",
        "Product Sensing Error",
        "Screw Sensor Error",
        "Bulk / Hopper Sensor Error",
        "Eyemark Sensor Error",
        "Min/Max Lead Sensor Error",
        "Plug Sensor Error",
      ]),
    ],
  },
  {
    id: "Speed Loss",
    name: "Speed Loss",
    component: "Performance",
    hint: "Operating below standard rated speed",
    categories: [
      buildCategory("Performance", "Speed Loss", "Reduced Speed for Quality", [
        "Slow run to prevent foaming",
        "Slow run due to delicate packaging",
        "Reduced speed during heat tunnel heating",
        "Capper torque stabilization speed",
      ]),
      buildCategory("Performance", "Speed Loss", "Line Balancing & Flow Constraints", [
        "Downstream machine bottleneck throttling",
        "Upstream supply starvation",
        "Operator training pace",
      ]),
    ],
  },

  // ------------------------------------------------------------- QUALITY
  {
    id: "Scrap / Defect",
    name: "Scrap / Defect",
    component: "Quality",
    hint: "Unacceptable products, rejected units, and non-recoverable waste",
    categories: [
      buildCategory("Quality", "Scrap / Defect", "Fill / Volume Rejection", [
        "Underfilled bottle (< lower spec limit)",
        "Overfilled bottle (> upper spec limit)",
        "Nozzle splash / external contamination",
      ]),
      buildCategory("Quality", "Scrap / Defect", "Capping / Seal Defect", [
        "Canted / crooked cap",
        "Loose cap (insufficient torque)",
        "Stripped cap thread (over-torque)",
        "Induction foil seal missing or incomplete",
      ]),
      buildCategory("Quality", "Scrap / Defect", "Labelling & Code Defect", [
        "Skewed / bubbled label",
        "Missing expiry / batch inkjet code",
        "Unreadable barcode scan",
      ]),
    ],
  },
  {
    id: "Rework",
    name: "Rework",
    component: "Quality",
    hint: "Recoverable units requiring manual re-capping, re-packing, or relabeling",
    categories: [
      buildCategory("Quality", "Rework", "Packaging Rework", [
        "Manual cap retorquing",
        "Manual label removal and re-application",
        "Carton repack due to damaged carton box",
      ]),
    ],
  },
];

/**
 * Maps an L1 parent name to its parent OEE component (L0)
 */
export function componentOf(parent: LossParent): LossComponent {
  const p = PARENTS.find((item) => item.id === parent);
  return p ? p.component : "Availability";
}

/**
 * Returns categories under a given L1 parent
 */
export function categoriesOf(parent: LossParent): LossCategoryNode[] {
  const p = PARENTS.find((item) => item.id === parent);
  return p ? p.categories : [];
}

/**
 * Automatic L1 assignment based on detected event type
 */
export function autoParent(
  eventType: "downtime" | "minor_stop" | "speed_loss" | "planned",
): LossParent {
  switch (eventType) {
    case "downtime":
      return "Breakdown";
    case "minor_stop":
      return "Minor Stop";
    case "speed_loss":
      return "Speed Loss";
    case "planned":
    default:
      return "Planned Downtime";
  }
}

/**
 * Checks if an L1 parent is blocked for a given detected event type
 */
export function parentBlock(
  parent: LossParent,
  eventType: "downtime" | "minor_stop" | "speed_loss" | "planned",
): string | null {
  if (eventType === "planned") {
    if (parent !== "Planned Downtime" && parent !== "Unscheduled") {
      return "Planned stops can only be classified under Planned Downtime or Unscheduled";
    }
    return null;
  }
  if (eventType === "speed_loss") {
    if (parent !== "Speed Loss" && parent !== "Scrap / Defect" && parent !== "Rework") {
      return "Speed losses cannot be classified under physical stoppage categories";
    }
    return null;
  }
  if (eventType === "downtime") {
    if (parent === "Minor Stop") {
      return "Downtimes (more than 10 min) must use Breakdown or Setup / Changeover";
    }
    if (parent === "Speed Loss") {
      return "Machine stopped completely; cannot be classified as Speed Loss";
    }
    return null;
  }
  if (eventType === "minor_stop") {
    if (parent === "Breakdown") {
      return "Stops 10 min or less are Minor Stops; promote to Breakdown only if more than 10 min";
    }
    if (parent === "Speed Loss") {
      return "Machine stopped with 0 output; cannot be Speed Loss";
    }
    return null;
  }
  return null;
}

/**
 * Checks if an L0 component is blocked for a given detected event type
 */
export function componentBlock(
  comp: LossComponent,
  eventType: "downtime" | "minor_stop" | "speed_loss" | "planned",
): string | null {
  if (eventType === "planned") {
    if (comp !== "Loading") {
      return "Planned stops belong exclusively to the Loading component";
    }
    return null;
  }
  if (eventType === "speed_loss") {
    if (comp === "Availability" || comp === "Loading") {
      return "Equipment was running, only Performance or Quality losses apply";
    }
    return null;
  }
  if (eventType === "downtime" || eventType === "minor_stop") {
    if (comp === "Loading") {
      return "Unplanned stop during production cannot be classified under Loading";
    }
    return null;
  }
  return null;
}

/**
 * PLC Alarm Code to Loss Tree Master mapping.
 * When a downtime event carries a mapped PLC alarm code, L2 and L3 are filled automatically.
 */
export const PLC_ALARM_MAPPINGS: Record<
  string,
  { l1Parent: LossParent; l2CategoryName: string; l3ReasonName: string }
> = {
  // Filling system
  "Filler Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Filling System",
    l3ReasonName: "Filler Error",
  },
  "Filling Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Filling System",
    l3ReasonName: "Filling Error",
  },
  "Nozzle Tailing": {
    l1Parent: "Breakdown",
    l2CategoryName: "Filling System",
    l3ReasonName: "Nozzle Tailing",
  },
  "Filling Pump Sensor Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Filling System",
    l3ReasonName: "Filling Pump Sensor Error",
  },
  "Piston Pump Sensor Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Filling System",
    l3ReasonName: "Piston Pump Sensor Error",
  },
  "PLC-ERR-FILL-01": {
    l1Parent: "Breakdown",
    l2CategoryName: "Filling System",
    l3ReasonName: "Filler Error",
  },

  // Pneumatic
  "Pneumatic cylinder seal leak": {
    l1Parent: "Breakdown",
    l2CategoryName: "Pneumatic System",
    l3ReasonName: "Air Hose Leakage",
  },
  "Air Hose Leakage": {
    l1Parent: "Breakdown",
    l2CategoryName: "Pneumatic System",
    l3ReasonName: "Air Hose Leakage",
  },
  "PLC-ERR-PNEU-04": {
    l1Parent: "Breakdown",
    l2CategoryName: "Pneumatic System",
    l3ReasonName: "Air Hose Leakage",
  },

  // Carton handling
  "Carton Magazine Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Carton Handling",
    l3ReasonName: "Carton Magazine Error",
  },
  "Chute Transfer / Swivel Arm Jam": {
    l1Parent: "Breakdown",
    l2CategoryName: "Carton Handling",
    l3ReasonName: "Chute Transfer / Swivel Arm Jam",
  },
  "Conveyor jam at infeed": {
    l1Parent: "Breakdown",
    l2CategoryName: "Carton Handling",
    l3ReasonName: "Chute Transfer / Swivel Arm Jam",
  },
  "Carton Flap (Top & Bottom) Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Carton Handling",
    l3ReasonName: "Carton Flap (Top & Bottom) Error",
  },
  "PLC-ERR-CART-02": {
    l1Parent: "Breakdown",
    l2CategoryName: "Carton Handling",
    l3ReasonName: "Carton Magazine Error",
  },

  // General Machine Breakdown
  "Bearing seizure on main drive": {
    l1Parent: "Breakdown",
    l2CategoryName: "General Machine Breakdown",
    l3ReasonName: "Machine Breakdown",
  },
  "Machine Breakdown": {
    l1Parent: "Breakdown",
    l2CategoryName: "General Machine Breakdown",
    l3ReasonName: "Machine Breakdown",
  },
  "Piston Disassembly (O-Ring Contamination)": {
    l1Parent: "Breakdown",
    l2CategoryName: "General Machine Breakdown",
    l3ReasonName: "Piston Disassembly (O-Ring Contamination)",
  },
  "Unstable Net Weight": {
    l1Parent: "Breakdown",
    l2CategoryName: "General Machine Breakdown",
    l3ReasonName: "Unstable Net Weight",
  },

  // Sensors & Detection
  "Product Sensing Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Sensor / Detection",
    l3ReasonName: "Product Sensing Error",
  },
  "Ejector Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Sensor / Detection",
    l3ReasonName: "Ejector Error",
  },
  "Screw Sensor Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Sensor / Detection",
    l3ReasonName: "Screw Sensor Error",
  },
  "Min/Max Lead Sensor Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Sensor / Detection",
    l3ReasonName: "Min/Max Lead Sensor Error",
  },
  "Plug Sensor Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Sensor / Detection",
    l3ReasonName: "Plug Sensor Error",
  },
  "PLC-ERR-SENS-03": {
    l1Parent: "Breakdown",
    l2CategoryName: "Sensor / Detection",
    l3ReasonName: "Product Sensing Error",
  },

  // Tube Feeding
  "Tube Infeed Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Tube Feeding",
    l3ReasonName: "Tube Infeed Error",
  },
  "Tube Magazine Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Tube Feeding",
    l3ReasonName: "Tube Magazine Error",
  },
  "PLC-ERR-TUBE-01": {
    l1Parent: "Breakdown",
    l2CategoryName: "Tube Feeding",
    l3ReasonName: "Tube Infeed Error",
  },

  // Turntable & Pusher
  "Turntable & Holder Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Turntable / Holder",
    l3ReasonName: "Turntable & Holder Error",
  },
  "Pusher Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Pusher Mechanism",
    l3ReasonName: "Pusher Error",
  },

  // Hot Air & Cutting
  "Hot Air Error": {
    l1Parent: "Breakdown",
    l2CategoryName: "Hot Air System",
    l3ReasonName: "Hot Air Error",
  },
  "Dull Cutting Blade": {
    l1Parent: "Breakdown",
    l2CategoryName: "Cutting",
    l3ReasonName: "Dull Cutting Blade",
  },
};

/**
 * Matches a PLC alarm code/string against the loss tree master mapping under ALARM_L1_PARENTS.
 */
export function matchPlcAlarmCode(
  plcAlarm?: string,
): { l1Parent: LossParent; l2CategoryName: string; l3ReasonName: string } | null {
  if (!plcAlarm) return null;
  const direct = PLC_ALARM_MAPPINGS[plcAlarm];
  if (direct) return direct;

  const lower = plcAlarm.toLowerCase();
  for (const [key, mapping] of Object.entries(PLC_ALARM_MAPPINGS)) {
    if (lower === key.toLowerCase() || lower.includes(key.toLowerCase())) {
      return mapping;
    }
  }

  // Also check if matches any Breakdown reason directly
  const breakdownParent = PARENTS.find((p) => p.id === "Breakdown");
  if (breakdownParent) {
    for (const cat of breakdownParent.categories) {
      for (const r of cat.reasons) {
        if (
          lower === r.name.toLowerCase() ||
          lower.includes(r.name.toLowerCase()) ||
          r.name.toLowerCase().includes(lower)
        ) {
          return {
            l1Parent: "Breakdown",
            l2CategoryName: cat.name,
            l3ReasonName: r.name,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Pre-tagged PLC categories for automatic telemetry faults
 */
export const PLC_CATEGORIES: Record<
  string,
  { parent: LossParent; categoryId: string; reasonId: string }
> = {
  "Conveyor jam at infeed": {
    parent: "Breakdown",
    categoryId: "availability.breakdown.carton-handling",
    reasonId: "availability.breakdown.carton-handling.chute-transfer-swivel-arm-jam",
  },
  "Pneumatic cylinder seal leak": {
    parent: "Breakdown",
    categoryId: "availability.breakdown.pneumatic-system",
    reasonId: "availability.breakdown.pneumatic-system.air-hose-leakage",
  },
  "Filler Error": {
    parent: "Breakdown",
    categoryId: "availability.breakdown.filling-system",
    reasonId: "availability.breakdown.filling-system.filler-error",
  },
  "Carton Magazine Error": {
    parent: "Breakdown",
    categoryId: "availability.breakdown.carton-handling",
    reasonId: "availability.breakdown.carton-handling.carton-magazine-error",
  },
};
