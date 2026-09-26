/**
 * Linha do tempo do dia: coluna de horas à esquerda e uma coluna por quadra
 * (no celular, só a quadra escolhida; no desktop, todas lado a lado dividindo a mesma coluna de horas).
 *
 * Cada reserva vira um bloco com altura proporcional à duração e uma barra fina de cor na lateral,
 * que indica a situação. Cor forte só no que pede ação: "A receber", mensalidade pendente e falta.
 * Reserva futura sem pagamento fica neutra, porque é o normal (ninguém paga antes de jogar).
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
  status?: ReactNode;
  /** esmaece (já passou e não pede ação) */
  faded: boolean;
  strike?: boolean;
}

const SURFACE = 'bg-foreground/[0.045] dark:bg-foreground/[0.07]';

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-warning-muted px-1.5 py-px text-[11.5px] font-semibold text-warning-fg">{children}</span>;
}

function lookOf(v: OccupantView, past: boolean, playing: boolean, endMin: Minutes): Look {
  switch (v.state) {
    case 'pago':
      return {
        bar: 'bg-success',
        surface: SURFACE,
        status: (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-3" strokeWidth={2.6} aria-hidden />
            Pago
          </span>
        ),
        faded: past,
      };
    case 'sinal': {
      const price = typeof v.value === 'number' ? v.value : 0;
      const paid = v.paid ?? 0;
      return {
        bar: 'bg-info',
        surface: SURFACE,
        status: (
          <span>
            <span className="font-medium text-info">Sinal {formatBRLShort(paid)}</span> · faltam {formatBRLShort(Math.max(0, price - paid))}
          </span>
        ),
        faded: false,
      };
    }
    case 'pendente':
      if (playing) return { bar: 'bg-foreground', surface: SURFACE, status: <span className="font-medium text-foreground">Jogando agora · até {minToHHMM(endMin)}</span>, faded: false };
      if (past) return { bar: 'bg-warning', surface: SURFACE, status: <Pill>A receber</Pill>, faded: false };
      return { bar: 'bg-muted-foreground/40', surface: SURFACE, faded: false };
    case 'mensal_ok':
      return { bar: 'bg-success', surface: SURFACE, status: v.subtitle ? 'mensalidade em dia' : 'Mensalidade em dia', faded: past };
    case 'mensal_devendo':
      return { bar: 'bg-warning', surface: SURFACE, status: <Pill>Mensalidade pendente</Pill>, faded: false };
    case 'falta':
      return {
        bar: 'bg-danger',
        surface: 'hatch-red',
        status: (
          <span className="inline-flex items-center gap-1 font-medium text-danger-fg">
            <X className="size-3" strokeWidth={2.6} aria-hidden />
            Não compareceu
          </span>
        ),
        faded: false,
        strike: true,
      };
    case 'bloqueado': {
      const generic = v.title === 'Bloqueado' || v.title === 'Fechado';
      return {
        bar: 'bg-muted-foreground/50',
        surface: 'hatch-gray',
        status: generic ? undefined : (
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
  showHeaders,
  onItem,
}: {
  data: AgendaData;
  courts: Court[];
  date: ISODate;
  slotMinutes: number;
  /** minuto atual se a data é hoje; null nos outros dias */
  nowMin: Minutes | null;
  isPast: (endMin: Minutes) => boolean;
  /** mostra o nome de cada quadra no topo da coluna (desktop) */
  showHeaders: boolean;
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
      {showHeaders && (
        <div className="mb-2 grid gap-x-3" style={{ gridTemplateColumns }}>
          <span />
          {cols.map(({ court, rows }) => {
            const first = rows[0]?.startMin ?? 0;
            const last = rows[rows.length - 1]?.endMin ?? 0;
            const total = Math.round((last - first) / slotMinutes);
            const free = rows.filter((r) => r.type === 'livre').length;
            return (
              <div key={court.id} className="flex items-baseline justify-between gap-2 pl-4 pr-1">
                <h2 className="truncate font-semibold tracking-tight">{court.name}</h2>
                {total > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {Math.max(0, total - free)} de {total} ocupados
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

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
              const statusParts = [v.subtitle, look.status].filter(Boolean);
              const range = dur !== slotMinutes && h >= 88 ? `${formatTimeRange(row.startMin, row.endMin)} · ${formatDuration(dur)}` : null;
              return (
                <button
                  key={`i${i}`}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onItem(row.occupant)}
                  className={`absolute left-1 right-0 flex items-start gap-2.5 overflow-hidden rounded-lg py-2 pl-3.5 pr-3 text-left transition-shadow enabled:hover:ring-1 enabled:hover:ring-foreground/15 ${look.surface} ${look.faded ? 'opacity-70' : ''}`}
                  style={{ top: y(row.startMin) + 3, height: h }}
                >
                  <span className={`absolute inset-y-0 left-0 w-[3px] ${look.bar}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {v.isRecurrence && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Mensalista" />}
                      <span className={`truncate text-[15px] font-semibold tracking-tight ${look.strike ? 'line-through decoration-muted-foreground/60' : ''}`}>{v.title}</span>
                    </span>
                    {h >= 44 && statusParts.length > 0 && (
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {statusParts.map((p, k) => (
                          <Fragment key={k}>
                            {k > 0 && <span aria-hidden>·</span>}
                            {p}
                          </Fragment>
                        ))}
                      </span>
                    )}
                    {range && <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">{range}</span>}
                  </span>
                  {typeof v.value === 'number' && <span className="shrink-0 text-sm font-medium tabular-nums">{formatBRLShort(v.value)}</span>}
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
