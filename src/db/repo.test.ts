import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgendaDB } from './database';
import {
  addPayment, cancelReservation, ConflictError, deleteCustomer, deleteReservation, payBalance, reactivateReservation,
  restoreCustomer, restoreReservation, saveBlock, saveReservation, setFalta, updateCustomer, ValidationError,
  createRecurrence, endRecurrenceRepo, materializeRecurrenceDate, pauseRecurrenceRepo, RecurrenceConflictError,
  rescheduleOccurrence, resumeRecurrenceRepo, skipRecurrenceDate, unskipRecurrenceDate,
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

describe('pagamentos, falta e clientes', () => {
  it('registra pagamento parcial e quita o saldo', async () => {
    const r = await saveReservation(base, d);
    await addPayment({ reservationId: r.id, amount: 5000, method: 'pix' }, d);
    expect(await payBalance(r.id, 'dinheiro', d)).toBe(7000);
    await expect(payBalance(r.id, 'pix', d)).rejects.toBeInstanceOf(ValidationError);
    const total = (await d.payments.where('reservationId').equals(r.id).toArray()).reduce((a, p) => a + p.amount, 0);
    expect(total).toBe(12000);
  });

  it('recusa pagamento zerado ou sem referência', async () => {
    await expect(addPayment({ amount: 0, method: 'pix', reservationId: 'x' }, d)).rejects.toBeInstanceOf(ValidationError);
    await expect(addPayment({ amount: 100, method: 'pix' }, d)).rejects.toBeInstanceOf(ValidationError);
  });

  it('marca e desmarca falta (falta continua ocupando)', async () => {
    const r = await saveReservation(base, d);
    await setFalta(r.id, true, d);
    expect((await d.reservations.get(r.id))?.status).toBe('falta');
    await expect(saveReservation(base, d)).rejects.toBeInstanceOf(ConflictError);
    await setFalta(r.id, false, d);
    expect((await d.reservations.get(r.id))?.status).toBe('ativa');
  });

  it('edita, exclui (lixeira) e restaura cliente', async () => {
    await updateCustomer('cust1', { name: 'Ana Paula', phone: '11 3333-4444', notes: ' VIP ' }, d);
    expect(await d.customers.get('cust1')).toMatchObject({ name: 'Ana Paula', notes: 'VIP' });
    await deleteCustomer('cust1', d);
    expect((await d.customers.get('cust1'))?.deletedAt).toBeTruthy();
    await restoreCustomer('cust1', d);
    expect((await d.customers.get('cust1'))?.deletedAt).toBeUndefined();
  });
});

describe('mensalistas no banco', () => {
  const recBase = { courtId: 'c1', customerId: 'cust1', startDate: TUE, startMin: 1200, endMin: 1260, billingMode: 'por_jogo' as const };

  it('cria e passa a ocupar todas as semanas', async () => {
    const r = await createRecurrence(recBase, d);
    expect(r.weekday).toBe(2);
    await expect(saveReservation({ ...base, date: '2026-10-13' }, d)).rejects.toBeInstanceOf(ConflictError);
  });

  it('lista as datas em conflito e aceita pular essas datas', async () => {
    await saveReservation({ ...base, date: '2026-10-06' }, d);
    const err = await createRecurrence(recBase, d).catch((e) => e);
    expect(err).toBeInstanceOf(RecurrenceConflictError);
    expect((err as RecurrenceConflictError).conflicts.map((c) => c.date)).toEqual(['2026-10-06']);
    const r = await createRecurrence({ ...recBase, skipDates: ['2026-10-06'] }, d);
    expect(r.skipDates).toEqual(['2026-10-06']);
  });

  it('mensal exige valor', async () => {
    await expect(createRecurrence({ ...recBase, billingMode: 'mensal' }, d)).rejects.toBeInstanceOf(ValidationError);
  });

  it('pular data cancela a ocorrência materializada e libera o horário', async () => {
    const r = await createRecurrence(recBase, d);
    const m = await materializeRecurrenceDate(r.id, '2026-09-29', d);
    expect(await materializeRecurrenceDate(r.id, '2026-09-29', d)).toMatchObject({ id: m.id }); // idempotente
    await skipRecurrenceDate(r.id, '2026-09-29', d);
    expect((await d.reservations.get(m.id))?.status).toBe('cancelada');
    const avulsa = await saveReservation({ ...base, date: '2026-09-29' }, d);
    expect(avulsa.id).toBeTruthy();
    await expect(unskipRecurrenceDate(r.id, '2026-09-29', d)).rejects.toBeInstanceOf(ConflictError);
  });

  it('pausar, retomar (com checagem) e encerrar', async () => {
    const r = await createRecurrence(recBase, d);
    await pauseRecurrenceRepo(r.id, '2026-09-29', d);
    await saveReservation({ ...base, date: '2026-10-13' }, d); // horário vago durante a pausa
    await expect(resumeRecurrenceRepo(r.id, '2026-10-06', d)).rejects.toBeInstanceOf(RecurrenceConflictError);
    await resumeRecurrenceRepo(r.id, '2026-10-20', d);
    const after = await d.recurrences.get(r.id);
    expect(after?.status).toBe('ativo');
    expect(after?.skipDates).toEqual(['2026-09-29', '2026-10-06', '2026-10-13']);
    await endRecurrenceRepo(r.id, '2026-10-31', d);
    expect(await d.recurrences.get(r.id)).toMatchObject({ status: 'encerrado', endDate: '2026-10-31' });
  });

  it('registra mensalidade', async () => {
    const r = await createRecurrence({ ...recBase, billingMode: 'mensal', monthlyPrice: 40000 }, d);
    await addPayment({ recurrenceId: r.id, referenceMonth: '2026-09', amount: 40000, method: 'pix' }, d);
    expect(await d.payments.where('[recurrenceId+referenceMonth]').equals([r.id, '2026-09']).count()).toBe(1);
  });
});

describe('remarcar jogo de mensalista', () => {
  const recBase = { courtId: 'c1', customerId: 'cust1', startDate: TUE, startMin: 1200, endMin: 1260, billingMode: 'por_jogo' as const };

  it('pula a data e cria a avulsa no novo horário (mesmo dia)', async () => {
    const r = await createRecurrence(recBase, d);
    const moved = await rescheduleOccurrence(r.id, '2026-09-29', { ...base, date: '2026-09-29', startMin: 1260, endMin: 1320 }, d);
    expect(moved.startMin).toBe(1260);
    expect((await d.recurrences.get(r.id))?.skipDates).toEqual(['2026-09-29']);
  });

  it('se o novo horário estiver ocupado, nada muda', async () => {
    const r = await createRecurrence(recBase, d);
    await saveReservation({ ...base, date: '2026-09-29', startMin: 1260, endMin: 1320 }, d);
    await expect(rescheduleOccurrence(r.id, '2026-09-29', { ...base, date: '2026-09-29', startMin: 1260, endMin: 1320 }, d)).rejects.toBeInstanceOf(ConflictError);
    expect((await d.recurrences.get(r.id))?.skipDates).toEqual([]);
  });
});
