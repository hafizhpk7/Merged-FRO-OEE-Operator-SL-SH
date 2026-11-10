/**
 * Which Main Dashboard the operator Dashboard tab shows: "old" (legacy FRO view) or "new" (CR design).
 * Per tab (sessionStorage key `fro_dashboard_version`). It is not part of "reset overrides".
 */
import { useSyncExternalStore } from "react";
import { DASHBOARD_VERSION_DEFAULT } from "./config";

export type DashboardVersion = "old" | "new";
const KEY = "fro_dashboard_version";
const listeners = new Set<() => void>();
let current: DashboardVersion | undefined;

function read(): DashboardVersion {
  if (current) return current;
  let v: DashboardVersion = DASHBOARD_VERSION_DEFAULT;
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw === "old" || raw === "new") v = raw;
    } catch {
      // default applies
    }
  }
  current = v;
  return v;
}

export const dashboardVersionStore = {
  get: read,
  set(v: DashboardVersion) {
    current = v;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(KEY, v);
      } catch {
        // ignore
      }
    }
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useDashboardVersion(): DashboardVersion {
  return useSyncExternalStore(dashboardVersionStore.subscribe, read, () => DASHBOARD_VERSION_DEFAULT);
}

declare global {
  interface Window {
    /** Dev helper: set the Main Dashboard version ("old" | "new"). */
    setDashboardVersion?: (v: DashboardVersion) => void;
  }
}
if (typeof window !== "undefined") window.setDashboardVersion = (v) => dashboardVersionStore.set(v);
