/**
 * Master Data & Physical Shopfloor Layout Configuration for Plant Jatake 2 (J2).
 *
 * Source of truth:
 * - Shopfloor_J2_Plant_Layout.png (Physical coordinates, flow directions, groupings)
 * - Shopfloor_J2_Plant_List_Line___Machine.png (Zone -> Line -> Machine order)
 *
 * Revision Round 2 Enhancements:
 * - Generous line and machine spacing constants.
 * - Outward label anchoring with leader lines.
 * - Dynamic zone bounding calculation and auto-fit camera viewport.
 * - Non-occluding label layering.
 */

import { SENSOR_SPEC, type Status } from "./config";
import { makeRng, pick, rand } from "./rng";

// ==========================================
// NAMED TUNING CONSTANTS (Revision Round 2)
// ==========================================

/** Vertical distance/gap between adjacent lines in Zone View (Production Floor Map) */
export const LINE_GAP = 2.4;

/** Vertical distance/gap between adjacent lines in Plant View (Zone Map) */
export const PLANT_LINE_GAP = 1.7;

/** Horizontal spacing between consecutive machines in Zone View */
export const MACHINE_GAP = 1.45;

/** Horizontal spacing between consecutive machines in Plant View */
export const PLANT_MACHINE_GAP = 0.95;

/** Aisle gap between Zone A, Zone B, and Zone C footprints in Plant View */
export const ZONE_GAP = 3.6;

/** Padding around zone bounding boxes to generate the red dashed floor plates */
export const ZONE_PADDING = {
  x: 1.4,
  y: 1.4,
};

/** 3D Block Dimensions in Plant View (w, d, h) */
export const PLANT_BLOCK_SIZE = {
  w: 0.65,
  d: 0.52,
  h: 12,
};

/** 3D Block Dimensions in Zone View (reduced by ~18% for crisp machine separation) */
export const ZONE_BLOCK_SIZE = {
  w: 0.78,
  d: 0.65,
  h: 14,
};

/** Camera & Viewport auto-fit margin percentage on all sides (4%) */
export const CAMERA_FIT_MARGIN_PERCENT = 0.04;

/** Default 3D Elevation Angle in degrees (steeper top-down angle reduces occlusion) */
export const DEFAULT_ELEVATION_DEG = 52;

export type FlowDirection = "left-to-right" | "right-to-left";

export type J2MachineConfig = {
  code: string;
  name?: string;
  type?: string;
  /** Relative offset within line (or sub-row definition) */
  offsetX?: number;
  offsetY?: number;
  subRow?: "main" | "top";
  stackPos?: "upper" | "lower";
};

export type J2LineConfig = {
  code: string;
  zoneId: "A" | "B" | "C";
  flowDirection: FlowDirection;
  labelSide: "left" | "right";
  column: "left" | "right" | "single";
  rowOrder: number;
  /** Physical layout anchor in plant coordinate space (Plant View) */
  layout: {
    x: number;
    y: number;
    labelOffset?: { x: number; y: number };
  };
  /** Local layout anchor inside Zone View (zoomed in, spacious layout) */
  zoneViewLayout: {
    x: number;
    y: number;
    labelOffset?: { x: number; y: number };
  };
  machines: J2MachineConfig[];
};

export type J2ZoneFootprint = {
  id: "A" | "B" | "C";
  name: string;
  title: string;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  labelPos: { x: number; y: number };
  polygon: { x: number; y: number }[];
};

/**
 * Complete J2 Lines & Machine sequence config
 */
