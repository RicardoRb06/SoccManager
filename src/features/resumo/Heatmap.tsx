/**
 * Mapa de calor de ocupação: horas (linhas) × dias da semana (colunas).
 * Escala sequencial de uma só cor (a da quadra), clara → escura. Toque/hover mostra o valor.
 */
import { useState } from 'react';
import type { HeatCell } from '../../domain/metrics';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../../domain/dates';

function fill(ratio: number): string {
  // 8% a 92% da cor da marca misturada com branco
  const pct = Math.round(8 + ratio * 84);
  return `color-mix(in oklab, var(--brand-primary) ${pct}%, white)`;
}

export function Heatmap({ cells, weekStartsOn }: { cells: HeatCell[]; weekStartsOn: 0 | 1 }) {
  const [sel, setSel] = useState<HeatCell | null>(null);
  if (!cells.length) return <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Ainda não há horários passados neste período.</p>;

  const days = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  const byKey = new Map(cells.map((c) => [`${c.weekday}|${c.hour}`, c]));
  const detail = sel ?? null;

  return (
    <div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `2.75rem repeat(7, minmax(0, 1fr))` }} role="grid" aria-label="Ocupação por dia da semana e horário">
        <div />
        {days.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase text-slate-500" role="columnheader">
            {WEEKDAY_SHORT[d]}
          </div>
        ))}
        {hours.map((h) => (
          <div key={h} className="contents" role="row">
            <div className="flex items-center justify-end pr-1.5 text-[11px] tabular-nums text-slate-500" role="rowheader">
              {h}h
            </div>
            {days.map((d) => {
              const c = byKey.get(`${d}|${h}`);
              if (!c) return <div key={d} className="h-7 rounded-[4px] bg-slate-50" aria-hidden />;
              const pct = Math.round(c.ratio * 100);
              const label = `${WEEKDAY_LONG[d]} ${h}h: ${pct}% ocupado (${c.occupied} de ${c.total})`;
              const active = detail?.weekday === d && detail.hour === h;
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  title={label}
                  aria-label={label}
                  onMouseEnter={() => setSel(c)}
                  onFocus={() => setSel(c)}
                  onClick={() => setSel(c)}
                  className={`h-7 rounded-[4px] transition-transform ${active ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
                  style={{ background: fill(c.ratio) }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <p aria-live="polite" className="min-h-5 font-medium text-slate-800">
          {detail
            ? `${WEEKDAY_LONG[detail.weekday]}, ${detail.hour}h: ${Math.round(detail.ratio * 100)}% ocupado (${detail.occupied} de ${detail.total} horários)`
            : 'Toque em um quadrado para ver a ocupação.'}
        </p>
        <div className="flex items-center gap-2" aria-hidden>
          <span>Vazio</span>
          <span className="h-2.5 w-24 rounded-full" style={{ background: `linear-gradient(to right, ${fill(0)}, ${fill(1)})` }} />
          <span>Cheio</span>
        </div>
      </div>
    </div>
  );
}
