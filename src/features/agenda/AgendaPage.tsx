/**
 * Agenda (tela inicial).
 * Celular: chips de quadra + lista de horários. Desktop (≥1024px): quadras lado a lado.
 */
import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Plus, Printer } from 'lucide-react';
import { db } from '../../db/database';
import { useSettings } from '../../db/hooks';
import type { Block, ISODate, Minutes, Reservation } from '../../domain/types';
import { addDays, diffDays, formatDayMonth, isISODate, MONTH_LONG, nowMinutes, parseISODate, todayISO, WEEKDAY_LONG, weekDates, weekdayOf } from '../../domain/dates';
import type { Occupant } from '../../domain/schedule';
import { CourtBadge } from '../../components/AppShell';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { navigate } from '../../utils/router';
import { useIsDesktop, useNow } from '../../utils/hooks';
import { useAgendaData } from './useAgendaData';
import { WeekStrip } from './WeekStrip';
import { DayColumn } from './DayColumn';
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
  | { type: 'block'; block: Block }
  | { type: 'closeDay' };

function relativeLabel(date: ISODate, today: ISODate): string | null {
  const d = diffDays(today, date);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d === -1) return 'Ontem';
  return null;
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

  const courts = data?.courts ?? [];
  const selectedCourtId = courts.find((c) => c.id === courtSel)?.id ?? courts[0]?.id;
  const visibleCourts = isDesktop ? courts : courts.filter((c) => c.id === selectedCourtId);

  const goTo = (d: ISODate) => navigate(`/agenda/${d}`, { replace: true });
  const nowMin = nowMinutes(now);
  const isPast = (endMin: Minutes) => date < today || (date === today && endMin <= nowMin);

  const { d: dayNum, m } = parseISODate(date);
  const rel = relativeLabel(date, today);

  function openItem(o: Occupant) {
    if (o.kind === 'reserva') setOverlay({ type: 'detail', id: o.reservation.id });
    else if (o.kind === 'mensalista') setOverlay({ type: 'occurrence', recurrenceId: o.occurrence.recurrenceId, date: o.occurrence.date });
    else if (o.kind === 'bloqueio') setOverlay({ type: 'block', block: o.block });
  }

  function newReservation(courtId: string | undefined, startMin?: Minutes) {
    if (!courtId) return;
    setOverlay({ type: 'form', init: { mode: 'new', courtId, date, startMin } });
  }

  return (
    <>
      <header className="pt-safe no-print sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <div className="lg:hidden">
            <CourtBadge size={36} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-muted-foreground lg:hidden">{settings.courtName}</p>
            <h1 className="truncate text-lg font-bold leading-tight first-letter:uppercase">
              {rel ?? WEEKDAY_LONG[weekdayOf(date)]}, {dayNum} de {MONTH_LONG[m - 1]}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3 lg:max-w-lg">
          <button type="button" aria-label="Dia anterior" onClick={() => goTo(addDays(date, -1))} className="grid size-11 place-items-center rounded-xl border border-input bg-card hover:bg-accent">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <label className="relative flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 text-sm font-semibold hover:bg-accent">
            <CalendarDays className="size-4 text-brand" aria-hidden />
            <span>{formatDayMonth(date)}</span>
            <span className="sr-only">Escolher data</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && goTo(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Escolher data"
            />
          </label>
          <button type="button" aria-label="Próximo dia" onClick={() => goTo(addDays(date, 1))} className="grid size-11 place-items-center rounded-xl border border-input bg-card hover:bg-accent">
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => goTo(today)}
            disabled={date === today}
            className="min-h-11 rounded-lg bg-brand-soft px-4 text-sm font-semibold text-brand-strong disabled:opacity-50"
          >
            Hoje
          </button>
        </div>
        <div className="px-4 pb-3">
          <WeekStrip dates={week} selected={date} today={today} prep={data?.prep} slotMinutes={settings.slotMinutes} onSelect={goTo} />
        </div>
        {!isDesktop && courts.length > 1 && (
          <Tabs value={selectedCourtId ?? ''} onValueChange={setCourtSel} className="px-4 pb-3">
            <TabsList aria-label="Quadras" className="w-full">
              {courts.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </header>

      {data && <PrintDay data={data} date={date} slotMinutes={settings.slotMinutes} venue={settings.courtName} />}
      <div className="no-print p-4">
        {!data ? (
          <p className="py-10 text-center text-muted-foreground">Carregando agenda…</p>
        ) : courts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">Nenhuma quadra cadastrada ainda.</p>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${visibleCourts.length}, minmax(0, 1fr))` }}>
            {visibleCourts.map((c) => (
              <section key={c.id} aria-label={c.name}>
                {isDesktop && <h2 className="mb-2 font-semibold text-foreground/85">{c.name}</h2>}
                <DayColumn
                  data={data}
                  courtId={c.id}
                  date={date}
                  slotMinutes={settings.slotMinutes}
                  isPast={isPast}
                  onFree={(start) => newReservation(c.id, start)}
                  onItem={openItem}
                />
              </section>
            ))}
          </div>
        )}
        {data && courts.length > 0 && (
          <div className="no-print mt-4 flex flex-wrap gap-2">
            {date <= today && (
            <button
              type="button"
              onClick={() => setOverlay({ type: 'closeDay' })}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-semibold text-foreground/85 hover:bg-accent"
            >
              <ClipboardCheck className="size-4 text-brand" aria-hidden /> Encerrar o dia
            </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-semibold text-foreground/85 hover:bg-accent"
            >
              <Printer className="size-4 text-brand" aria-hidden /> Imprimir agenda do dia
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => newReservation(selectedCourtId)}
        className="fab-bottom no-print fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-white shadow-lg hover:bg-primary/90 lg:right-8"
      >
        <Plus className="size-5" aria-hidden /> Nova reserva
      </button>

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
      {overlay?.type === 'block' && <BlockSheet block={overlay.block} onClose={() => setOverlay(null)} />}
      {overlay?.type === 'closeDay' && <DaySummarySheet date={date} onClose={() => setOverlay(null)} />}
    </>
  );
}

async function editReservation(id: string, setOverlay: (o: Overlay | null) => void) {
  const r: Reservation | undefined = await db.reservations.get(id);
  if (r) setOverlay({ type: 'form', init: { mode: 'edit', reservation: r } });
}
