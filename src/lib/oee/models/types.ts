import * as THREE from "three";
import type { Status } from "../config";

export type MachineStatus = Status;

export type ModelKey =
  | "filling"
  | "capping"
  | "labelling"
  | "shrink"
  | "autoSealer"
  | "cartoning"
  | "celloWrap"
  | "tubeRepack"
  | "caseSealer"
  | "blister"
  | "pouch"
  | "feeder";

export const LOD_PLANT = 0;
export const LOD_ZONE = 1;
export const LOD_LINE = 1;
export const LOD_MACHINE = 2;

export const MAX_ANIMATED_MACHINES = 12;
export const MAX_MODEL_HEIGHT = 2.4;
export const CELL_SIZE_PLANT = 1.6;
export const CELL_SIZE_ZONE = 2.4;
export const CHAIN_CELL = 3.2;
export const ORIENTATION_MODE: "match-flow" | "face-camera" = "match-flow";

export type ModelPartType = "body" | "guard" | "conveyor" | "product" | "floor" | "hmi" | "lamps";

export type ModelBuilderOptions = {
  lod?: number; // 0, 1, 2
  seed?: number;
  status?: MachineStatus;
  customColor?: number;
};

export type ModelInstance = {
  group: THREE.Group;
  setStatus: (status: MachineStatus) => void;
  update: (dt: number, t: number) => void;
  setLOD: (level: number) => void;
  getBounds: () => THREE.Box3;
  dispose: () => void;
};

export type CameraPreset = {
  th: number; // Azimuth
  ph: number; // Elevation
  dist: number; // Distance
  target: [number, number, number];
  fov: number;
  minDist: number;
  maxDist: number;
};

export const DEFAULT_CAMERA: Record<ModelKey, CameraPreset> = {
  filling: {
    th: 0.75,
    ph: 0.35,
    dist: 10.5,
    target: [0, 1.4, -0.4],
    fov: 38,
    minDist: 5,
    maxDist: 15,
  },
  capping: {
    th: 0.75,
    ph: 0.35,
    dist: 10.5,
    target: [0, 1.4, -0.4],
    fov: 38,
    minDist: 5,
    maxDist: 15,
  },
  labelling: {
    th: 0.75,
    ph: 0.42,
    dist: 9.5,
    target: [0, 1.2, -0.2],
    fov: 38,
    minDist: 5,
    maxDist: 14,
  },
  shrink: {
    th: 0.75,
    ph: 1.05,
    dist: 24,
    target: [0, 2, 0],
    fov: 45,
    minDist: 6,
    maxDist: 45,
  },
  autoSealer: {
    th: 0.75,
    ph: 1.05,
    dist: 24,
    target: [0, 2, 0],
    fov: 45,
    minDist: 6,
    maxDist: 45,
  },
  cartoning: {
    th: 0.75,
    ph: 0.35,
    dist: 11.5,
    target: [-0.2, 1.3, -0.2],
    fov: 38,
    minDist: 5,
    maxDist: 16,
  },
  celloWrap: {
    th: 0.75,
    ph: 1.05,
    dist: 26,
    target: [1, 2, 0],
    fov: 45,
    minDist: 6,
    maxDist: 45,
  },
  tubeRepack: {
    th: 0.75,
    ph: 1.0,
    dist: 32,
    target: [-1, 2, 0],
    fov: 45,
    minDist: 6,
    maxDist: 55,
  },
  caseSealer: {
    th: 0.75,
    ph: 1.05,
    dist: 27,
    target: [0, 2, 0],
    fov: 45,
    minDist: 6,
    maxDist: 55,
  },
  blister: {
    th: 0.75,
    ph: 1.05,
    dist: 32,
    target: [2, 2.4, 0],
    fov: 45,
    minDist: 6,
    maxDist: 60,
  },
  pouch: {
    th: 0.7,
    ph: 1.2,
    dist: 9.5,
    target: [0, 1.6, 0.1],
    fov: 40,
    minDist: 3,
    maxDist: 30,
  },
  feeder: {
    th: 0.85,
    ph: 1.15,
    dist: 10.5,
    target: [0.4, 0.95, 0],
    fov: 40,
    minDist: 3,
    maxDist: 30,
  },
};
