import { useSyncExternalStore } from 'react';

/** true quando a media query casa (reativo). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/** Minuto atual, atualizado a cada 60s (para esmaecer horários passados). */
let tick = Date.now();
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    tick = Date.now();
    listeners.forEach((l) => l());
  }, 60_000);
}
export function useNow(): Date {
  const t = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => tick,
    () => tick,
  );
  return new Date(t);
}
