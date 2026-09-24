import type { Court, Customer, Recurrence } from '../../domain/types';
import type { Occupant } from '../../domain/schedule';
import { formatTimeRange } from '../../domain/time';

/** Frase curta dizendo quem ocupa o horário (para o aviso de conflito). */
export function occupantText(
  o: Occupant,
  lookups: { customers: Map<string, Customer>; courts: Map<string, Court>; recurrences: Map<string, Recurrence> },
  forCourtId: string,
): string {
  const time = formatTimeRange(o.startMin, o.endMin);
  const other = o.courtId !== forCourtId ? ` na ${lookups.courts.get(o.courtId)?.name ?? 'outra quadra'} (mesmo espaço)` : '';
  switch (o.kind) {
    case 'fechado':
      return 'Fora do horário de funcionamento.';
    case 'bloqueio':
      return `Bloqueado${other} das ${time}: ${o.block.reason}.`;
    case 'reserva': {
      const name = lookups.customers.get(o.reservation.customerId)?.name ?? 'cliente';
      const team = o.reservation.recurrenceId ? lookups.recurrences.get(o.reservation.recurrenceId)?.notes : undefined;
      return `${name}${team ? ` (${team})` : ''} já reservou${other} das ${time}.`;
    }
    case 'mensalista': {
      const name = lookups.customers.get(o.occurrence.customerId)?.name ?? 'cliente';
      const team = lookups.recurrences.get(o.occurrence.recurrenceId)?.notes;
      return `Horário do mensalista ${name}${team ? ` (${team})` : ''}${other}, das ${time}.`;
    }
  }
}
