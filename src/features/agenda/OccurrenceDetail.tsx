/**
 * Detalhe de uma ocorrência (virtual) de mensalista.
 * Marco 2: somente leitura. Pagamento, falta, cancelar só esta data e "pular esta data" chegam no marco 4.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, Clock, MapPin, Repeat } from 'lucide-react';
import { db } from '../../db/database';
import type { ISODate } from '../../domain/types';
import { formatLongDate, WEEKDAY_LONG } from '../../domain/dates';
import { formatDuration, formatTimeRange, minToHHMM } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import { occurrencePrice } from '../../domain/recurrence';
import { Sheet } from '../../components/ui/Sheet';

export function OccurrenceDetail({ recurrenceId, date, onClose }: { recurrenceId: string; date: ISODate; onClose: () => void }) {
  const data = useLiveQuery(async () => {
    const rec = await db.recurrences.get(recurrenceId);
    if (!rec) return null;
    const [customer, court, rules] = await Promise.all([db.customers.get(rec.customerId), db.courts.get(rec.courtId), db.priceRules.toArray()]);
    return { rec, customer, court, rules };
  }, [recurrenceId]);

  if (data === null) return null;
  return (
    <Sheet open onClose={onClose} title={data?.customer?.name ?? 'Mensalista'}>
      {!data ? (
        <p className="py-6 text-center text-slate-500">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
            <Repeat className="size-3.5" aria-hidden /> Mensalista{data.rec.notes ? ` · ${data.rec.notes}` : ''}
          </span>
          <ul className="flex flex-col gap-2 text-slate-700">
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 text-slate-400" aria-hidden /> <span className="first-letter:uppercase">{formatLongDate(date)}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-slate-400" aria-hidden /> {formatTimeRange(data.rec.startMin, data.rec.endMin)} ({formatDuration(data.rec.endMin - data.rec.startMin)})
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-slate-400" aria-hidden /> {data.court?.name}
            </li>
          </ul>
          <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            Toda {WEEKDAY_LONG[data.rec.weekday]} às {minToHHMM(data.rec.startMin)} ·{' '}
            {data.rec.billingMode === 'mensal'
              ? `mensalidade de ${formatBRL(data.rec.monthlyPrice ?? 0)}`
              : `${formatBRL(occurrencePrice(data.rec, data.rules, date))} por jogo`}
          </p>
          <p className="text-xs text-slate-500">Pagamento, falta e “pular esta data” para mensalistas chegam no marco 4.</p>
        </div>
      )}
    </Sheet>
  );
}
