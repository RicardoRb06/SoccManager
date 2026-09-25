/**
 * Agenda (tela inicial).
 * Cabeçalho: a data aparece uma vez só (o título abre o calendário), faixa da semana, "+ Reserva" e menu ⋯.
 * Corpo: linha do tempo. Celular mostra uma quadra por vez (abas); desktop mostra todas lado a lado.
 */
import { useRef, useState } from 'react';
import { ChevronDown, ClipboardCheck, Lock, MoreHorizontal, Plus, Printer } from 'lucide-react';
import { db } from '../../db/database';
import { useSettings } from '../../db/hooks';
import type { Block, ISODate, Minutes, Reservation } from '../../domain/types';
import { addDays, diffDays, isISODate, MONTH_LONG, nowMinutes, parseISODate, todayISO, WEEKDAY_LONG, weekDates, weekdayOf } from '../../domain/dates';
import type { Occupant } from '../../domain/schedule';
import { CourtBadge } from '../../components/AppShell';
import { Button } from '../../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
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
  const visibleCourts = isDesktop ? courts : courts.filter((c) => c.id === selectedCourtId);

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
    />
  );

  return (
    <>
      <header className="pt-safe no-print sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2.5 px-4 pt-3 lg:gap-6 lg:px-6 lg:py-3">
          <div className="lg:hidden">
            <CourtBadge size={28} />
          </div>
          <div className="relative min-w-0 flex-1 lg:flex-none">
            <p className="truncate text-xs text-muted-foreground lg:hidden">{settings.courtName}</p>
            <h1>
              <button
                type="button"
                onClick={openDatePicker}
                aria-label={`${dayTitle(date, today, false)}. Escolher outra data`}
                className="-mx-1 flex max-w-full items-center gap-1 rounded-md px-1 text-left text-[19px] font-semibold leading-tight tracking-tight hover:bg-accent lg:text-xl"
              >
                <span className="truncate">{dayTitle(date, today, !isDesktop)}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </h1>
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

          {isDesktop && <div className="w-[440px] shrink-0">{weekStrip}</div>}
          {isDesktop && <div className="flex-1" />}

          {date !== today && (
            <Button variant="ghost" onClick={() => goTo(today)} className="px-3">
              Hoje
            </Button>
          )}

          {data && courts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações do dia" className="shadow-none">
                  <MoreHorizontal className="size-5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {date <= today && (
                  <DropdownMenuItem onSelect={() => setOverlay({ type: 'closeDay' })}>
                    <ClipboardCheck aria-hidden /> Encerrar o dia
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => window.print()}>
                  <Printer aria-hidden /> Imprimir agenda do dia
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setOverlay({ type: 'block', courtId: selectedCourtId })}>
                  <Lock aria-hidden /> Bloquear horário
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button onClick={() => newReservation(selectedCourtId)} disabled={!selectedCourtId} className="pl-2.5 pr-3.5">
            <Plus className="size-[18px]" aria-hidden />
            {isDesktop ? 'Nova reserva' : 'Reserva'}
          </Button>
        </div>

        {!isDesktop && <div className="px-2 pb-1 pt-3">{weekStrip}</div>}

        {!isDesktop && courts.length > 1 && (
          <div role="tablist" aria-label="Quadras" className="mt-1 flex gap-5 overflow-x-auto px-4">
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
      <div className="no-print py-3 pl-2 pr-4 lg:pl-4 lg:pr-6">
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
            showHeaders={isDesktop}
            onFree={(courtId, start) => newReservation(courtId, start)}
            onItem={openItem}
          />
        )}
      </div>

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
