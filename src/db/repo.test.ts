import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgendaDB } from './database';
import {
  cancelReservation, ConflictError, deleteReservation, reactivateReservation, restoreReservation,
  saveBlock, saveReservation, ValidationError,
} from './repo';
import { settingsToRows, defaultSettings } from './fromTenant';
import tenant from '../config/tenant.config';
import { C1, C2, HOURS, rec } from '../test/fixtures';

let d: AgendaDB;
const TUE = '2026-09-22';

beforeEach(async () => {
  d = new AgendaDB(`repo-${Math.random()}`);
  await d.open();
  await d.courts.bulkAdd([C1, C2]);
  await d.settings.bulkPut(settingsToRows({ ...defaultSettings(tenant), openingHours: HOURS }));
  await d.customers.add({ id: 'cust1', name: 'Ana', phone: '11999990000', createdAt: '2026-09-01T00:00:00Z' });
});

afterEach(async () => {
  await d.delete();
});

const base = { courtId: 'c1', customerId: 'cust1', date: TUE, startMin: 1200, endMin: 1260, price: 12000, priceManual: false };

describe('repositório de reservas', () => {
  it('cria reserva e sinal', async () => {
    const r = await saveReservation({ ...base, deposit: { amount: 5000, method: 'pix' } }, d);
    expect((await d.reservations.get(r.id))?.status).toBe('ativa');
    const pays = await d.payments.where('reservationId').equals(r.id).toArray();
    expect(pays.map((p) => p.amount)).toEqual([5000]);
  });

  it('é IMPOSSÍVEL gravar reserva sobreposta (checagem na transação)', async () => {
    await saveReservation(base, d);
    await expect(saveReservation({ ...base, startMin: 1230, endMin: 1290 }, d)).rejects.toBeInstanceOf(ConflictError);
    expect(await d.reservations.count()).toBe(1);
  });

  it('respeita mensalista virtual, bloqueio e expediente', async () => {
    await d.recurrences.add(rec({ id: 'm', weekday: 2, startMin: 1260, endMin: 1320 }));
    await expect(saveReservation({ ...base, startMin: 1260, endMin: 1320 }, d)).rejects.toBeInstanceOf(ConflictError);
    await saveBlock({ courtIds: ['c1'], dateStart: TUE, dateEnd: TUE, startMin: 960, endMin: 1080, reason: 'Pintura' }, d);
    await expect(saveReservation({ ...base, startMin: 1020, endMin: 1080 }, d)).rejects.toBeInstanceOf(ConflictError);
    await expect(saveReservation({ ...base, startMin: 1380, endMin: 1440 }, d)).rejects.toBeInstanceOf(ConflictError);
  });

  it('editar pode manter o próprio horário e mudar a duração', async () => {
    const r = await saveReservation(base, d);
    const edited = await saveReservation({ ...base, id: r.id, endMin: 1320, price: 24000 }, d);
    expect(edited.endMin).toBe(1320);
    expect(edited.createdAt).toBe(r.createdAt);
  });

  it('cria cliente novo junto com a reserva', async () => {
    const r = await saveReservation({ ...base, customerId: undefined, newCustomer: { name: ' Bruno ', phone: '11 98888-7777' } }, d);
    const c = await d.customers.get(r.customerId);
    expect(c?.name).toBe('Bruno');
  });

  it('conflito não cria o cliente novo (atômico)', async () => {
    await saveReservation(base, d);
    await expect(saveReservation({ ...base, customerId: undefined, newCustomer: { name: 'Zé', phone: '' } }, d)).rejects.toBeInstanceOf(ConflictError);
    expect(await d.customers.count()).toBe(1);
  });

  it('cancelar libera o horário; reativar checa conflito', async () => {
    const r = await saveReservation(base, d);
    await cancelReservation(r.id, 'Chuva', d);
    const other = await saveReservation(base, d);
    expect(other.id).not.toBe(r.id);
    await expect(reactivateReservation(r.id, d)).rejects.toBeInstanceOf(ConflictError);
  });

  it('excluir vai para a lixeira e restaurar checa conflito', async () => {
    const r = await saveReservation(base, d);
    await deleteReservation(r.id, d);
    expect((await d.reservations.get(r.id))?.deletedAt).toBeTruthy();
    await saveReservation(base, d);
    await expect(restoreReservation(r.id, d)).rejects.toBeInstanceOf(ConflictError);
  });

  it('valida entradas', async () => {
    await expect(saveReservation({ ...base, endMin: 1200 }, d)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveReservation({ ...base, customerId: undefined }, d)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveBlock({ courtIds: [], dateStart: TUE, dateEnd: TUE, reason: 'x' }, d)).rejects.toBeInstanceOf(ValidationError);
  });
});
