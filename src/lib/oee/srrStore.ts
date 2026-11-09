/**
 * CR 5 SR-01/SR-02: the universal SRR switch. One choice for Process Order Performance, Shift
 * Performance, the hourly page and the OEE card. It changes the standard only, never the actual.
 */
import { useSyncExternalStore } from "react";
import type { SrrMode } from "./targetEngine";

export const SRR_DEFAULT_MODE: SrrMode = "LINE";
const KEY = "fro_srr_mode";
const listeners = new Set<() => void>();
let current: SrrMode | undefined;

function read(): SrrMode {
  if (current) return current;
  let v: SrrMode = SRR_DEFAULT_MODE;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === "LINE" || raw === "SKU") v = raw;
    } catch {
      // ignore: default applies
    }
  }
  current = v;
  return v;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      current = undefined;
      listeners.forEach((l) => l());
    }
  });
}

export const srrStore = {
  get(): SrrMode {
    return read();
  },
  set(mode: SrrMode) {
    current = mode;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(KEY, mode);
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

export function useSrrMode(): SrrMode {
  return useSyncExternalStore(srrStore.subscribe, srrStore.get, () => SRR_DEFAULT_MODE);
}
