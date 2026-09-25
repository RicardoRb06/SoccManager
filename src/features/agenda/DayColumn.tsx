/** Lista de horários de uma quadra em um dia. */
import { Plus, Repeat } from 'lucide-react';
import type { ISODate, Minutes } from '../../domain/types';
import { buildDayRows } from '../../domain/agendaRows';
import { formatDuration, formatTimeRange, minToHHMM } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import { priceFor } from '../../domain/pricing';
import type { Occupant } from '../../domain/schedule';
import { STATE_STYLES, StateBadge } from '../../components/StateBadge';
import { describeOccupant, type AgendaData } from './useAgendaData';

export function DayColumn({
  data,
  courtId,
  date,
  slotMinutes,
  isPast,
  onFree,
  onItem,
}: {
  data: AgendaData;
  courtId: string;
  date: ISODate;
  slotMinutes: number;
  isPast: (endMin: Minutes) => boolean;
  onFree: (startMin: Minutes) => void;
  onItem: (o: Occupant) => void;
}) {
  const rows = buildDayRows(data.prep, courtId, date, slotMinutes);

  if (rows.length === 0) {
    return <p className="rounded-2xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">Fechado neste dia.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const past = isPast(row.endMin);
        const dur = row.endMin - row.startMin;
        const time = (
          <span className="w-16 shrink-0 tabular-nums" aria-label={formatTimeRange(row.startMin, row.endMin)}>
            <span className="block text-base font-bold leading-tight text-foreground">{minToHHMM(row.startMin)}</span>
            <span className="block text-xs text-muted-foreground">
              até {minToHHMM(row.endMin)}
              {dur !== slotMinutes && <span className="block">{formatDuration(dur)}</span>}
            </span>
          </span>
        );

        if (row.type === 'livre') {
          const price = priceFor(data.priceRules, courtId, date, row.startMin, row.endMin);
          return (
            <li key={`l${row.startMin}`}>
              <button
                type="button"
                onClick={() => onFree(row.startMin)}
                aria-label={`Livre, ${formatTimeRange(row.startMin, row.endMin)}, ${formatBRL(price)}. Nova reserva`}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left transition-colors hover:border-brand hover:bg-brand-soft ${STATE_STYLES.livre.row} ${past ? 'opacity-50' : ''}`}
              >
                {time}
                <span className="flex-1 text-sm text-muted-foreground">
                  Livre · <span className="font-medium text-foreground/85">{formatBRL(price)}</span>
                </span>
                <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
                  <Plus className="size-5" />
                </span>
              </button>
            </li>
          );
        }

        const v = describeOccupant(row.occupant, data, courtId, date);
        const clickable = row.occupant.kind !== 'fechado';
        return (
          <li key={`i${i}`}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onItem(row.occupant)}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left ${STATE_STYLES[v.state].row} ${past ? 'opacity-60' : ''}`}
            >
              {time}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {v.isRecurrence && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Mensalista" />}
                  <span className="truncate font-semibold text-foreground">{v.title}</span>
                </span>
                {v.subtitle && <span className="block truncate text-xs text-muted-foreground">{v.subtitle}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {v.value !== undefined && (
                  <span className="text-sm font-medium tabular-nums text-foreground/85">{typeof v.value === 'number' ? formatBRL(v.value) : v.value}</span>
                )}
                <StateBadge state={v.state} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
