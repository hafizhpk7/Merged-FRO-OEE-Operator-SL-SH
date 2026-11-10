/** Expanded / collapsed state of the operator sidebar (per tab). Collapsed = icon rail, like the old FRO MES. */
import { useSyncExternalStore } from "react";

const KEY = "fro_op_sidebar_collapsed";
const listeners = new Set<() => void>();
let collapsed: boolean | undefined;

function read(): boolean {
  if (collapsed !== undefined) return collapsed;
  let v = true;
  if (typeof window !== "undefined") {
    try {
      v = sessionStorage.getItem(KEY) !== "0";
    } catch {
      v = true;
    }
  }
  collapsed = v;
  return v;
}

export const operatorSidebarStore = {
  get: read,
  toggle() {
    collapsed = !read();
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(KEY, collapsed ? "1" : "0");
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

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(operatorSidebarStore.subscribe, read, () => true);
}

/** Sidebar widths in px (rail and expanded). */
export const SIDEBAR_RAIL_PX = 69;
export const SIDEBAR_WIDE_PX = 240;
