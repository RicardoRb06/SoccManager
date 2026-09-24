/**
 * Situação de pagamento (sempre DERIVADA, nunca armazenada).
 */
import type { Cents, ISODate, ISOMonth, Payment, Recurrence, Reservation } from './types';
import { monthOf, monthRange, firstDayOfMonth, lastDayOfMonth } from './dates';
import { occurrenceDates } from './recurrence';

export type PaymentStatus = 'pendente' | 'parcial' | 'pago';

/** Estado visual na agenda (cor + ícone + texto). */
export type SlotVisualState = 'livre' | 'pendente' | 'sinal' | 'pago' | 'falta' | 'bloqueado' | 'mensalidade';

export function paidFor(payments: Payment[], reservationId: string): Cents {
  let sum = 0;
  for (const p of payments) if (p.reservationId === reservationId) sum += p.amount;
  return sum;
}

export function paymentStatus(price: Cents, paid: Cents): PaymentStatus {
  if (paid >= price) return 'pago';
  if (paid > 0) return 'parcial';
  return 'pendente';
}

/** Saldo devedor da reserva. Cancelada ou na lixeira não gera saldo. */
export function reservationBalance(r: Reservation, paid: Cents): Cents {
  if (r.status === 'cancelada' || r.deletedAt) return 0;
  return Math.max(0, r.price - paid);
}

/** Estado visual de uma reserva materializada. */
export function reservationVisualState(r: Reservation, paid: Cents, isMonthlyBilling = false): SlotVisualState {
  if (r.status === 'cancelada' || r.deletedAt) return 'livre';
  if (r.status === 'falta') return 'falta';
  if (isMonthlyBilling && r.price === 0) return 'mensalidade';
  const st = paymentStatus(r.price, paid);
  return st === 'pago' ? 'pago' : st === 'parcial' ? 'sinal' : 'pendente';
}

/** Índice reservationId -> total pago. */
export function paidByReservation(payments: Payment[]): Map<string, Cents> {
  const map = new Map<string, Cents>();
  for (const p of payments) {
    if (!p.reservationId) continue;
    map.set(p.reservationId, (map.get(p.reservationId) ?? 0) + p.amount);
  }
  return map;
}

// ---------------------------------------------------------------- mensalidade

export interface MonthStatus {
  month: ISOMonth;
  due: Cents;
  paid: Cents;
  balance: Cents;
  emDia: boolean;
}

export function paidForMonth(payments: Payment[], recurrenceId: string, month: ISOMonth): Cents {
  let sum = 0;
  for (const p of payments) if (p.recurrenceId === recurrenceId && p.referenceMonth === month) sum += p.amount;
  return sum;
}

/**
 * Meses em que a mensalidade é devida: meses (até `untilMonth`) com pelo menos uma
 * data da regra (ignorando pular datas, pois pular um jogo não abate a mensalidade).
 * Se `today` for informado, o mês só conta depois que o primeiro jogo dele chegou
 * (um mensalista criado hoje para jogar semana que vem ainda não deve nada).
 */
export function billableMonths(rec: Recurrence, untilMonth: ISOMonth, today?: ISODate): ISOMonth[] {
  if (rec.billingMode !== 'mensal') return [];
  const startMonth = monthOf(rec.startDate);
  if (startMonth > untilMonth) return [];
  const probe: Recurrence = { ...rec, skipDates: [] };
  return monthRange(startMonth, untilMonth).filter((m) => {
    const first = occurrenceDates(probe, firstDayOfMonth(m), lastDayOfMonth(m))[0];
    return first !== undefined && (!today || first <= today);
  });
}

export function monthStatus(rec: Recurrence, payments: Payment[], month: ISOMonth): MonthStatus {
  const due = rec.monthlyPrice ?? 0;
  const paid = paidForMonth(payments, rec.id, month);
  const balance = Math.max(0, due - paid);
  return { month, due, paid, balance, emDia: paid >= due };
}

/** Débito acumulado de mensalidades até o mês `untilMonth` (inclusive). */
export function monthlyDebt(rec: Recurrence, payments: Payment[], untilMonth: ISOMonth, today?: ISODate): { total: Cents; months: MonthStatus[] } {
  const months = billableMonths(rec, untilMonth, today)
    .map((m) => monthStatus(rec, payments, m))
    .filter((s) => s.balance > 0);
  return { total: months.reduce((a, s) => a + s.balance, 0), months };
}

/** Receita fixa prevista por mês dos mensalistas ativos (mensal = mensalidade; por jogo = preço × jogos no mês). */
export function expectedMonthlyRevenue(
  recurrences: Recurrence[],
  month: ISOMonth,
  pricePerGame: (rec: Recurrence, date: ISODate) => Cents,
): Cents {
  let total = 0;
  for (const rec of recurrences) {
    if (rec.status !== 'ativo') continue;
    if (rec.billingMode === 'mensal') {
      total += rec.monthlyPrice ?? 0;
    } else {
      for (const d of occurrenceDates({ ...rec, skipDates: [] }, firstDayOfMonth(month), lastDayOfMonth(month))) {
        total += pricePerGame(rec, d);
      }
    }
  }
  return total;
}
