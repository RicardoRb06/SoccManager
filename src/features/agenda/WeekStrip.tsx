import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ISODate } from '../../domain/types';
import { parseISODate, WEEKDAY_SHORT, weekdayOf } from '../../domain/dates';
import { dayOccupancy } from '../../domain/agendaRows';
import type { PreparedSchedule } from '../../domain/schedule';

/**
 * Faixa da semana: os 7 dias como texto, com um traço fino de ocupação embaixo do número.
 * O dia escolhido ganha fundo; hoje (quando não escolhido) fica na cor da quadra.
 * As setas trocam de semana; para trocar de dia, toca no dia.
 */
export function WeekStrip({
  dates,
  selected,
  today,
  prep,
  slotMinutes,
  onSelect,
  onPrevWeek,
  onNextWeek,
}: {
  dates: ISODate[];
  selected: ISODate;
  today: ISODate;
  prep: PreparedSchedule | undefined;
  slotMinutes: number;
  onSelect: (d: ISODate) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  const arrow = 'grid h-12 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground';
  return (
    <div className="flex items-center">
      <button type="button" aria-label="Semana anterior" onClick={onPrevWeek} className={arrow}>
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <div className="grid flex-1 grid-cols-7" role="tablist" aria-label="Dias da semana">
        {dates.map((d) => {
          const occ = prep ? dayOccupancy(prep, d, slotMinutes) : null;
          const isSel = d === selected;
          const pct = occ === null ? 0 : Math.round(occ * 100);
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={isSel}
              aria-label={`${WEEKDAY_SHORT[weekdayOf(d)]} ${parseISODate(d).d}${occ === null ? ', fechado' : `, ${pct}% ocupado`}${d === today ? ', hoje' : ''}`}
              onClick={() => onSelect(d)}
              className={`flex flex-col items-center gap-[3px] rounded-lg pb-1.5 pt-1 transition-colors ${isSel ? 'bg-foreground text-background' : 'hover:bg-accent'}`}
            >
              <span className={`text-[10.5px] font-medium uppercase tracking-wide ${isSel ? 'text-background/70' : 'text-muted-foreground'}`}>{WEEKDAY_SHORT[weekdayOf(d)]}</span>
              <span
                className={`text-base font-semibold leading-none tabular-nums ${!isSel && d === today ? 'text-brand' : ''} ${!isSel && occ === null ? 'text-muted-foreground/60' : ''}`}
              >
                {parseISODate(d).d}
              </span>
              <span className={`mt-1 h-0.5 w-[18px] overflow-hidden rounded-full ${isSel ? 'bg-background/25' : 'bg-border'}`} aria-hidden>
                <span className={`block h-full rounded-full ${isSel ? 'bg-background' : 'bg-muted-foreground'}`} style={{ width: `${pct}%` }} />
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" aria-label="Próxima semana" onClick={onNextWeek} className={arrow}>
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}
