import { LBF15_3, LBF15_2, LBF15_1, LBC, LCM } from "./bop15ChainSpriteData";

export interface LampMeta {
  color: "red" | "amber" | "green";
  center: [number, number]; // Normalized 0..1
  radius: number; // Normalized to image width
}

export interface MachineMeta {
  xStartMetres: number;
  xEndMetres: number;
  hitPolygon: [number, number][]; // Normalized 0..1
  lamps: LampMeta[];
}

export const BOP15_CHAIN_SPRITE = {
  imageWidth: 1800,
  imageHeight: 1523,
  pxPerMetreHorizontalAxis: 189.156,
  axisStartFloorPoint: [0.0878, 0.28823] as [number, number],
  axisEndFloorPoint: [0.92324, 0.93523] as [number, number],
  machines: {
    "BOP15-LCM": LCM,
    "BOP15-LBC": LBC,
    "BOP15-LBF15-1": LBF15_1,
    "BOP15-LBF15-2": LBF15_2,
    "BOP15-LBF15-3": LBF15_3,
  } as Record<string, MachineMeta>,
};
