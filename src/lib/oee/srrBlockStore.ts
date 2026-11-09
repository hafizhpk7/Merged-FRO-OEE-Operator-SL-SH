/** Open state of the "SRR Line belum diterapkan" modal (shown when the Reason tab is blocked). */
import { useSyncExternalStore } from "react";

let isOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const srrBlockStore = {
  open() {
    isOpen = true;
    emit();
  },
  close() {
    isOpen = false;
    emit();
  },
  get: () => isOpen,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useSrrBlockOpen(): boolean {
  return useSyncExternalStore(srrBlockStore.subscribe, srrBlockStore.get, () => false);
}
