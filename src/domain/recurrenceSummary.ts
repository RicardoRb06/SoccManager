/**
 * Situação de um mensalista: débito, mês atual, próximas datas e exceções.
 * E a transição pura de "retomar" (pausado → ativo) sem ressuscitar as datas do período pausado.
 */
import type { Cents, ISODate, ISODateTime, Payment, PriceRule, Recurrence } from './types';
import { addDays, monthOf } from './dates';
import { receivables, type ReceivableItem } from './metrics';
import { billableMonths, monthlyDebt, monthStatus, type MonthStatus } from './payments';
import { nextOccurrenceDates, occurrenceDates } from './recurrence';
import type { PreparedSchedule } from './schedule';

export interface RecurrenceSummary {
  debt: Cents;
  pending: ReceivableItem[];
  /** Situação do mês atual (só para cobrança mensal e se o mês é cobrável). */
  currentMonth?: MonthStatus;
  nextDates: ISODate[];
  /** Datas puladas a partir de hoje */
  upcomingSkips: ISODate[];
}

export function recurrenceSummary(
  rec: Recurrence,
  prep: PreparedSchedule,
  payments: Payment[],
  rules: PriceRule[],
  today: ISODate,
  nowMin: number,
): RecurrenceSummary {
  const nextDates = nextOccurrenceDates(rec, today, 3);
  const upcomingSkips = rec.skipDates.filter((d) => d >= today).sort();
  if (rec.billingMode === 'mensal') {
    const current = monthOf(today);
    const { total, months } = monthlyDebt(rec, payments, current, today);
    const billable = billableMonths(rec, current, today).includes(current);
    const pending: ReceivableItem[] = months.map((m) => ({ kind: 'mensalidade', customerId: rec.customerId, month: m.month, amount: m.balance, recurrenceId: rec.id }));
    return { debt: total, pending, currentMonth: billable ? monthStatus(rec, payments, current) : undefined, nextDates, upcomingSkips };
  }
  const items = receivables(prep, payments, rules, { from: rec.startDate, to: today }, today, nowMin).filter(
    (i) => (i.kind === 'ocorrencia' && i.recurrenceId === rec.id) || (i.kind === 'reserva' && i.reservation.recurrenceId === rec.id),
  );
  return { debt: items.reduce((a, i) => a + i.amount, 0), pending: items, nextDates, upcomingSkips };
}

/**
 * Retomar um mensalista pausado a partir de `resumeDate`:
 * as datas do período pausado (pausedAt até a véspera) viram exceções (skipDates),
 * para não "reaparecerem" como jogos que não aconteceram.
 */
export function resumeRecurrence(rec: Recurrence, resumeDate: ISODate, now: ISODateTime): Recurrence {
  if (rec.status !== 'pausado') return rec;
  const from = rec.pausedAt ?? resumeDate;
  const paused = from < resumeDate ? occurrenceDates({ ...rec, status: 'ativo', pausedAt: undefined, skipDates: [] }, from, addDays(resumeDate, -1)) : [];
  const skipDates = [...new Set([...rec.skipDates, ...paused])].sort();
  const { pausedAt: _omit, ...rest } = rec;
  void _omit;
  return { ...rest, status: 'ativo', skipDates, updatedAt: now };
}

export function pauseRecurrence(rec: Recurrence, fromDate: ISODate, now: ISODateTime): Recurrence {
  return { ...rec, status: 'pausado', pausedAt: fromDate, updatedAt: now };
}

/** Encerra: gera ocorrências só até `lastDate` (inclusive). */
export function endRecurrence(rec: Recurrence, lastDate: ISODate, now: ISODateTime): Recurrence {
  const endDate = rec.endDate && rec.endDate < lastDate ? rec.endDate : lastDate;
  const { pausedAt: _omit, ...rest } = rec;
  void _omit;
  // se estava pausado, as datas pausadas até o fim viram exceções
  const base = rec.status === 'pausado' && rec.pausedAt && rec.pausedAt <= endDate ? resumeRecurrence(rec, addDays(endDate, 1), now) : rest;
  return { ...base, status: 'encerrado', endDate, updatedAt: now };
}

/** Receita fixa prevista por mês: helper para a tela (preço por jogo pela regra/tabela). */
export { expectedMonthlyRevenue } from './payments';
