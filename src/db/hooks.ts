/** Hooks reativos de leitura (useLiveQuery re-renderiza quando o banco muda). */
import { useLiveQuery } from 'dexie-react-hooks';
import tenant from '../config/tenant.config';
import type { AppSettings } from '../domain/types';
import { db } from './database';
import { defaultSettings, rowsToSettings } from './fromTenant';

const DEFAULTS = defaultSettings(tenant);

/** Configurações atuais (com padrões do tenant enquanto carrega). */
export function useSettings(): AppSettings {
  return useSettingsState().settings;
}

/** Configurações + se já foram lidas do banco. */
export function useSettingsState(): { settings: AppSettings; loaded: boolean } {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  return { settings: rows ? rowsToSettings(rows, DEFAULTS) : DEFAULTS, loaded: !!rows };
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

/** Todos os dados (para telas de clientes e relatórios). */
export function useAllData() {
  return useLiveQuery(async () => {
    const [courts, customers, reservations, payments, recurrences, blocks, priceRules] = await Promise.all([
      db.courts.orderBy('order').toArray(),
      db.customers.toArray(),
      db.reservations.toArray(),
      db.payments.toArray(),
      db.recurrences.toArray(),
      db.blocks.toArray(),
      db.priceRules.toArray(),
    ]);
    return { courts, customers, reservations, payments, recurrences, blocks, priceRules };
  }, []);
}
