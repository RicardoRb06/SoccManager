/**
 * Backup externo (arquivo JSON), importação segura e cópias internas (snapshots).
 *
 * Importar:
 *   1. lê e valida o arquivo (JSON + Zod) SEM tocar no banco;
 *   2. migra backups de versões anteriores (db/migrations.ts);
 *   3. mostra a prévia (contagens, data do backup) e pede confirmação;
 *   4. cria uma cópia interna do estado atual ("antes de importar");
 *   5. substitui tudo numa única transação (se falhar, nada muda).
 */
import { z } from 'zod';
import tenant from '../config/tenant.config';
import type { AppSettings, DataSet } from '../domain/types';
import { newId } from '../utils/id';
import { db, type AgendaDB, type Snapshot } from './database';
import { buildDemoData, readAllData, replaceAllData } from './bootstrap';
import { SCHEMA_VERSION } from './fromTenant';
import { migrateData } from './migrations';

export const BACKUP_FORMAT = 'agenda-quadra-backup';
export const MAX_SNAPSHOTS = 5;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  tenantId: string;
  exportedAt: string;
  data: DataSet;
}

export type BackupCounts = Record<'reservas' | 'clientes' | 'mensalistas' | 'pagamentos' | 'quadras' | 'bloqueios', number>;

// ------------------------------------------------------------------ validação (Zod)

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const minutes = z.number().int().min(0).max(1440);
const cents = z.number().int();
const id = z.string().min(1);

const courtSchema = z.object({ id, name: z.string(), modality: z.string(), active: z.boolean(), order: z.number() }).passthrough();
const customerSchema = z.object({ id, name: z.string(), phone: z.string(), createdAt: z.string() }).passthrough();
const reservationSchema = z
  .object({
    id, courtId: id, customerId: id, date: isoDate, startMin: minutes, endMin: minutes, price: cents,
    status: z.enum(['ativa', 'cancelada', 'falta']), createdAt: z.string(), updatedAt: z.string(),
  })
  .passthrough();
const paymentSchema = z.object({ id, amount: cents, method: z.enum(['pix', 'dinheiro', 'cartao', 'outro']), paidAt: z.string() }).passthrough();
const recurrenceSchema = z
  .object({
    id, courtId: id, customerId: id, weekday: z.number().int().min(0).max(6), startMin: minutes, endMin: minutes, startDate: isoDate,
    status: z.enum(['ativo', 'pausado', 'encerrado']), billingMode: z.enum(['por_jogo', 'mensal']), skipDates: z.array(isoDate),
  })
  .passthrough();
const blockSchema = z.object({ id, courtIds: z.array(id), dateStart: isoDate, dateEnd: isoDate, reason: z.string() }).passthrough();
const priceRuleSchema = z.object({ id, courtId: z.string(), weekdays: z.array(z.number().int()), startMin: minutes, endMin: minutes, price: cents }).passthrough();
const settingSchema = z.object({ key: z.string(), value: z.unknown() });

const dataSchema = z.object({
  courts: z.array(courtSchema),
  customers: z.array(customerSchema),
  reservations: z.array(reservationSchema),
  payments: z.array(paymentSchema),
  recurrences: z.array(recurrenceSchema),
  blocks: z.array(blockSchema),
  priceRules: z.array(priceRuleSchema),
  settings: z.array(settingSchema),
});

const envelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().min(0),
  appVersion: z.string().optional(),
  tenantId: z.string(),
  exportedAt: z.string(),
  data: z.record(z.unknown()),
});

export type ParseResult =
  | { ok: true; backup: BackupFile; counts: BackupCounts; otherTenant: boolean; migratedFrom?: number }
  | { ok: false; error: string };

export function countsOf(data: DataSet): BackupCounts {
  return {
    reservas: data.reservations.filter((r) => !r.deletedAt).length,
    clientes: data.customers.filter((c) => !c.deletedAt).length,
    mensalistas: data.recurrences.length,
    pagamentos: data.payments.length,
    quadras: data.courts.length,
    bloqueios: data.blocks.length,
  };
}

