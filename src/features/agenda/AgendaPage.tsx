/**
 * Agenda (tela inicial).
 * Cabeçalho: a data aparece uma vez só (o título abre o calendário) e a faixa da semana.
 * Corpo: linha do tempo de uma quadra por vez (abas), no celular e no desktop.
 * Nova reserva: botão flutuante no celular, botão no cabeçalho no desktop.
 * Encerrar o dia, Imprimir e Bloquear horário ficam no fim da lista.
 */
import { useRef, useState } from 'react';
import { ChevronDown, ClipboardCheck, Lock, Plus, Printer, Undo2 } from 'lucide-react';
import { db } from '../../db/database';
import { useSettings } from '../../db/hooks';
import type { Block, ISODate, Minutes, Reservation } from '../../domain/types';
import { addDays, diffDays, isISODate, MONTH_LONG, nowMinutes, parseISODate, todayISO, WEEKDAY_LONG, weekDates, weekdayOf } from '../../domain/dates';
import type { Occupant } from '../../domain/schedule';
import { Button } from '../../components/ui/button';
import { navigate } from '../../utils/router';
import { useIsDesktop, useNow } from '../../utils/hooks';
import { useAgendaData } from './useAgendaData';
import { WeekStrip } from './WeekStrip';
import { DayTimeline } from './DayTimeline';
import { ReservationSheet, type ReservationSheetInit } from './ReservationSheet';
import { ReservationDetail } from './ReservationDetail';
import { OccurrenceDetail } from './OccurrenceDetail';
import { BlockSheet } from '../mais/BlockSheet';
import { DaySummarySheet } from './DaySummarySheet';
import { PrintDay } from './PrintDay';

type Overlay =
  | { type: 'form'; init: ReservationSheetInit; title?: string }
  | { type: 'detail'; id: string; initial?: 'pay' }
  | { type: 'occurrence'; recurrenceId: string; date: ISODate }
  | { type: 'block'; block?: Block; courtId?: string }
  | { type: 'closeDay' };

function relativeLabel(date: ISODate, today: ISODate): string | null {
  const d = diffDays(today, date);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d === -1) return 'Ontem';
  return null;
}

/** "Hoje, 25 de set." no celular; "Hoje, 25 de setembro" no desktop. */
function dayTitle(date: ISODate, today: ISODate, short: boolean): string {
  const { d, m } = parseISODate(date);
  const month = MONTH_LONG[m - 1]!;
  const monthText = short && month.length > 4 ? `${month.slice(0, 3)}.` : month;
  const prefix = relativeLabel(date, today) ?? WEEKDAY_LONG[weekdayOf(date)]!.replace('-feira', '');
  return `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}, ${d} de ${monthText}`;
}

