/**
 * Linha do tempo do dia de uma quadra: coluna de horas à esquerda e os horários ao lado.
 *
 * Cada reserva vira um bloco com altura proporcional à duração, uma barra de cor na lateral
 * e uma etiqueta forte de pagamento embaixo do valor: verde = pago, âmbar = a pagar,
 * azul = sinal, vermelho = falta. Horário livre é só informação.
 */
import { Fragment, type ReactNode } from 'react';
import { Check, Lock, Repeat, X } from 'lucide-react';
import type { Court, ISODate, Minutes } from '../../domain/types';
import { buildDayRows } from '../../domain/agendaRows';
import { formatDuration, formatTimeRange, minToHHMM } from '../../domain/time';
import { formatBRLShort } from '../../domain/money';
import { priceFor } from '../../domain/pricing';
import type { Occupant } from '../../domain/schedule';
import { describeOccupant, type AgendaData, type OccupantView } from './useAgendaData';

/** Altura de 1h na tela e altura mínima de um horário (para caber nome + situação e o toque). */
const HOUR_PX = 64;
const MIN_SLOT_PX = 56;

interface Look {
  /** cor da barra lateral */
  bar: string;
  /** fundo do bloco */
  surface: string;
  /** etiqueta de pagamento (à direita, embaixo do valor) */
  tag?: { label: ReactNode; className: string; icon?: ReactNode };
  /** texto complementar (ex.: quanto falta, jogando agora) */
  detail?: ReactNode;
  /** esmaece (já passou e não pede ação) */
  faded: boolean;
  strike?: boolean;
}

// Fundo opaco (mistura fixa com o fundo da página): as linhas das horas não aparecem através do bloco
const SURFACE = 'bg-[color-mix(in_oklab,var(--foreground)_5%,var(--background))] dark:bg-[color-mix(in_oklab,var(--foreground)_8%,var(--background))]';

/**
 * Cores fortes e fixas das etiquetas de pagamento (feedback: na correria precisa bater o olho e saber quem pagou).
 * Verde = pago, âmbar = não pago, azul = sinal, vermelho = falta. No escuro o fundo clareia e o texto escurece.
 */
const TAG = {
  pago: 'bg-green-600 text-white dark:bg-green-500 dark:text-green-950',
  aPagar: 'bg-amber-400 text-amber-950',
  sinal: 'bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-950',
  falta: 'bg-red-600 text-white dark:bg-red-400 dark:text-red-950',
};
const BAR = {
  pago: 'bg-green-600 dark:bg-green-500',
  aPagar: 'bg-amber-400',
  sinal: 'bg-blue-600 dark:bg-blue-400',
  falta: 'bg-red-600 dark:bg-red-400',
};

function lookOf(v: OccupantView, past: boolean, playing: boolean, endMin: Minutes): Look {
  const now = playing ? <span className="font-medium text-foreground">Jogando agora · até {minToHHMM(endMin)}</span> : undefined;
  switch (v.state) {
    case 'pago':
      return { bar: BAR.pago, surface: SURFACE, tag: { label: 'Pago', className: TAG.pago, icon: <Check strokeWidth={3} /> }, detail: now, faded: past };
    case 'sinal': {
      const price = typeof v.value === 'number' ? v.value : 0;
      const paid = v.paid ?? 0;
      return {
        bar: BAR.sinal,
        surface: SURFACE,
        tag: { label: `Sinal ${formatBRLShort(paid)}`, className: TAG.sinal },
        detail: now ?? <span>faltam {formatBRLShort(Math.max(0, price - paid))}</span>,
        faded: false,
      };
    }
    case 'pendente':
      return { bar: BAR.aPagar, surface: SURFACE, tag: { label: 'A pagar', className: TAG.aPagar }, detail: now, faded: false };
    case 'mensal_ok':
      return { bar: BAR.pago, surface: SURFACE, tag: { label: 'Em dia', className: TAG.pago, icon: <Check strokeWidth={3} /> }, detail: now, faded: past };
    case 'mensal_devendo':
      return { bar: BAR.aPagar, surface: SURFACE, tag: { label: 'Devendo', className: TAG.aPagar }, detail: now, faded: false };
    case 'falta':
      return { bar: BAR.falta, surface: 'hatch-red', tag: { label: 'Falta', className: TAG.falta, icon: <X strokeWidth={3} /> }, faded: false, strike: true };
    case 'bloqueado': {
      const generic = v.title === 'Bloqueado' || v.title === 'Fechado';
      return {
        bar: 'bg-muted-foreground/50',
        surface: 'hatch-gray',
        detail: generic ? undefined : (
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" aria-hidden />
            Bloqueado
          </span>
        ),
        faded: past,
      };
    }
    case 'outra_quadra':
      return { bar: 'bg-muted-foreground/50', surface: 'hatch-gray', faded: past };
    default:
      return { bar: 'bg-muted-foreground/40', surface: SURFACE, faded: past };
  }
}

