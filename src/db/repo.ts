/**
 * Operações de gravação. Cada ação grava na hora (sem botão "salvar" global).
 * A checagem de conflito é refeita DENTRO da transação: mesmo que a tela esteja
 * desatualizada, é impossível gravar uma reserva sobreposta.
 */
import tenant from '../config/tenant.config';
import type { Block, Cents, Customer, ISODate, Minutes, Payment, PaymentMethod, Reservation } from '../domain/types';
import { isValidRange } from '../domain/time';
import { isISODate } from '../domain/dates';
import { occupantsAt, prepareSchedule, type IgnoreOptions, type Occupant } from '../domain/schedule';
import { newId } from '../utils/id';
import { db, type AgendaDB } from './database';
import { defaultSettings, rowsToSettings } from './fromTenant';

export class ConflictError extends Error {
  constructor(public occupants: Occupant[]) {
    super('Este horário já está ocupado.');
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const nowISO = () => new Date().toISOString();

/** Carrega o necessário para checar conflitos numa data. */
export async function scheduleForDate(date: ISODate, database: AgendaDB = db) {
  const [courts, reservations, recurrences, blocks, settingsRows] = await Promise.all([
    database.courts.toArray(),
    database.reservations.where('date').equals(date).toArray(),
    database.recurrences.toArray(),
    database.blocks.toArray(),
    database.settings.toArray(),
  ]);
  const settings = rowsToSettings(settingsRows, defaultSettings(tenant));
  return prepareSchedule({ courts, reservations, recurrences, blocks, openingHours: settings.openingHours });
}

async function assertFree(
  database: AgendaDB,
  courtId: string,
  date: ISODate,
  startMin: Minutes,
  endMin: Minutes,
  ignore: IgnoreOptions,
) {
  const prep = await scheduleForDate(date, database);
  const occ = occupantsAt(prep, courtId, date, startMin, endMin, ignore);
  if (occ.length) throw new ConflictError(occ);
}

// ------------------------------------------------------------------ clientes

export interface NewCustomerInput {
  name: string;
  phone: string;
  notes?: string;
}

function buildCustomer(input: NewCustomerInput): Customer {
  const name = input.name.trim();
  if (!name) throw new ValidationError('Informe o nome do cliente.');
  return {
    id: newId(),
    name,
    phone: input.phone.trim(),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    createdAt: nowISO(),
  };
}

export async function createCustomer(input: NewCustomerInput, database: AgendaDB = db): Promise<Customer> {
  const c = buildCustomer(input);
  await database.customers.add(c);
  return c;
}

// ------------------------------------------------------------------ reservas

export interface ReservationInput {
  /** Presente = edição */
  id?: string;
  courtId: string;
  /** Cliente existente... */
  customerId?: string;
  /** ...ou novo cliente criado junto (mesma transação) */
  newCustomer?: NewCustomerInput;
  date: ISODate;
  startMin: Minutes;
  endMin: Minutes;
  price: Cents;
  priceManual: boolean;
  notes?: string;
  /** Sinal opcional (somente na criação) */
  deposit?: { amount: Cents; method: PaymentMethod };
}

export async function saveReservation(input: ReservationInput, database: AgendaDB = db): Promise<Reservation> {
  if (!isISODate(input.date)) throw new ValidationError('Data inválida.');
  if (!isValidRange(input.startMin, input.endMin)) throw new ValidationError('Horário inválido.');
  if (!Number.isInteger(input.price) || input.price < 0) throw new ValidationError('Valor inválido.');
  if (!input.customerId && !input.newCustomer) throw new ValidationError('Escolha ou cadastre o cliente.');
  if (input.deposit && (input.deposit.amount <= 0 || !Number.isInteger(input.deposit.amount))) throw new ValidationError('Valor do sinal inválido.');

  const tables = [database.reservations, database.customers, database.payments, database.recurrences, database.blocks, database.courts, database.settings];
  return database.transaction('rw', tables, async () => {
    const court = await database.courts.get(input.courtId);
    if (!court) throw new ValidationError('Quadra não encontrada.');

    const existing = input.id ? await database.reservations.get(input.id) : undefined;
    if (input.id && !existing) throw new ValidationError('Reserva não encontrada.');

    const occupies = !existing || (existing.status !== 'cancelada' && !existing.deletedAt);
    if (occupies) {
      await assertFree(database, input.courtId, input.date, input.startMin, input.endMin, {
        ignoreReservationId: existing?.id,
        ...(existing?.recurrenceId ? { ignoreOccurrence: { recurrenceId: existing.recurrenceId, date: input.date } } : {}),
      });
    }

    let customerId = input.customerId;
    if (input.newCustomer) {
      const c = buildCustomer(input.newCustomer);
      await database.customers.add(c);
      customerId = c.id;
    } else if (customerId && !(await database.customers.get(customerId))) {
      throw new ValidationError('Cliente não encontrado.');
    }

    const now = nowISO();
    const notes = input.notes?.trim();
    const res: Reservation = existing
      ? {
          ...existing,
          courtId: input.courtId,
          customerId: customerId!,
          date: input.date,
          startMin: input.startMin,
          endMin: input.endMin,
          price: input.price,
          priceManual: input.priceManual,
          notes: notes || undefined,
          updatedAt: now,
        }
      : {
          id: newId(),
          courtId: input.courtId,
          customerId: customerId!,
          date: input.date,
          startMin: input.startMin,
          endMin: input.endMin,
          price: input.price,
          priceManual: input.priceManual,
          status: 'ativa',
          ...(notes ? { notes } : {}),
          createdAt: now,
          updatedAt: now,
        };
    if (!res.notes) delete res.notes;
    await database.reservations.put(res);

    if (!existing && input.deposit) {
      await database.payments.add({
        id: newId(),
        reservationId: res.id,
        amount: input.deposit.amount,
        method: input.deposit.method,
        paidAt: now,
        note: 'Sinal',
      });
    }
    return res;
  });
}

/** Cancela (libera o horário). A reserva continua no histórico do cliente. */
export async function cancelReservation(id: string, reason?: string, database: AgendaDB = db): Promise<void> {
  const changes: Partial<Reservation> = { status: 'cancelada', updatedAt: nowISO() };
  if (reason?.trim()) changes.cancelReason = reason.trim();
  const n = await database.reservations.update(id, changes);
  if (!n) throw new ValidationError('Reserva não encontrada.');
}

/** Reativa uma reserva cancelada (se o horário ainda estiver livre). */
export async function reactivateReservation(id: string, database: AgendaDB = db): Promise<void> {
  await database.transaction('rw', [database.reservations, database.recurrences, database.blocks, database.courts, database.settings], async () => {
    const r = await database.reservations.get(id);
    if (!r) throw new ValidationError('Reserva não encontrada.');
    await assertFree(database, r.courtId, r.date, r.startMin, r.endMin, { ignoreReservationId: r.id });
    await database.reservations.update(id, { status: 'ativa', cancelReason: undefined, updatedAt: nowISO() });
  });
}

/** Exclusão lógica: vai para a Lixeira. */
export async function deleteReservation(id: string, database: AgendaDB = db): Promise<void> {
  const n = await database.reservations.update(id, { deletedAt: nowISO(), updatedAt: nowISO() });
  if (!n) throw new ValidationError('Reserva não encontrada.');
}

/** Restaura da Lixeira (se o horário ainda estiver livre, quando a reserva ocupa). */
export async function restoreReservation(id: string, database: AgendaDB = db): Promise<void> {
  await database.transaction('rw', [database.reservations, database.recurrences, database.blocks, database.courts, database.settings], async () => {
    const r = await database.reservations.get(id);
    if (!r) throw new ValidationError('Reserva não encontrada.');
    if (r.status !== 'cancelada') {
      await assertFree(database, r.courtId, r.date, r.startMin, r.endMin, { ignoreReservationId: r.id });
    }
    await database.reservations.update(id, { deletedAt: undefined, updatedAt: nowISO() });
  });
}

// ------------------------------------------------------------------ bloqueios

export interface BlockInput {
  id?: string;
  courtIds: string[];
  dateStart: ISODate;
  dateEnd: ISODate;
  /** ausentes = dia inteiro */
  startMin?: Minutes;
  endMin?: Minutes;
  reason: string;
}

export function validateBlock(input: BlockInput): void {
  if (!input.courtIds.length) throw new ValidationError('Escolha ao menos uma quadra.');
  if (!isISODate(input.dateStart) || !isISODate(input.dateEnd)) throw new ValidationError('Datas inválidas.');
  if (input.dateEnd < input.dateStart) throw new ValidationError('A data final deve ser igual ou depois da inicial.');
  const partial = input.startMin !== undefined || input.endMin !== undefined;
  if (partial && !(input.startMin !== undefined && input.endMin !== undefined && isValidRange(input.startMin, input.endMin))) {
    throw new ValidationError('Horário do bloqueio inválido.');
  }
  if (!input.reason.trim()) throw new ValidationError('Informe o motivo do bloqueio.');
}

export async function saveBlock(input: BlockInput, database: AgendaDB = db): Promise<Block> {
  validateBlock(input);
  const existing = input.id ? await database.blocks.get(input.id) : undefined;
  const b: Block = {
    id: existing?.id ?? newId(),
    courtIds: [...input.courtIds],
    dateStart: input.dateStart,
    dateEnd: input.dateEnd,
    ...(input.startMin !== undefined && input.endMin !== undefined ? { startMin: input.startMin, endMin: input.endMin } : {}),
    reason: input.reason.trim(),
    createdAt: existing?.createdAt ?? nowISO(),
  };
  await database.blocks.put(b);
  return b;
}

export async function deleteBlock(id: string, database: AgendaDB = db): Promise<void> {
  await database.blocks.delete(id);
}

// ------------------------------------------------------------------ pagamentos

export interface PaymentInput {
  reservationId?: string;
  recurrenceId?: string;
  referenceMonth?: string;
  amount: Cents;
  method: PaymentMethod;
  note?: string;
}

export async function addPayment(input: PaymentInput, database: AgendaDB = db): Promise<Payment> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ValidationError('Informe um valor maior que zero.');
  if (!input.reservationId && !(input.recurrenceId && input.referenceMonth)) throw new ValidationError('Pagamento sem referência.');
  if (input.reservationId && !(await database.reservations.get(input.reservationId))) throw new ValidationError('Reserva não encontrada.');
  const p: Payment = {
    id: newId(),
    ...(input.reservationId ? { reservationId: input.reservationId } : {}),
    ...(input.recurrenceId ? { recurrenceId: input.recurrenceId, referenceMonth: input.referenceMonth } : {}),
    amount: input.amount,
    method: input.method,
    paidAt: nowISO(),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  await database.payments.add(p);
  return p;
}

/** Quita o saldo da reserva (registra um pagamento com o valor restante). */
export async function payBalance(reservationId: string, method: PaymentMethod, database: AgendaDB = db): Promise<Cents> {
  return database.transaction('rw', [database.reservations, database.payments], async () => {
    const r = await database.reservations.get(reservationId);
    if (!r) throw new ValidationError('Reserva não encontrada.');
    const paid = (await database.payments.where('reservationId').equals(reservationId).toArray()).reduce((a, p) => a + p.amount, 0);
    const balance = r.status === 'cancelada' ? 0 : Math.max(0, r.price - paid);
    if (balance <= 0) throw new ValidationError('Esta reserva não tem saldo a pagar.');
    await database.payments.add({ id: newId(), reservationId, amount: balance, method, paidAt: nowISO() });
    return balance;
  });
}

/** Remove um pagamento lançado por engano. */
export async function deletePayment(id: string, database: AgendaDB = db): Promise<void> {
  await database.payments.delete(id);
}

/** Marca (ou desmarca) falta. A falta continua ocupando o horário. */
export async function setFalta(reservationId: string, falta: boolean, database: AgendaDB = db): Promise<void> {
  const r = await database.reservations.get(reservationId);
  if (!r) throw new ValidationError('Reserva não encontrada.');
  if (r.status === 'cancelada') throw new ValidationError('Reserva cancelada não pode receber falta.');
  await database.reservations.update(reservationId, { status: falta ? 'falta' : 'ativa', updatedAt: nowISO() });
}

// ------------------------------------------------------------------ clientes (edição e lixeira)

export async function updateCustomer(id: string, input: NewCustomerInput, database: AgendaDB = db): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new ValidationError('Informe o nome do cliente.');
  const n = await database.customers.update(id, { name, phone: input.phone.trim(), notes: input.notes?.trim() || undefined });
  if (!n) throw new ValidationError('Cliente não encontrado.');
}

/** Exclusão lógica: vai para a Lixeira. Reservas e histórico são mantidos. */
export async function deleteCustomer(id: string, database: AgendaDB = db): Promise<void> {
  const n = await database.customers.update(id, { deletedAt: nowISO() });
  if (!n) throw new ValidationError('Cliente não encontrado.');
}

export async function restoreCustomer(id: string, database: AgendaDB = db): Promise<void> {
  await database.customers.update(id, { deletedAt: undefined });
}
