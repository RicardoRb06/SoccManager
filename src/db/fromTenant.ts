/**
 * Converte o tenant.config em entidades/configurações iniciais do banco.
 * Puro (sem Dexie) para poder ser testado.
 */
import type { TenantConfig } from '../config/types';
import type { AppSettings, Court, PriceRule, SettingRow } from '../domain/types';
import { hhmmToMin } from '../domain/time';
import { reaisToCents } from '../domain/money';
import { ALL_COURTS } from '../domain/pricing';

export const SCHEMA_VERSION = 1;

export function defaultSettings(t: TenantConfig): AppSettings {
  return {
    courtName: t.courtName,
    shortName: t.shortName,
    logo: t.logo ?? '',
    primaryColor: t.colors.primary,
    accentColor: t.colors.accent,
    courtPhone: t.courtPhone ?? '',
    openingHours: t.openingHours,
    slotMinutes: t.slotMinutes,
    weekStartsOn: t.weekStartsOn,
    backupReminderDays: t.backupReminderDays,
    lastBackupAt: null,
    onboardingDone: t.demo,
    tourDone: false,
    seededAt: null,
    lastSnapshotDate: null,
    persistRequested: false,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function settingsToRows(s: AppSettings): SettingRow[] {
  return (Object.keys(s) as Array<keyof AppSettings>).map((key) => ({ key, value: s[key] }) as SettingRow);
}

export function rowsToSettings(rows: SettingRow[], defaults: AppSettings): AppSettings {
  const out: AppSettings = { ...defaults };
  for (const row of rows) {
    if (row.key in out) (out as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  // compatibilidade: bancos criados antes guardavam o telefone como "courtWhatsApp"
  const legacyPhone = rows.find((r) => (r.key as string) === 'courtWhatsApp')?.value;
  if (!out.courtPhone && typeof legacyPhone === 'string') out.courtPhone = legacyPhone;
  return out;
}

export interface TenantEntities {
  courts: Court[];
  priceRules: PriceRule[];
  /** key do tenant -> id gerado */
  courtIdByKey: Map<string, string>;
}

export function tenantEntities(t: TenantConfig, idFn: () => string): TenantEntities {
  const courtIdByKey = new Map<string, string>();
  const courts: Court[] = t.courts.map((c, i) => {
    const id = idFn();
    courtIdByKey.set(c.key, id);
    return {
      id,
      name: c.name,
      modality: c.modality,
      active: true,
      order: i,
      ...(c.sharedSpaceGroup ? { sharedSpaceGroup: c.sharedSpaceGroup } : {}),
    };
  });
  const priceRules: PriceRule[] = t.priceRules.map((r) => {
    const courtId = r.court === ALL_COURTS ? ALL_COURTS : courtIdByKey.get(r.court);
    if (!courtId) throw new Error(`tenant.config: regra de preço aponta para quadra inexistente "${r.court}"`);
    return {
      id: idFn(),
      courtId,
      weekdays: [...r.weekdays],
      startMin: hhmmToMin(r.start),
      endMin: hhmmToMin(r.end),
      price: reaisToCents(r.pricePerHour),
    };
  });
  return { courts, priceRules, courtIdByKey };
}
