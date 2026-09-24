import { afterEach, describe, expect, it } from 'vitest';
import { AgendaDB } from './database';
import { bootstrapDatabase, readAllData } from './bootstrap';
import {
  backupFileName, buildBackup, createSnapshot, dailySnapshot, importBackup, listSnapshots, MAX_SNAPSHOTS, parseBackup, restoreSnapshot, restoreDemoData,
} from './backup';
import { saveReservation } from './repo';
import tenant from '../config/tenant.config';
import type { DataSet } from '../domain/types';

const dbs: AgendaDB[] = [];
function freshDb(): AgendaDB {
  const d = new AgendaDB(`bk-${Math.random()}`);
  dbs.push(d);
  return d;
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete();
});

const sortById = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
function normalize(d: DataSet) {
  return {
    courts: sortById(d.courts), customers: sortById(d.customers), reservations: sortById(d.reservations), payments: sortById(d.payments),
    recurrences: sortById(d.recurrences), blocks: sortById(d.blocks), priceRules: sortById(d.priceRules),
    settings: [...d.settings].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

describe('backup e restauração (testes obrigatórios)', () => {
  it('exportar → limpar banco → importar → dados idênticos', async () => {
    const a = freshDb();
    await bootstrapDatabase(a);
    const original = await readAllData(a);
    const text = JSON.stringify(await buildBackup(a));

    // "limpar" = aparelho novo, banco vazio
    const b = freshDb();
    await b.open();
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.counts.reservas).toBe(original.reservations.filter((r) => !r.deletedAt).length);
    await importBackup(parsed.backup, b);
    expect(normalize(await readAllData(b))).toEqual(normalize(original));
  });

  it('importa backup de formato antigo (versão 0, sem skipDates) via migração', async () => {
    const a = freshDb();
    await bootstrapDatabase(a);
    const bk = await buildBackup(a);
    const old = JSON.parse(JSON.stringify(bk));
    old.schemaVersion = 0;
    for (const r of old.data.recurrences) delete r.skipDates;
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(0);
    expect(parsed.backup.data.recurrences.every((r) => Array.isArray(r.skipDates))).toBe(true);
  });

  it('recusa arquivo inválido sem alterar nada', async () => {
    const a = freshDb();
    await bootstrapDatabase(a);
    const before = await readAllData(a);
    for (const bad of ['não é json', '{"x":1}', JSON.stringify({ format: 'agenda-quadra-backup', schemaVersion: 1, tenantId: 't', exportedAt: 'x', data: { courts: 'errado' } })]) {
      const parsed = parseBackup(bad);
      expect(parsed.ok).toBe(false);
    }
    const bk = await buildBackup(a);
    const broken = JSON.parse(JSON.stringify(bk));
    broken.data.reservations[0].startMin = 'vinte';
    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false);
    const future = { ...bk, schemaVersion: 99 };
    const r = parseBackup(JSON.stringify(future));
    expect(r.ok).toBe(false);
    expect(normalize(await readAllData(a))).toEqual(normalize(before));
  });

  it('importar guarda uma cópia interna do estado anterior (dá para desfazer)', async () => {
    const a = freshDb();
    await bootstrapDatabase(a);
    const courts = await a.courts.toArray();
    await a.customers.add({ id: 'extra', name: 'Extra', phone: '', createdAt: '2026-01-01T00:00:00Z' });
    const mine = await readAllData(a);
    await saveReservation({ courtId: courts[0]!.id, customerId: 'extra', date: '2031-01-07', startMin: 960, endMin: 1020, price: 1, priceManual: true }, a);
    const withMine = await readAllData(a);

    const other = freshDb();
    await bootstrapDatabase(other);
    const bk = await buildBackup(other);
    const snap = await importBackup(bk, a);
    expect((await a.customers.get('extra'))).toBeUndefined();
    await restoreSnapshot(snap.id, a);
    expect(normalize(await readAllData(a))).toEqual(normalize(withMine));
    expect(mine.customers.length).toBeGreaterThan(0);
  });

  it('cópias internas: uma por dia e no máximo 5', async () => {
    const a = freshDb();
    await bootstrapDatabase(a);
    expect(await dailySnapshot('2026-09-24', a)).toBe(true);
    expect(await dailySnapshot('2026-09-24', a)).toBe(false);
    for (let i = 0; i < 7; i++) await createSnapshot('manual', a, new Date(2026, 8, 25 + i));
    const list = await listSnapshots(a);
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    expect(list[0]!.createdAt > list[4]!.createdAt).toBe(true);
  });

  it('nome do arquivo', () => {
    expect(backupFileName('arena-modelo', new Date(2026, 8, 4, 7, 5))).toBe('backup-arena-modelo-2026-09-04-0705.json');
    expect(tenant.tenantId).toBeTruthy();
  });
});

describe('restaurar dados de exemplo (demonstração)', () => {
  it('volta ao estado de exemplo, guarda cópia antes e mantém as chaves do aparelho', async () => {
    const a = freshDb();
    await bootstrapDatabase(a);
    const seedCount = await a.reservations.count();
    await a.customers.clear();
    await a.reservations.clear();
    await a.settings.put({ key: 'persistRequested', value: true });

    const before = await restoreDemoData(a);
    expect(before.reason).toBe('antes-de-restaurar-exemplo');
    expect(before.counts.reservas).toBe(0);
    expect(await a.reservations.count()).toBe(seedCount);
    expect((await a.customers.count()) > 0).toBe(true);
    expect((await a.settings.get('persistRequested'))?.value).toBe(true);

    // dá para desfazer pela cópia interna
    await restoreSnapshot(before.id, a);
    expect(await a.reservations.count()).toBe(0);
  });
});