export default function AgendaPage({ date: routeDate }: { date?: string }) {
  const settings = useSettings();
  const now = useNow();
  const today = todayISO(now);
  const date = routeDate && isISODate(routeDate) ? routeDate : today;
  const week = weekDates(date, settings.weekStartsOn);
  const data = useAgendaData(week[0]!, week[6]!, settings);
  const isDesktop = useIsDesktop();
  const [courtSel, setCourtSel] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);

  const courts = data?.courts ?? [];
  const selectedCourtId = courts.find((c) => c.id === courtSel)?.id ?? courts[0]?.id;
  // Uma quadra por vez (abas), no celular e no desktop
  const visibleCourts = courts.filter((c) => c.id === selectedCourtId);

  const goTo = (d: ISODate) => navigate(`/agenda/${d}`, { replace: true });
  const nowMin = nowMinutes(now);
  const isPast = (endMin: Minutes) => date < today || (date === today && endMin <= nowMin);

  function openDatePicker() {
    const el = dateInput.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  function openItem(o: Occupant) {
    if (o.kind === 'reserva') setOverlay({ type: 'detail', id: o.reservation.id });
    else if (o.kind === 'mensalista') setOverlay({ type: 'occurrence', recurrenceId: o.occurrence.recurrenceId, date: o.occurrence.date });
    else if (o.kind === 'bloqueio') setOverlay({ type: 'block', block: o.block });
  }

  function newReservation(courtId: string | undefined, startMin?: Minutes) {
    if (!courtId) return;
    setOverlay({ type: 'form', init: { mode: 'new', courtId, date, startMin } });
  }

  const weekStrip = (
    <WeekStrip
      dates={week}
      selected={date}
      today={today}
      prep={data?.prep}
      slotMinutes={settings.slotMinutes}
      onSelect={goTo}
      onPrevWeek={() => goTo(addDays(date, -7))}
      onNextWeek={() => goTo(addDays(date, 7))}
      showArrows={isDesktop}
    />
  );

  // "↩ Hoje" só fora do dia atual. No desktop fica à direita, longe da faixa da semana, para não deslocar os dias.
  const todayChip =
    date !== today ? (
      <button
        type="button"
        onClick={() => goTo(today)}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
      >
        <Undo2 className="size-3.5" aria-hidden /> Hoje
      </button>
    ) : null;

  return (
    <>
      <header className="pt-safe no-print sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 pt-3 lg:gap-6 lg:px-6 lg:py-3">
          {/* Largura fixa no desktop: a faixa da semana não anda quando o texto da data muda */}
          <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none lg:shrink-0">
            {/* altura fixa: o "Hoje" aparecer/sumir não empurra a faixa da semana para baixo */}
            <div className="flex min-h-8 items-center gap-2">
              <h1 className="min-w-0">
                <button
                  type="button"
                  onClick={openDatePicker}
                  aria-label={`${dayTitle(date, today, false)}. Escolher outra data`}
                  className="flex max-w-full items-center gap-1 rounded-md text-left text-[19px] font-semibold leading-tight tracking-tight hover:bg-accent lg:text-xl"
                >
                  <span className="truncate lg:overflow-visible">{dayTitle(date, today, !isDesktop)}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </h1>
              {!isDesktop && todayChip}
            </div>
            {/* campo de data invisível: o título abre o calendário nativo */}
            <input
              ref={dateInput}
              type="date"
              value={date}
              onChange={(e) => e.target.value && goTo(e.target.value)}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
            />
          </div>

          {isDesktop && <div className="min-w-[320px] max-w-[440px] flex-1">{weekStrip}</div>}
          {isDesktop && <div className="flex-1" />}
          {isDesktop && todayChip}
          {isDesktop && (
            <Button onClick={() => newReservation(selectedCourtId)} disabled={!selectedCourtId} className="pl-2.5 pr-3.5">
              <Plus className="size-[18px]" aria-hidden /> Nova reserva
            </Button>
          )}
        </div>

        {!isDesktop && <div className="px-2 pb-1 pt-2">{weekStrip}</div>}

        {courts.length > 1 && (
          <div role="tablist" aria-label="Quadras" className="mt-1 flex gap-5 overflow-x-auto px-4 lg:mt-0 lg:gap-6 lg:px-6">
            {courts.map((c) => {
              const on = c.id === selectedCourtId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setCourtSel(c.id)}
                  className={`relative shrink-0 whitespace-nowrap pb-2.5 pt-2 text-sm font-medium ${on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {c.name}
                  {on && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" aria-hidden />}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {data && <PrintDay data={data} date={date} slotMinutes={settings.slotMinutes} venue={settings.courtName} />}
      <div className="no-print pb-24 pl-2 pr-4 pt-3 lg:pb-6 lg:pl-4 lg:pr-6">
        {!data ? (
          <p className="py-10 text-center text-muted-foreground">Carregando agenda…</p>
        ) : courts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-input p-6 text-center text-muted-foreground">Nenhuma quadra cadastrada ainda.</p>
        ) : (
          <DayTimeline
            data={data}
            courts={visibleCourts}
            date={date}
            slotMinutes={settings.slotMinutes}
            nowMin={date === today ? nowMin : null}
            isPast={isPast}
            onItem={openItem}
          />
        )}
        {data && courts.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2 pl-2 lg:pl-[3.75rem]">
            {date <= today && (
              <Button variant="outline" onClick={() => setOverlay({ type: 'closeDay' })} className="shadow-none">
                <ClipboardCheck aria-hidden /> Encerrar o dia
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()} className="shadow-none">
              <Printer aria-hidden /> Imprimir agenda do dia
            </Button>
            <Button variant="outline" onClick={() => setOverlay({ type: 'block', courtId: selectedCourtId })} className="shadow-none">
              <Lock aria-hidden /> Bloquear horário
            </Button>
          </div>
        )}
      </div>

      {/* Nova reserva no celular: botão flutuante no canto inferior direito */}
      {!isDesktop && selectedCourtId && (
        <button
          type="button"
          onClick={() => newReservation(selectedCourtId)}
          className="fab-bottom no-print fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
        >
          <Plus className="size-5" aria-hidden /> Nova reserva
        </button>
      )}

      {overlay?.type === 'form' && <ReservationSheet init={overlay.init} title={overlay.title} onClose={() => setOverlay(null)} />}
      {overlay?.type === 'detail' && (
        <ReservationDetail
          reservationId={overlay.id}
          initial={overlay.initial}
          onClose={() => setOverlay(null)}
          onEdit={() => void editReservation(overlay.id, setOverlay)}
        />
      )}
      {overlay?.type === 'occurrence' && (
        <OccurrenceDetail
          recurrenceId={overlay.recurrenceId}
          date={overlay.date}
          onClose={() => setOverlay(null)}
          onOpenReservation={(id, then) => setOverlay({ type: 'detail', id, initial: then })}
          onReschedule={(rec, d) =>
            setOverlay({
              type: 'form',
              title: 'Remarcar jogo do mensalista',
              init: { mode: 'new', courtId: rec.courtId, date: d, customerId: rec.customerId, duration: rec.endMin - rec.startMin, rescheduleFrom: { recurrenceId: rec.id, date: d } },
            })
          }
        />
      )}
      {overlay?.type === 'block' && (
        <BlockSheet block={overlay.block} defaults={overlay.block ? undefined : { courtId: overlay.courtId, date }} onClose={() => setOverlay(null)} />
      )}
      {overlay?.type === 'closeDay' && <DaySummarySheet date={date} onClose={() => setOverlay(null)} />}
    </>
  );
}

async function editReservation(id: string, setOverlay: (o: Overlay | null) => void) {
  const r: Reservation | undefined = await db.reservations.get(id);
  if (r) setOverlay({ type: 'form', init: { mode: 'edit', reservation: r } });
}