export function DayTimeline({
  data,
  courts,
  date,
  slotMinutes,
  nowMin,
  isPast,
  onItem,
}: {
  data: AgendaData;
  courts: Court[];
  date: ISODate;
  slotMinutes: number;
  /** minuto atual se a data é hoje; null nos outros dias */
  nowMin: Minutes | null;
  isPast: (endMin: Minutes) => boolean;
  onItem: (o: Occupant) => void;
}) {
  const cols = courts.map((court) => ({ court, rows: buildDayRows(data.prep, court.id, date, slotMinutes) }));
  const all = cols.flatMap((c) => c.rows);

  if (all.length === 0) {
    return <p className="rounded-xl border border-dashed border-input p-6 text-center text-muted-foreground">Fechado neste dia.</p>;
  }

  const start = Math.min(...all.map((r) => r.startMin));
  const end = Math.max(...all.map((r) => r.endMin));
  const ppm = Math.max(HOUR_PX / 60, MIN_SLOT_PX / slotMinutes); // pixels por minuto
  const y = (m: Minutes) => (m - start) * ppm;
  const height = y(end);
  const ticks: Minutes[] = [];
  for (let t = start; t <= end; t += slotMinutes) ticks.push(t);
  const gridTemplateColumns = `3rem repeat(${cols.length}, minmax(0, 1fr))`;

  return (
    <div>
      <div className="grid gap-x-3 pt-2" style={{ gridTemplateColumns }}>
        {/* coluna de horas */}
        <div className="relative" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2 text-xs font-medium tabular-nums text-muted-foreground" style={{ top: y(t) }}>
              {minToHHMM(t)}
            </span>
          ))}
        </div>

        {cols.map(({ court, rows }) => (
          <section key={court.id} aria-label={court.name} className="relative" style={{ height }}>
            {ticks.map((t) => (
              <span key={t} className="absolute inset-x-0 h-px bg-border" style={{ top: y(t) }} aria-hidden />
            ))}

            {rows.map((row, i) => {
              const past = isPast(row.endMin);
              const dur = row.endMin - row.startMin;

              if (row.type === 'livre') {
                const price = priceFor(data.priceRules, court.id, date, row.startMin, row.endMin);
                // Horário livre é só informação: nova reserva nasce pelo botão "Nova reserva"
                return (
                  <div
                    key={`l${row.startMin}`}
                    className={`absolute inset-x-0 flex items-center pl-3 text-sm text-muted-foreground/70 ${past ? 'opacity-45' : ''}`}
                    style={{ top: y(row.startMin) + 2, height: dur * ppm - 4 }}
                  >
                    Livre
                    {!past && <span className="ml-2 font-medium tabular-nums text-muted-foreground">{formatBRLShort(price)}</span>}
                  </div>
                );
              }

              const v = describeOccupant(row.occupant, data, court.id, date);
              const playing = nowMin !== null && row.startMin <= nowMin && nowMin < row.endMin;
              const look = lookOf(v, past, playing, row.endMin);
              const h = dur * ppm - 6;
              const clickable = row.occupant.kind !== 'fechado';
              const detailParts = [v.subtitle, look.detail].filter(Boolean);
              const range = dur !== slotMinutes && h >= 88 ? `${formatTimeRange(row.startMin, row.endMin)} · ${formatDuration(dur)}` : null;
              return (
                <button
                  key={`i${i}`}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onItem(row.occupant)}
                  className={`absolute left-1 right-0 flex items-center gap-2.5 overflow-hidden rounded-lg py-2 pl-3.5 pr-2.5 text-left transition-shadow enabled:hover:ring-1 enabled:hover:ring-foreground/15 ${look.surface} ${look.faded ? 'opacity-75' : ''}`}
                  style={{ top: y(row.startMin) + 3, height: h }}
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${look.bar}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {v.isRecurrence && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Mensalista" />}
                      <span className={`truncate text-[15px] font-semibold tracking-tight ${look.strike ? 'line-through decoration-muted-foreground/60' : ''}`}>{v.title}</span>
                    </span>
                    {h >= 44 && detailParts.length > 0 && (
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {detailParts.map((p, k) => (
                          <Fragment key={k}>
                            {k > 0 && <span aria-hidden>·</span>}
                            {p}
                          </Fragment>
                        ))}
                      </span>
                    )}
                    {range && <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">{range}</span>}
                  </span>
                  {(typeof v.value === 'number' || look.tag) && (
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {typeof v.value === 'number' && <span className="text-sm font-medium leading-none tabular-nums">{formatBRLShort(v.value)}</span>}
                      {look.tag && (
                        <span
                          className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold leading-none [&_svg]:size-3 ${look.tag.className}`}
                        >
                          {look.tag.icon}
                          {look.tag.label}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
