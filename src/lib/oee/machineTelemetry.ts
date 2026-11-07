/**
 * Real-time Machine Operational Parameters & Telemetry.
 * Preserves all sensor readings with configured Bands, Watch thresholds,
 * and deterministic live fluctuation tied to the timeline snapshot.
 */

import type { ShiftSnapshot } from "./machineEvents";

export interface ParameterReading {
  key: string;
  name: string;
  group: "Temperature" | "Pressure" | "Drive & Throughput";
  current: number;
  unit: string;
  band: string;
  status: "Normal" | "Watch";
  isOverLimit: boolean;
}

export interface TelemetryGroup {
  groupName: "Temperature" | "Pressure" | "Drive & Throughput";
  readings: ParameterReading[];
}

export function getOperationalParameters(
  machineCode: string,
  snapshot: ShiftSnapshot,
  tickSec: number,
): TelemetryGroup[] {
  // Deterministic oscillation based on machine code + tick time
  const seed =
    (machineCode.charCodeAt(0) * 17 + machineCode.charCodeAt(machineCode.length - 1) * 31) % 100;
  const sin1 = Math.sin(tickSec * 0.4 + seed);
  const sin2 = Math.cos(tickSec * 0.7 + seed);

  const isDown = snapshot.status.state === "down";
  const isSlow = snapshot.status.state === "slow";

  // Current speed in ppm from snapshot / timeline
  const currentSpeed = isDown
    ? 0
    : isSlow
      ? Math.round(snapshot.idealRatePpm * 0.78 + sin1 * 2)
      : Math.round(snapshot.idealRatePpm - 1 + sin1 * 3);

  // Group 1: Temperature (°C)
  const tempReadings: ParameterReading[] = [
    {
      key: "temp_motor",
      name: "Motor winding",
      group: "Temperature",
      current: parseFloat((56.5 + sin1 * 0.8).toFixed(1)),
      unit: "°C",
      band: "40–60 °C",
      status: 56.5 + sin1 * 0.8 > 60 ? "Watch" : "Normal",
      isOverLimit: 56.5 + sin1 * 0.8 > 60,
    },
    {
      key: "temp_bearing",
      name: "Bearing",
      group: "Temperature",
      current: parseFloat((39.9 + sin2 * 0.5).toFixed(1)),
      unit: "°C",
      band: "25–45 °C",
      status: 39.9 + sin2 * 0.5 > 45 ? "Watch" : "Normal",
      isOverLimit: 39.9 + sin2 * 0.5 > 45,
    },
    {
      key: "temp_gearbox",
      name: "Gearbox oil",
      group: "Temperature",
      current: parseFloat((67.6 + sin1 * 0.4).toFixed(1)), // Over limit (> 65°C) to keep existing red highlight
      unit: "°C",
      band: "≤ 65 °C",
      status: "Watch",
      isOverLimit: true,
    },
  ];

  // Group 2: Pressure (bar)
  const pressureReadings: ParameterReading[] = [
    {
      key: "press_nozzle",
      name: "Fill nozzle",
      group: "Pressure",
      current: parseFloat((isDown ? 0.0 : 1.95 + sin2 * 0.04).toFixed(2)),
      unit: "bar",
      band: "1.8–2.2 bar",
      status: isDown ? "Watch" : "Normal",
      isOverLimit: isDown,
    },
    {
      key: "press_air",
      name: "Air supply",
      group: "Pressure",
      current: parseFloat((5.54 + sin1 * 0.08).toFixed(2)),
      unit: "bar",
      band: "5.0–6.5 bar",
      status: 5.54 + sin1 * 0.08 < 5.0 ? "Watch" : "Normal",
      isOverLimit: 5.54 + sin1 * 0.08 < 5.0,
    },
  ];

  // Group 3: Drive & Throughput
  const currentAmp = isDown ? 1.2 : isSlow ? 11.4 : parseFloat((16.8 + sin1 * 0.3).toFixed(1));
  const utilisedPct = isDown ? 0 : Math.round(snapshot.availability ?? 62);

  const driveReadings: ParameterReading[] = [
    {
      key: "drive_current",
      name: "Bottle current",
      group: "Drive & Throughput",
      current: currentAmp,
      unit: "A",
      band: "10–20 A",
      status: "Normal",
      isOverLimit: false,
    },
    {
      key: "drive_speed",
      name: "Line speed",
      group: "Drive & Throughput",
      current: currentSpeed,
      unit: "ppm",
      band: `Std ${snapshot.idealRatePpm} ppm`,
      status: isSlow || isDown ? "Watch" : "Normal",
      isOverLimit: isSlow || isDown,
    },
    {
      key: "drive_cycle",
      name: "Cycle count",
      group: "Drive & Throughput",
      current: snapshot.totalOutput,
      unit: "pcs",
      band: `Plan ${snapshot.planUnits.toLocaleString()}`,
      status: "Normal",
      isOverLimit: false,
    },
    {
      key: "drive_rejects",
      name: "Reject count",
      group: "Drive & Throughput",
      current: snapshot.rejects,
      unit: "pcs",
      band: "≤ 2.0%",
      status: snapshot.rejectRatePct > 2.0 ? "Watch" : "Normal",
      isOverLimit: snapshot.rejectRatePct > 2.0,
    },
    {
      key: "drive_utilised",
      name: "Utilised",
      group: "Drive & Throughput",
      current: utilisedPct,
      unit: "%",
      band: "≥ 75%",
      status: utilisedPct < 75 ? "Watch" : "Normal",
      isOverLimit: utilisedPct < 75,
    },
  ];

  return [
    { groupName: "Temperature", readings: tempReadings },
    { groupName: "Pressure", readings: pressureReadings },
    { groupName: "Drive & Throughput", readings: driveReadings },
  ];
}