/** Lê e valida um arquivo de backup. Nunca altera o banco. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, error: 'O arquivo não é um backup válido (não é um JSON).' };
  }
  const env = envelopeSchema.safeParse(raw);
  if (!env.success) return { ok: false, error: 'Este arquivo não é um backup da Agenda da Quadra.' };
  let migrated: Record<string, unknown>;
  try {
    migrated = migrateData(env.data.data, env.data.schemaVersion);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Não foi possível converter este backup.' };
  }
  const data = dataSchema.safeParse(migrated);
  if (!data.success) {
    const issue = data.error.issues[0];
    return { ok: false, error: `Backup incompleto ou corrompido${issue ? ` (${issue.path.join('.')})` : ''}. Nada foi alterado.` };
  }
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: env.data.appVersion ?? '?',
    tenantId: env.data.tenantId,
    exportedAt: env.data.exportedAt,
    data: data.data as unknown as DataSet,
  };
  return {
    ok: true,
    backup,
    counts: countsOf(backup.data),
    otherTenant: env.data.tenantId !== tenant.tenantId,
    ...(env.data.schemaVersion !== SCHEMA_VERSION ? { migratedFrom: env.data.schemaVersion } : {}),
  };
}

// ------------------------------------------------------------------ exportar

export async function buildBackup(database: AgendaDB = db, now = new Date()): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    tenantId: tenant.tenantId,
    exportedAt: now.toISOString(),
    data: await readAllData(database),
  };
}

export function backupFileName(slug: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `backup-${slug}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** Registra que um backup externo foi salvo agora. */
export async function markBackupDone(database: AgendaDB = db, now = new Date()): Promise<void> {
  await database.settings.put({ key: 'lastBackupAt', value: now.toISOString() });
}

// ------------------------------------------------------------------ cópias internas

export async function createSnapshot(reason: Snapshot['reason'], database: AgendaDB = db, now = new Date()): Promise<Snapshot> {
  const data = await readAllData(database);
  const snap: Snapshot = { id: newId(), createdAt: now.toISOString(), reason, schemaVersion: SCHEMA_VERSION, counts: countsOf(data), data };
  await database.transaction('rw', database.snapshots, async () => {
    await database.snapshots.add(snap);
    const all = await database.snapshots.orderBy('createdAt').toArray();
    const extra = all.length - MAX_SNAPSHOTS;
    if (extra > 0) await database.snapshots.bulkDelete(all.slice(0, extra).map((s) => s.id));
  });
  return snap;
}

export async function listSnapshots(database: AgendaDB = db): Promise<Snapshot[]> {
  return (await database.snapshots.orderBy('createdAt').reverse().toArray());
}

/** Cópia automática na primeira abertura do dia. Retorna true se criou. */
export async function dailySnapshot(today: string, database: AgendaDB = db, now = new Date()): Promise<boolean> {
  const row = await database.settings.get('lastSnapshotDate');
  if (row?.value === today) return false;
  const hasData = (await database.courts.count()) > 0;
  if (!hasData) return false;
  await createSnapshot('diario', database, now);
  await database.settings.put({ key: 'lastSnapshotDate', value: today });
  return true;
}

/** Substitui tudo pelo backup, guardando antes uma cópia interna do estado atual. */
export async function importBackup(backup: BackupFile, database: AgendaDB = db): Promise<Snapshot> {
  const before = await createSnapshot('antes-de-importar', database);
  await replaceAllData(backup.data, database);
  return before;
}

/** Restaura uma cópia interna (guardando antes o estado atual). */
export async function restoreSnapshot(id: string, database: AgendaDB = db): Promise<void> {
  const snap = await database.snapshots.get(id);
  if (!snap) throw new Error('Cópia não encontrada.');
  const data = migrateData(snap.data as unknown as Record<string, unknown>, snap.schemaVersion) as unknown as DataSet;
  await createSnapshot('antes-de-restaurar', database);
  await replaceAllData(data, database);
}

/** Chaves de configuração do aparelho que continuam valendo depois de trocar os dados. */
const DEVICE_KEYS: (keyof AppSettings)[] = ['persistRequested', 'lastSnapshotDate'];

/**
 * Demonstração: volta aos dados de exemplo (gerados a partir de hoje),
 * guardando antes uma cópia interna do estado atual para poder desfazer.
 */
export async function restoreDemoData(database: AgendaDB = db, now = new Date()): Promise<Snapshot> {
  const before = await createSnapshot('antes-de-restaurar-exemplo', database, now);
  const keep = (await database.settings.bulkGet(DEVICE_KEYS)).filter((r): r is NonNullable<typeof r> => !!r);
  const data = buildDemoData(now);
  await replaceAllData({ ...data, settings: [...data.settings.filter((r) => !DEVICE_KEYS.includes(r.key)), ...keep] }, database);
  return before;
}