export const J2_LINES_CONFIG: J2LineConfig[] = [
  // ==========================================
  // ZONE A (15 lines) - Flow: Left -> Right (▶)
  // Left column (TUP05, TUP03, TUP04, TUP07, TUP10, TUP12, TUP02, TUP01)
  // Middle column (BLP03, TUP11, TUP09, TUP06, TUP08, TUP14, TUP13)
  // ==========================================
  {
    code: "TUP05",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "left",
    rowOrder: 1,
    layout: { x: 2.2, y: 1.4 },
    zoneViewLayout: { x: 2.6, y: 1.4 },
    machines: [{ code: "LTF05", name: "Tube Filler 05", type: "Tube Filler" }],
  },
  {
    code: "TUP03",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "left",
    rowOrder: 2,
    layout: { x: 2.2, y: 3.4 },
    zoneViewLayout: { x: 2.6, y: 3.8 },
    machines: [{ code: "LTF03", name: "Tube Filler 03", type: "Tube Filler" }],
  },
  {
    code: "TUP04",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "left",
    rowOrder: 3,
    layout: { x: 2.2, y: 5.4 },
    zoneViewLayout: { x: 2.6, y: 6.2 },
    machines: [{ code: "LTF04", name: "Tube Filler 04", type: "Tube Filler" }],
  },
  {
    code: "TUP07",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "left",
    rowOrder: 4,
    layout: { x: 2.2, y: 7.4 },
    zoneViewLayout: { x: 2.6, y: 8.6 },
    machines: [{ code: "LTF07", name: "Tube Filler 07", type: "Tube Filler" }],
  },
  {
    code: "TUP10",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "left",
    rowOrder: 5,
    layout: { x: 2.2, y: 9.4 },
    zoneViewLayout: { x: 2.6, y: 11.0 },
    machines: [{ code: "LTF10", name: "Tube Filler 10", type: "Tube Filler" }],
  },
  {
    code: "TUP12",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "left",
    rowOrder: 6,
    layout: { x: 2.2, y: 11.4 },
    zoneViewLayout: { x: 2.6, y: 13.4 },
    machines: [{ code: "LTF12", name: "Tube Filler 12", type: "Tube Filler" }],
  },
  {
    code: "TUP02",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "left",
    rowOrder: 7,
    layout: { x: 2.2, y: 13.4 },
    zoneViewLayout: { x: 2.6, y: 15.8 },
    machines: [{ code: "LTF02", name: "Tube Filler 02", type: "Tube Filler" }],
  },
  {
    code: "TUP01",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "left",
    rowOrder: 8,
    layout: { x: 2.2, y: 15.6 },
    zoneViewLayout: { x: 2.6, y: 18.2 },
    machines: [
      { code: "LTR01", name: "Tube Robot 01", type: "Tube Robot" },
      { code: "LRP01", name: "Robotic Packer 01", type: "Robotic Packer" },
    ],
  },
  // Zone A - Middle column
  {
    code: "BLP03",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "right",
    rowOrder: 1,
    layout: { x: 6.8, y: 1.4 },
    zoneViewLayout: { x: 8.6, y: 1.4 },
    machines: [{ code: "LBP03", name: "Blister Packer 03", type: "Blister Packer" }],
  },
  {
    code: "TUP11",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "right",
    rowOrder: 2,
    layout: { x: 6.8, y: 3.6 },
    zoneViewLayout: { x: 8.6, y: 3.8 },
    machines: [
      { code: "LTF11", name: "Tube Filler 11", type: "Tube Filler" },
      { code: "LCM04", name: "Cartoner 04", type: "Cartoner" },
      { code: "LCW04", name: "Checkweigher 04", type: "Checkweigher" },
    ],
  },
  {
    code: "TUP09",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "right",
    rowOrder: 3,
    layout: { x: 6.8, y: 5.8 },
    zoneViewLayout: { x: 8.6, y: 6.2 },
    machines: [
      { code: "LTF09", name: "Tube Filler 09", type: "Tube Filler" },
      { code: "LCM03", name: "Cartoner 03", type: "Cartoner" },
      { code: "LCW03", name: "Checkweigher 03", type: "Checkweigher" },
    ],
  },
  {
    code: "TUP06",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "right",
    rowOrder: 4,
    layout: { x: 6.8, y: 8.0 },
    zoneViewLayout: { x: 8.6, y: 8.6 },
    machines: [
      { code: "LTF06", name: "Tube Filler 06", type: "Tube Filler" },
      { code: "LCM01", name: "Cartoner 01", type: "Cartoner" },
      { code: "LCW01", name: "Checkweigher 01", type: "Checkweigher" },
    ],
  },
  {
    code: "TUP08",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "right",
    rowOrder: 5,
    layout: { x: 6.8, y: 10.2 },
    zoneViewLayout: { x: 8.6, y: 11.0 },
    machines: [
      { code: "LTF08", name: "Tube Filler 08", type: "Tube Filler" },
      { code: "LCM02", name: "Cartoner 02", type: "Cartoner" },
      { code: "LCW02", name: "Checkweigher 02", type: "Checkweigher" },
    ],
  },
  {
    code: "TUP14",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "right",
    rowOrder: 6,
    layout: { x: 6.8, y: 12.6 },
    zoneViewLayout: { x: 8.6, y: 13.6 },
    machines: [
      { code: "LTF14", name: "Tube Filler 14", type: "Tube Filler" },
      { code: "LCW10", name: "Checkweigher 10", type: "Checkweigher" },
      { code: "CRT01", name: "Cartoner Robot 01", type: "Cartoner Robot" },
    ],
  },
  {
    code: "TUP13",
    zoneId: "A",
    flowDirection: "left-to-right",
    labelSide: "left",
    column: "right",
    rowOrder: 7,
    layout: { x: 6.8, y: 15.6 },
    zoneViewLayout: { x: 8.6, y: 18.2 },
    machines: [
      { code: "LTF13", name: "Tube Filler 13", type: "Tube Filler" },
      { code: "LCW05", name: "Checkweigher 05", type: "Checkweigher" },
      { code: "LRP02", name: "Robotic Packer 02", type: "Robotic Packer" },
      { code: "LRP03", name: "Robotic Packer 03", type: "Robotic Packer" },
    ],
  },

  // ==========================================
  // ZONE B (13 lines) - Flow: Right -> Left (◄)
  // Stacked vertically in one column
  // BOP02, BOP03, BOP04, BOP05, BOP14, BOP11, BOP12, POP01
  // [gap] BOP13, BOP15, JAP04 [gap] BOP01, BOP16
  // ==========================================
  {
    code: "BOP02",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 1,
    layout: { x: 13.8, y: 1.4 },
    zoneViewLayout: { x: 4.2, y: 1.4 },
    machines: [
      { code: "LLM02", name: "Labeller 02", type: "Labeller" },
      { code: "LBC02", name: "Bottle Capper 02", type: "Bottle Capper" },
      { code: "LBF02", name: "Bottle Filler 02", type: "Bottle Filler" },
      { code: "LAS01", name: "Auto Sorter 01", type: "Auto Sorter" },
    ],
  },
  {
    code: "BOP03",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 2,
    layout: { x: 13.8, y: 3.4 },
    zoneViewLayout: { x: 4.2, y: 3.8 },
    machines: [
      { code: "LSM02", name: "Sachet Machine 02", type: "Sachet Machine" },
      { code: "LLM03", name: "Labeller 03", type: "Labeller" },
      { code: "LBC03", name: "Bottle Capper 03", type: "Bottle Capper" },
      { code: "LBF03", name: "Bottle Filler 03", type: "Bottle Filler" },
      { code: "LAS02", name: "Auto Sorter 02", type: "Auto Sorter" },
    ],
  },
  {
    code: "BOP04",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 3,
    layout: { x: 13.8, y: 5.4 },
    zoneViewLayout: { x: 4.2, y: 6.2 },
    machines: [
      { code: "LSM02", name: "Sachet Machine 02", type: "Sachet Machine" },
      { code: "LLM04", name: "Labeller 04", type: "Labeller" },
      { code: "LBC04", name: "Bottle Capper 04", type: "Bottle Capper" },
      { code: "LBF04", name: "Bottle Filler 04", type: "Bottle Filler" },
      { code: "LAS03", name: "Auto Sorter 03", type: "Auto Sorter" },
    ],
  },
  {
    code: "BOP05",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 4,
    layout: { x: 13.8, y: 7.4 },
    zoneViewLayout: { x: 4.2, y: 8.6 },
    machines: [
      { code: "LSM03", name: "Sachet Machine 03", type: "Sachet Machine" },
      { code: "LLM05", name: "Labeller 05", type: "Labeller" },
      { code: "LBC05", name: "Bottle Capper 05", type: "Bottle Capper" },
      { code: "LBF05", name: "Bottle Filler 05", type: "Bottle Filler" },
      { code: "LAS04", name: "Auto Sorter 04", type: "Auto Sorter" },
    ],
  },
  {
    code: "BOP14",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 5,
    layout: { x: 16.7, y: 9.4 },
    zoneViewLayout: { x: 8.5, y: 11.0 },
    machines: [
      { code: "LLM09", name: "Labeller 09", type: "Labeller" },
      { code: "LBF10", name: "Bottle Filler 10", type: "Bottle Filler" },
    ],
  },
  {
    code: "BOP11",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 6,
    layout: { x: 17.6, y: 11.2 },
    zoneViewLayout: { x: 10.0, y: 13.2 },
    machines: [{ code: "LBF07", name: "Bottle Filler 07", type: "Bottle Filler" }],
  },
  {
    code: "BOP12",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 7,
    layout: { x: 16.7, y: 13.0 },
    zoneViewLayout: { x: 8.5, y: 15.4 },
    machines: [
      { code: "LLM07", name: "Labeller 07", type: "Labeller" },
      { code: "LBF08", name: "Bottle Filler 08", type: "Bottle Filler" },
    ],
  },
  {
    code: "POP01",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 8,
    layout: { x: 17.6, y: 14.8 },
    zoneViewLayout: { x: 10.0, y: 17.6 },
    machines: [{ code: "LPP01", name: "Pouch Packer 01", type: "Pouch Packer" }],
  },
  // Gap before mid section
  {
    code: "BOP13",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 9,
    layout: { x: 14.8, y: 17.6 },
    zoneViewLayout: { x: 5.6, y: 20.8 },
    machines: [
      { code: "LSM04", name: "Sachet Machine 04", type: "Sachet Machine" },
      { code: "LLM08", name: "Labeller 08", type: "Labeller" },
      { code: "LBC06", name: "Bottle Capper 06", type: "Bottle Capper" },
      { code: "LBF09", name: "Bottle Filler 09", type: "Bottle Filler" },
    ],
  },
  {
    code: "BOP15",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 10,
    layout: { x: 13.8, y: 19.8 },
    zoneViewLayout: { x: 4.2, y: 23.4 },
    machines: [
      { code: "LCM", name: "Cartoner", type: "Cartoner" },
      { code: "LBC", name: "Bottle Capper", type: "Bottle Capper" },
      { code: "LBF15-1", name: "Bottle Filler 15-1", type: "Bottle Filler" },
      { code: "LBF15-2", name: "Bottle Filler 15-2", type: "Bottle Filler" },
      { code: "LBF15-3", name: "Bottle Filler 15-3", type: "Bottle Filler" },
    ],
  },
  {
    code: "JAP04",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 11,
    layout: { x: 14.8, y: 22.0 },
    zoneViewLayout: { x: 5.6, y: 26.0 },
    machines: [
      { code: "LAS", name: "Auto Sorter", type: "Auto Sorter" },
      { code: "SHR", name: "Shrink Wrapper", type: "Shrink Wrapper" },
      { code: "LLM", name: "Labeller", type: "Labeller" },
      { code: "LJF01", name: "Jar Filler 01", type: "Jar Filler" },
    ],
  },
  // Gap before bottom section
  {
    code: "BOP01",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 12,
    layout: { x: 15.8, y: 24.8 },
    zoneViewLayout: { x: 7.0, y: 29.2 },
    machines: [
      { code: "LBC", name: "Bottle Capper", type: "Bottle Capper" },
      { code: "LBF", name: "Bottle Filler", type: "Bottle Filler" },
      { code: "FEEDER", name: "Cap Feeder", type: "Cap Feeder" },
    ],
  },
  {
    code: "BOP16",
    zoneId: "B",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 13,
    layout: { x: 15.8, y: 27.2 },
    zoneViewLayout: { x: 7.0, y: 32.0 },
    machines: [
      {
        code: "SHR01",
        name: "Shrink Wrapper 01",
        type: "Shrink Wrapper",
        subRow: "top",
        offsetX: 0,
        offsetY: -0.85,
      },
      {
        code: "SHR",
        name: "Shrink Wrapper",
        type: "Shrink Wrapper",
        subRow: "top",
        offsetX: 1.45,
        offsetY: -0.85,
      },
      {
        code: "LBC",
        name: "Bottle Capper",
        type: "Bottle Capper",
        subRow: "main",
        offsetX: 0,
        offsetY: 0,
      },
      {
        code: "LBF",
        name: "Bottle Filler",
        type: "Bottle Filler",
        subRow: "main",
        offsetX: 1.45,
        offsetY: 0,
      },
      {
        code: "FEEDER",
        name: "Cap Feeder",
        type: "Cap Feeder",
        subRow: "main",
        offsetX: 2.9,
        offsetY: 0,
      },
    ],
  },

  // ==========================================
  // ZONE C (12 lines) - Flow: Right -> Left (◄)
  // Stacked vertically in one column
  // CUP02, BOP10, JAP03, BOP09
  // [gap] EMP02, CUP01, EMP01, EMP03
  // [gap] EMP07, BOP06, EMP15, EMP17
  // ==========================================
  {
    code: "CUP02",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 1,
    layout: { x: 26.2, y: 1.4 },
    zoneViewLayout: { x: 3.6, y: 1.4 },
    machines: [
      { code: "LLM16", name: "Labeller 16", type: "Labeller" },
      { code: "LCM05", name: "Cartoner 05", type: "Cartoner" },
      { code: "LLM15", name: "Labeller 15", type: "Labeller" },
      { code: "LLM14", name: "Labeller 14", type: "Labeller" },
      { code: "LCF02", name: "Cream Filler 02", type: "Cream Filler" },
    ],
  },
  {
    code: "BOP10",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 2,
    layout: { x: 29.8, y: 3.4 },
    zoneViewLayout: { x: 7.9, y: 3.8 },
    machines: [
      { code: "LLM11", name: "Labeller 11", type: "Labeller" },
      { code: "LBF11", name: "Bottle Filler 11", type: "Bottle Filler" },
    ],
  },
  {
    code: "JAP03",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 3,
    layout: { x: 28.6, y: 5.4 },
    zoneViewLayout: { x: 6.5, y: 6.2 },
    machines: [
      { code: "LCM07", name: "Cartoner 07", type: "Cartoner" },
      { code: "LBC12", name: "Bottle Capper 12", type: "Bottle Capper" },
      { code: "LJF01", name: "Jar Filler 01", type: "Jar Filler" },
    ],
  },
  {
    code: "BOP09",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 4,
    layout: { x: 29.8, y: 7.4 },
    zoneViewLayout: { x: 7.9, y: 8.6 },
    machines: [
      { code: "LLM19", name: "Labeller 19", type: "Labeller" },
      { code: "LBF12", name: "Bottle Filler 12", type: "Bottle Filler" },
    ],
  },
  // Gap before mid group
  {
    code: "EMP02",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 5,
    layout: { x: 27.4, y: 10.0 },
    zoneViewLayout: { x: 5.1, y: 11.4 },
    machines: [
      { code: "LSM07", name: "Sachet Machine 07", type: "Sachet Machine", offsetX: 0, offsetY: 0 },
      { code: "LBC08", name: "Bottle Capper 08", type: "Bottle Capper", offsetX: 1.45, offsetY: 0 },
      {
        code: "LEF02",
        name: "Emulsion Filler 02",
        type: "Emulsion Filler",
        stackPos: "upper",
        offsetX: 2.9,
        offsetY: -0.5,
      },
      {
        code: "LEF03",
        name: "Emulsion Filler 03",
        type: "Emulsion Filler",
        stackPos: "lower",
        offsetX: 2.9,
        offsetY: 0.5,
      },
    ],
  },
  {
    code: "CUP01",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 6,
    layout: { x: 28.6, y: 12.4 },
    zoneViewLayout: { x: 6.5, y: 14.0 },
    machines: [
      { code: "LLM13", name: "Labeller 13", type: "Labeller" },
      { code: "LLM12", name: "Labeller 12", type: "Labeller" },
      { code: "LCF01", name: "Cream Filler 01", type: "Cream Filler" },
    ],
  },
  {
    code: "EMP01",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 7,
    layout: { x: 29.8, y: 14.4 },
    zoneViewLayout: { x: 7.9, y: 16.4 },
    machines: [
      { code: "LCW07", name: "Checkweigher 07", type: "Checkweigher" },
      { code: "LEF01", name: "Emulsion Filler 01", type: "Emulsion Filler" },
    ],
  },
  {
    code: "EMP03",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 8,
    layout: { x: 29.8, y: 16.4 },
    zoneViewLayout: { x: 7.9, y: 18.8 },
    machines: [
      { code: "SHR", name: "Shrink Wrapper", type: "Shrink Wrapper" },
      { code: "LEF04", name: "Emulsion Filler 04", type: "Emulsion Filler" },
    ],
  },
  // Gap before bottom group
  {
    code: "EMP07",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 9,
    layout: { x: 29.8, y: 19.2 },
    zoneViewLayout: { x: 7.9, y: 21.8 },
    machines: [
      { code: "LSM08", name: "Sachet Machine 08", type: "Sachet Machine" },
      { code: "LEF06", name: "Emulsion Filler 06", type: "Emulsion Filler" },
    ],
  },
  {
    code: "BOP06",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 10,
    layout: { x: 28.6, y: 21.2 },
    zoneViewLayout: { x: 6.5, y: 24.2 },
    machines: [
      { code: "LCW06", name: "Checkweigher 06", type: "Checkweigher" },
      { code: "LLM06", name: "Labeller 06", type: "Labeller" },
      { code: "LBF06", name: "Bottle Filler 06", type: "Bottle Filler" },
    ],
  },
  {
    code: "EMP15",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 11,
    layout: { x: 29.8, y: 23.2 },
    zoneViewLayout: { x: 7.9, y: 26.6 },
    machines: [
      { code: "LCW08", name: "Checkweigher 08", type: "Checkweigher" },
      { code: "LEF07", name: "Emulsion Filler 07", type: "Emulsion Filler" },
    ],
  },
  {
    code: "EMP17",
    zoneId: "C",
    flowDirection: "right-to-left",
    labelSide: "right",
    column: "single",
    rowOrder: 12,
    layout: { x: 31.0, y: 25.2 },
    zoneViewLayout: { x: 9.3, y: 29.0 },
    machines: [{ code: "LEF02", name: "Emulsion Filler 02", type: "Emulsion Filler" }],
  },
];

