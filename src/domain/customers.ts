/** Estatísticas de cliente (derivadas). */
import type { Cents, ISODate, Payment, Recurrence, Reservation } from './types';
import { materializedKeys, nextOccurrenceDates, occurrenceDates, occurrenceKey } from './recurrence';
import { addDays } from './dates';

export interface CustomerStats {
  games: number;
  faltas: number;
  cancelamentos: number;
  totalPaid: Cents;
  lastGame: ISODate | null;
  nextGame: ISODate | null;
}

/**
 * Jogos = reservas ativas ou com falta até hoje + jogos de mensalista já ocorridos (ocorrências virtuais).
 * totalPaid = pagamentos das reservas do cliente + mensalidades dos seus mensalistas.
 */
export function customerStats(
  customerId: string,
  reservations: Reservation[],
  payments: Payment[],
  recurrences: Recurrence[],
  today: ISODate,
): CustomerStats {
  const mine = reservations.filter((r) => r.customerId === customerId && !r.deletedAt);
  const resIds = new Set(mine.map((r) => r.id));
  const recIds = new Set(recurrences.filter((r) => r.customerId === customerId).map((r) => r.id));
  let totalPaid = 0;
  for (const p of payments) {
    if ((p.reservationId && resIds.has(p.reservationId)) || (!p.reservationId && p.recurrenceId && recIds.has(p.recurrenceId))) totalPaid += p.amount;
  }
  const played = mine.filter((r) => r.status !== 'cancelada');
  const past = played.filter((r) => r.date <= today).map((r) => r.date).sort();
  const future = played.filter((r) => r.date > today).map((r) => r.date).sort();
  // ocorrências virtuais já passadas dos mensalistas do cliente (não materializadas)
  const materialized = materializedKeys(reservations);
  let virtualPast = 0;
  let virtualNext: ISODate | null = null;
  let virtualLast: ISODate | null = null;
  for (const rec of recurrences) {
    if (rec.customerId !== customerId) continue;
    for (const d of occurrenceDates(rec, rec.startDate, today)) {
      if (materialized.has(occurrenceKey(rec.id, d))) continue;
      virtualPast++;
      if (!virtualLast || d > virtualLast) virtualLast = d;
    }
  }
  for (const rec of recurrences) {
    if (rec.customerId !== customerId) continue;
    const next = nextOccurrenceDates(rec, addDays(today, 1), 8).find((d) => !materialized.has(occurrenceKey(rec.id, d)));
    if (next && (!virtualNext || next < virtualNext)) virtualNext = next;
  }
  const nextReal = future[0] ?? null;
  return {
    games: played.filter((r) => r.date <= today).length + virtualPast,
    faltas: mine.filter((r) => r.status === 'falta').length,
    cancelamentos: mine.filter((r) => r.status === 'cancelada').length,
    totalPaid,
    lastGame: [past[past.length - 1], virtualLast].filter((x): x is ISODate => !!x).sort().pop() ?? null,
    nextGame: nextReal && virtualNext ? (nextReal < virtualNext ? nextReal : virtualNext) : (nextReal ?? virtualNext),
  };
}
