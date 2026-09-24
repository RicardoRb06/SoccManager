import { afterEach, describe, expect, it } from 'vitest';
import { AgendaDB, DB_NAME } from './database';
import { bootstrapDatabase, readAllData, replaceAllData } from './bootstrap';
import tenant from '../config/tenant.config';

const dbs: AgendaDB[] = [];
function freshDb(): AgendaDB {
  const d = new AgendaDB(`test-${Math.random()}`);
  dbs.push(d);
  return d;
}

afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete();
});

describe('banco local', () => {
  it('nome do banco é fixo por tenant', () => {
    expect(DB_NAME).toBe(`agenda-quadra-${tenant.tenantId}`);
  });

  it('primeira abertura em modo demo popula os dados; segunda não duplica', async () => {
    const d = freshDb();
    const first = await bootstrapDatabase(d);
    expect(first.seeded).toBe(tenant.demo);
    const count = await d.reservations.count();
    const again = await bootstrapDatabase(d);
    expect(again.seeded).toBe(false);
    expect(await d.reservations.count()).toBe(count);
  });

  it('dados sobrevivem a fechar e reabrir o banco', async () => {
    const name = `test-reopen-${Math.random()}`;
    const a = new AgendaDB(name);
    await bootstrapDatabase(a);
    const before = await readAllData(a);
    a.close();
    const b = new AgendaDB(name);
    dbs.push(b);
    const after = await readAllData(b);
    expect(after).toEqual(before);
  });

  it('substituir tudo é atômico e fiel', async () => {
    const src = freshDb();
    await bootstrapDatabase(src);
    const data = await readAllData(src);
    const dst = freshDb();
    await replaceAllData(data, dst);
    const copy = await readAllData(dst);
    const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((x, y) => x.id.localeCompare(y.id));
    expect(byId(copy.reservations)).toEqual(byId(data.reservations));
    expect(byId(copy.payments)).toEqual(byId(data.payments));
    expect(copy.settings.length).toBe(data.settings.length);
  });

  it('falha no meio da substituição não altera nada', async () => {
    const d = freshDb();
    await bootstrapDatabase(d);
    const before = await readAllData(d);
    const broken = { ...before, customers: [...before.customers, before.customers[0]!] }; // id duplicado → bulkAdd falha
    await expect(replaceAllData(broken, d)).rejects.toBeTruthy();
    const after = await readAllData(d);
    expect(after.reservations.length).toBe(before.reservations.length);
    expect(after.customers.length).toBe(before.customers.length);
  });
});
