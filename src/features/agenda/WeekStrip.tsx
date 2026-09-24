import type { ISODate } from '../../domain/types';
import { parseISODate, WEEKDAY_SHORT, weekdayOf } from '../../domain/dates';
import { dayOccupancy } from '../../domain/agendaRows';
import type { PreparedSchedule } from '../../domain/schedule';

/** 7 chips (um por dia) com mini-barra de ocupação. */
export function WeekStrip({
  dates,
  selected,
  today,
  prep,
  slotMinutes,
  onSelect,
}: {
  dates: ISODate[];
  selected: ISODate;
  today: ISODate;
  prep: PreparedSchedule | undefined;
  slotMinutes: number;
  onSelect: (d: ISODate) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Dias da semana">
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
            aria-label={`${WEEKDAY_SHORT[weekdayOf(d)]} ${parseISODate(d).d}${occ === null ? ', fechado' : `, ${pct}% ocupado`}`}
            onClick={() => onSelect(d)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 pb-1.5 pt-1 text-center transition-colors ${
              isSel ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className={`text-[11px] font-medium uppercase ${isSel ? 'text-white/85' : 'text-slate-500'}`}>{WEEKDAY_SHORT[weekdayOf(d)]}</span>
            <span className={`text-base font-bold leading-none ${d === today && !isSel ? 'text-brand' : ''}`}>{parseISODate(d).d}</span>
            <span className={`mt-1 h-1.5 w-full max-w-9 overflow-hidden rounded-full ${isSel ? 'bg-white/30' : 'bg-slate-200'}`} aria-hidden>
              <span className={`block h-full rounded-full ${isSel ? 'bg-white' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