/**
 * Dynamically computes Zone Footprint bounding box & polygon for Zone A, B, C
 */
export function getZoneFootprint(zoneId: "A" | "B" | "C"): J2ZoneFootprint {
  const lines = J2_LINES_CONFIG.filter((l) => l.zoneId === zoneId);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const l of lines) {
    for (let mi = 0; mi < l.machines.length; mi++) {
      const m = l.machines[mi];
      const mx = l.layout.x + (m.offsetX ?? mi * PLANT_MACHINE_GAP);
      const my = l.layout.y + (m.offsetY ?? 0);
      if (mx < minX) minX = mx;
      if (mx + PLANT_BLOCK_SIZE.w > maxX) maxX = mx + PLANT_BLOCK_SIZE.w;
      if (my < minY) minY = my;
      if (my + PLANT_BLOCK_SIZE.d > maxY) maxY = my + PLANT_BLOCK_SIZE.d;
    }
  }

  // Apply padding so all blocks and aisle labels fit comfortably inside
  const px = ZONE_PADDING.x;
  const py = ZONE_PADDING.y;

  const bMinX = minX - (zoneId === "A" ? px * 1.6 : px * 0.8);
  const bMaxX = maxX + (zoneId === "A" ? px * 0.8 : px * 1.6);
  const bMinY = minY - py * 0.9;
  const bMaxY = maxY + py * 0.9;

  return {
    id: zoneId,
    name: `Zone ${zoneId}`,
    title: `ZONE ${zoneId}`,
    bounds: {
      minX: bMinX,
      maxX: bMaxX,
      minY: bMinY,
      maxY: bMaxY,
    },
    labelPos: {
      x: (bMinX + bMaxX) / 2,
      y: bMinY - 0.9,
    },
    polygon: [
      { x: bMinX, y: bMinY },
      { x: bMaxX, y: bMinY },
      { x: bMaxX, y: bMaxY },
      { x: bMinX, y: bMaxY },
    ],
  };
}

