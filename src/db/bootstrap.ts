/**
 * Inicialização do banco na abertura do app.
 *  - Banco vazio + demo: gera os dados de exemplo.
 *  - Banco vazio + cliente real: grava só as configurações do tenant (o onboarding cuida do resto).
 */
import tenant from '../config/tenant.config';
import type { AppSettings, DataSet } from '../domain/types';
import { newId } from '../utils/id';
import { db, DATA_TABLES, type AgendaDB } from './database';
import { defaultSettings, rowsToSettings, settingsToRows, tenantEntities } from './fromTenant';
import { generateSeed } from './seed';

export async function readAllData(database: AgendaDB = db): Promise<DataSet> {
  return database.transaction('r', DATA_TABLES.map((t) => database.table(t)), async () => ({
    courts: await database.courts.toArray(),
    customers: await database.customers.toArray(),
    reservations: await database.reservations.toArray(),
    payments: await database.payments.toArray(),
    recurrences: await database.recurrences.toArray(),
    blocks: await database.blocks.toArray(),
    priceRules: await database.priceRules.toArray(),
    settings: await database.settings.toArray(),
  }));
}

/** Substitui TODOS os dados (atômico: ou grava tudo, ou nada). */
export async function replaceAllData(data: DataSet, database: AgendaDB = db): Promise<void> {
  await database.transaction('rw', DATA_TABLES.map((t) => database.table(t)), async () => {
    for (const t of DATA_TABLES) await database.table(t).clear();
    await database.courts.bulkAdd(data.courts);
    await database.customers.bulkAdd(data.customers);
    await database.reservations.bulkAdd(data.reservations);
    await database.payments.bulkAdd(data.payments);
    await database.recurrences.bulkAdd(data.recurrences);
    await database.blocks.bulkAdd(data.blocks);
    await database.priceRules.bulkAdd(data.priceRules);
    await database.settings.bulkPut(data.settings);
  });
}

export async function loadSettings(database: AgendaDB = db): Promise<AppSettings> {
  return rowsToSettings(await database.settings.toArray(), defaultSettings(tenant));
}

export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K], database: AgendaDB = db): Promise<void> {
  await database.settings.put({ key, value });
}

export function buildDemoData(now = new Date()): DataSet {
  return generateSeed({ tenant, now, idFn: newId });
}

/** Garante que o banco está pronto. Idempotente. */
export async function bootstrapDatabase(database: AgendaDB = db): Promise<{ seeded: boolean }> {
  await database.open();
  const hasSettings = (await database.settings.count()) > 0;
  const hasCourts = (await database.courts.count()) > 0;
  if (hasSettings || hasCourts) return { seeded: false };

  if (tenant.demo) {
    await replaceAllData(buildDemoData(), database);
    return { seeded: true };
  }

  // Cliente real: grava configurações e quadras/preços do tenant como ponto de partida.
  const { courts, priceRules } = tenantEntities(tenant, newId);
  await database.transaction('rw', [database.settings, database.courts, database.priceRules], async () => {
    await database.settings.bulkPut(settingsToRows(defaultSettings(tenant)));
    await database.courts.bulkAdd(courts);
    await database.priceRules.bulkAdd(priceRules);
  });
  return { seeded: false };
}
