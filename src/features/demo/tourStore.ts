/** Estado do tour guiado (aberto/fechado), compartilhado entre a faixa de demo e o balão. */
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

export function openTour(): void {
  open = true;
  listeners.forEach((l) => l());
}

export function closeTour(): void {
  open = false;
  listeners.forEach((l) => l());
}

export function useTourOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}
