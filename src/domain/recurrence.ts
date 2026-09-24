/**
 * Mensalistas (recorrência semanal).
 *
 * A Recurrence é uma REGRA. As ocorrências são calculadas (virtuais) semana a semana.
 * Quando o usuário interage com uma ocorrência (pagamento, falta, cancelar só aquele dia),
 * ela é MATERIALIZADA como Reservation com `recurrenceId`; a partir daí a regra não gera
 * mais aquela data (qualquer reserva com o mesmo recurrenceId + date suprime a virtual,
 * inclusive canceladas ou na lixeira).
 */
import type { Cents, ISODate, ISODateTime, PriceRule, Recurrence, Reservation } from './types';
import { addDays, weekdayOf } from './dates';
import { priceFor } from './pricing';

export interface Occurrence {
  recurrenceId: string;
  date: ISODate;
  courtId: string;
  customerId: string;
  startMin: number;
  endMin: number;
}

/** Identificador estável de uma ocorrência virtual (útil para chaves de lista/rotas). */
export function occurrenceKey(recurrenceId: string, date: ISODate): string {
  return `${recurrenceId}|${date}`;
}

/** A regra gera ocorrência nesta data? (ignora materialização) */
export function occursOn(rec: Recurrence, date: ISODate): boolean {
  if (weekdayOf(date) !== rec.weekday) return false;
  if (date < rec.startDate) return false;
  if (rec.endDate && date > rec.endDate) return false;
  if (rec.skipDates.includes(date)) return false;
  if (rec.status === 'pausado') return !!rec.pausedAt && date < rec.pausedAt;
  if (rec.status === 'encerrado') return !!rec.endDate; // só até endDate (checado acima)
  return true;
}

/** Datas (em ordem) em que a regra gera ocorrência entre from e to (inclusive). */
export function occurrenceDates(rec: Recurrence, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const start = from > rec.startDate ? from : rec.startDate;
  const delta = (rec.weekday - weekdayOf(start) + 7) % 7;
  for (let d = addDays(start, delta); d <= to; d = addDays(d, 7)) {
    if (occursOn(rec, d)) out.push(d);
  }
  return out;
}

/** Conjunto de chaves recurrenceId|date já materializadas. */
export function materializedKeys(reservations: Reservation[]): Set<string> {
  const set = new Set<string>();
  for (const r of reservations) if (r.recurrenceId) set.add(occurrenceKey(r.recurrenceId, r.date));
  return set;
}

export function toOccurrence(rec: Recurrence, date: ISODate): Occurrence {
  return {
    recurrenceId: rec.id,
    date,
    courtId: rec.courtId,
    customerId: rec.customerId,
    startMin: rec.startMin,
    endMin: rec.endMin,
  };
}

/** Ocorrências virtuais (não materializadas) de várias regras entre from e to. */
export function virtualOccurrences(
  recurrences: Recurrence[],
  materialized: Set<string>,
  from: ISODate,
  to: ISODate,
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const rec of recurrences) {
    for (const d of occurrenceDates(rec, from, to)) {
      if (!materialized.has(occurrenceKey(rec.id, d))) out.push(toOccurrence(rec, d));
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1));
}

/**
 * Preço de uma ocorrência:
 *  - por_jogo: pricePerGame, ou tabela de preços se ausente
 *  - mensal: 0 (a cobrança é pela mensalidade, não por jogo)
 */
export function occurrencePrice(rec: Recurrence, rules: PriceRule[], date: ISODate): Cents {
  if (rec.billingMode === 'mensal') return 0;
  return rec.pricePerGame ?? priceFor(rules, rec.courtId, date, rec.startMin, rec.endMin);
}

/** Cria a Reservation que materializa uma ocorrência. */
export function materializeOccurrence(
  rec: Recurrence,
  date: ISODate,
  rules: PriceRule[],
  id: string,
  now: ISODateTime,
): Reservation {
  return {
    id,
    courtId: rec.courtId,
    customerId: rec.customerId,
    date,
    startMin: rec.startMin,
    endMin: rec.endMin,
    price: occurrencePrice(rec, rules, date),
    priceManual: rec.pricePerGame !== undefined,
    status: 'ativa',
    recurrenceId: rec.id,
    createdAt: now,
    updatedAt: now,
  };
}

/** Retorna a regra com a data adicionada em skipDates (sem duplicar). */
export function skipDate(rec: Recurrence, date: ISODate, now: ISODateTime): Recurrence {
  if (rec.skipDates.includes(date)) return rec;
  return { ...rec, skipDates: [...rec.skipDates, date].sort(), updatedAt: now };
}

export function unskipDate(rec: Recurrence, date: ISODate, now: ISODateTime): Recurrence {
  return { ...rec, skipDates: rec.skipDates.filter((d) => d !== date), updatedAt: now };
}

/** Próximas N datas (a partir de from, inclusive) em que a regra gera ocorrência. */
export function nextOccurrenceDates(rec: Recurrence, from: ISODate, count: number, maxWeeks = 60): ISODate[] {
  const to = addDays(from, maxWeeks * 7);
  return occurrenceDates(rec, from, to).slice(0, count);
}

/**
 * Datas candidatas para checar conflito ao criar/editar uma regra:
 * a partir de `from`, até `weeks` semanas ou até endDate (o que vier antes).
 */
export function datesToCheck(
  draft: Pick<Recurrence, 'weekday' | 'startDate' | 'endDate' | 'skipDates'>,
  from: ISODate,
  weeks = 12,
): ISODate[] {
  const start = from > draft.startDate ? from : draft.startDate;
  const delta = (draft.weekday - weekdayOf(start) + 7) % 7;
  const out: ISODate[] = [];
  let d = addDays(start, delta);
  for (let i = 0; i < weeks; i++, d = addDays(d, 7)) {
    if (draft.endDate && d > draft.endDate) break;
    if (!draft.skipDates.includes(d)) out.push(d);
  }
  return out;
}
