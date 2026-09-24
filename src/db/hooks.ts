/** Hooks reativos de leitura (useLiveQuery re-renderiza quando o banco muda). */
import { useLiveQuery } from 'dexie-react-hooks';
import tenant from '../config/tenant.config';
import type { AppSettings } from '../domain/types';
import { db } from './database';
import { defaultSettings, rowsToSettings } from './fromTenant';

const DEFAULTS = defaultSettings(tenant);

/** Configurações atuais (com padrões do tenant enquanto carrega). */
export function useSettings(): AppSettings {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  return rows ? rowsToSettings(rows, DEFAULTS) : DEFAULTS;
}

export function useCourts() {
  return useLiveQuery(() => db.courts.orderBy('order').toArray(), []) ?? [];
}

export function useCounts() {
  return useLiveQuery(async () => ({
    reservations: await db.reservations.filter((r) => !r.deletedAt).count(),
    customers: await db.customers.filter((c) => !c.deletedAt).count(),
    recurrences: await db.recurrences.count(),
    payments: await db.payments.count(),
  }), []);
}
