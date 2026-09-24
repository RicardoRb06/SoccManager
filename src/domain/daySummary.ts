/** Resumo do fechamento do dia ("Encerrar o dia"). */
import type { Cents, ISODate, Payment, PaymentMethod, PriceRule } from './types';
import { isoDateTimeToLocalDate } from './dates';
import { receivables, type ReceivableItem } from './metrics';
import { itemsOnDate, type PreparedSchedule } from './schedule';

export interface DaySummary {
  received: Cents;
  byMethod: Record<PaymentMethod, Cents>;
  pending: ReceivableItem[];
  pendingTotal: Cents;
  faltas: number;
  games: number;
}

export function daySummary(prep: PreparedSchedule, payments: Payment[], rules: PriceRule[], date: ISODate): DaySummary {
  const byMethod: Record<PaymentMethod, Cents> = { pix: 0, dinheiro: 0, cartao: 0, outro: 0 };
  let received = 0;
  for (const p of payments) {
    if (isoDateTimeToLocalDate(p.paidAt) !== date) continue;
    received += p.amount;
    byMethod[p.method] += p.amount;
  }
  // pendências dos jogos DESTE dia (todos, já que o dia está sendo encerrado); mensalidades ficam de fora
  const pending = receivables(prep, payments, rules, { from: date, to: date }, date, 1440).filter((i) => i.kind !== 'mensalidade');
  const items = itemsOnDate(prep, date).filter((o) => o.kind === 'reserva' || o.kind === 'mensalista');
  return {
    received,
    byMethod,
    pending,
    pendingTotal: pending.reduce((a, i) => a + i.amount, 0),
    faltas: items.filter((o) => o.kind === 'reserva' && o.reservation.status === 'falta').length,
    games: items.length,
  };
}
