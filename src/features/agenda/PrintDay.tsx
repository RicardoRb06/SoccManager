/** Versão para impressão da agenda do dia (uma página, sem cores de fundo). */
import type { ISODate } from '../../domain/types';
import { formatDateBR, formatLongDate } from '../../domain/dates';
import { formatTimeRange } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import { buildDayRows } from '../../domain/agendaRows';
import { STATE_STYLES } from '../../components/StateBadge';
import { describeOccupant, type AgendaData } from './useAgendaData';

export function PrintDay({ data, date, slotMinutes, venue }: { data: AgendaData; date: ISODate; slotMinutes: number; venue: string }) {
  return (
    <div className="print-only text-[11px] text-black">
      <header className="mb-2 flex items-baseline justify-between border-b border-black pb-1">
        <h1 className="text-base font-bold">{venue}</h1>
        <p className="first-letter:uppercase">
          {formatLongDate(date)} · {formatDateBR(date)}
        </p>
      </header>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, data.courts.length)}, minmax(0, 1fr))` }}>
        {data.courts.map((c) => (
          <table key={c.id} className="w-full border-collapse">
            <caption className="mb-1 text-left text-xs font-bold">{c.name}</caption>
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-0.5 pr-1">Horário</th>
                <th className="py-0.5 pr-1">Cliente</th>
                <th className="py-0.5 pr-1">Situação</th>
                <th className="py-0.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {buildDayRows(data.prep, c.id, date, slotMinutes).map((row, i) => {
                if (row.type === 'livre')
                  return (
                    <tr key={i} className="border-b border-input text-muted-foreground">
                      <td className="whitespace-nowrap py-0.5 pr-1 tabular-nums">{formatTimeRange(row.startMin, row.endMin)}</td>
                      <td className="py-0.5 pr-1">—</td>
                      <td className="py-0.5 pr-1">Livre</td>
                      <td />
                    </tr>
                  );
                const v = describeOccupant(row.occupant, data, c.id, date);
                return (
                  <tr key={i} className="border-b border-input">
                    <td className="whitespace-nowrap py-0.5 pr-1 tabular-nums">{formatTimeRange(row.startMin, row.endMin)}</td>
                    <td className="py-0.5 pr-1">
                      {v.title}
                      {v.subtitle ? ` (${v.subtitle})` : ''}
                    </td>
                    <td className="py-0.5 pr-1">{STATE_STYLES[v.state].label}</td>
                    <td className="py-0.5 text-right tabular-nums">{typeof v.value === 'number' ? formatBRL(v.value) : (v.value ?? '')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">Impresso em {new Date().toLocaleString('pt-BR')}</p>
    </div>
  );
}