export const J2_ZONE_FOOTPRINTS: Record<"A" | "B" | "C", J2ZoneFootprint> = {
  A: getZoneFootprint("A"),
  B: getZoneFootprint("B"),
  C: getZoneFootprint("C"),
};

/**
 * Deterministic mock status generator for J2 machines.
 */
export function getDeterministicMachineStatus(machineKey: string): {
  status: Status;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
} {
  const rng = makeRng(`j2-m-${machineKey}`);
  const r = rng();

  let status: Status = "running";
  let availability = 0;
  let performance = 0;
  let quality = 0;

  if (machineKey.includes("BOP15-LCM")) {
    status = "down";
    availability = 46.2;
    performance = 72.8;
    quality = 98.2;
  } else if (machineKey.includes("BOP15-LBC")) {
    status = "slow";
    availability = 77.0;
    performance = 77.5;
    quality = 98.9;
  } else if (machineKey.includes("BOP15-LBF15-2")) {
    status = "running";
    availability = 88.5;
    performance = 85.0;
    quality = 98.4;
  } else if (machineKey.includes("BOP15-LBF15-1")) {
    status = "running";
    availability = 92.0;
    performance = 89.5;
    quality = 98.4;
  } else if (machineKey.includes("BOP15-LBF15-3")) {
    status = "running";
    availability = 89.0;
    performance = 86.0;
    quality = 98.6;
  } else if (
    machineKey.includes("TUP01-LRP01") ||
    machineKey.includes("TUP06-LCM01") ||
    machineKey.includes("TUP08-LCM02") ||
    machineKey.includes("TUP13-LTF13") ||
    machineKey.includes("BOP01-LBF") ||
    machineKey.includes("BOP13-LSM04") ||
    machineKey.includes("EMP02-LSM07") ||
    machineKey.includes("EMP01-LEF01")
  ) {
    status = "down"; // red (< 70%)
    availability = rand(`${machineKey}-a`, 42, 58, 1);
    performance = rand(`${machineKey}-p`, 50, 68, 1);
    quality = rand(`${machineKey}-q`, 92, 98, 1);
  } else if (
    machineKey.includes("TUP04-LTF04") ||
    machineKey.includes("TUP14-CRT01") ||
    machineKey.includes("BOP12-LLM07") ||
    machineKey.includes("CUP01-LLM13") ||
    machineKey.includes("EMP03-SHR")
  ) {
    status = "slow"; // orange / warning
    availability = rand(`${machineKey}-a`, 72, 82, 1);
    performance = rand(`${machineKey}-p`, 58, 68, 1);
    quality = rand(`${machineKey}-q`, 94, 99, 1);
  } else if (
    machineKey.includes("TUP10-LTF10") ||
    machineKey.includes("POP01-LPP01") ||
    machineKey.includes("EMP17-LEF02")
  ) {
    status = "idle"; // gray / off
    availability = rand(`${machineKey}-a`, 60, 75, 1);
    performance = rand(`${machineKey}-p`, 62, 74, 1);
    quality = rand(`${machineKey}-q`, 90, 96, 1);
  } else {
    if (r > 0.88) {
      status = "slow";
      availability = rand(`${machineKey}-a`, 75, 86, 1);
      performance = rand(`${machineKey}-p`, 65, 76, 1);
      quality = rand(`${machineKey}-q`, 95, 99.5, 1);
    } else if (r > 0.8) {
      status = "down";
      availability = rand(`${machineKey}-a`, 48, 62, 1);
      performance = rand(`${machineKey}-p`, 54, 70, 1);
      quality = rand(`${machineKey}-q`, 92, 97, 1);
    } else {
      status = "running";
      availability = rand(`${machineKey}-a`, 82, 97, 1);
      performance = rand(`${machineKey}-p`, 80, 96, 1);
      quality = rand(`${machineKey}-q`, 96, 99.8, 1);
    }
  }

  const oee = Math.round(((availability * performance * quality) / 10000) * 10) / 10;

  return {
    status,
    availability,
    performance,
    quality,
    oee,
  };
}
