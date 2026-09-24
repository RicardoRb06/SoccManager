/**
 * Agenda (tela inicial).
 * Celular: chips de quadra + lista de horários. Desktop (≥1024px): quadras lado a lado.
 */
import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { db } from '../../db/database';
import { useSettings } from '../../db/hooks';
import type { Block, ISODate, Minutes, Reservation } from '../../domain/types';
import { addDays, diffDays, formatDayMonth, isISODate, MONTH_LONG, nowMinutes, parseISODate, todayISO, WEEKDAY_LONG, weekDates, weekdayOf } from '../../domain/dates';
import type { Occupant } from '../../domain/schedule';
import { CourtBadge } from '../../components/AppShell';
import { Chip } from '../../components/ui/controls';
import { navigate } from '../../utils/router';
import { useIsDesktop, useNow } from '../../utils/hooks';
import { useAgendaData } from './useAgendaData';
import { WeekStrip } from './WeekStrip';
import { DayColumn } from './DayColumn';
import { ReservationSheet, type ReservationSheetInit } from './ReservationSheet';
import { ReservationDetail } from './ReservationDetail';
import { OccurrenceDetail } from './OccurrenceDetail';
import { BlockSheet } from '../mais/BlockSheet';

type Overlay =
  | { type: 'form'; init: ReservationSheetInit }
  | { type: 'detail'; id: string }
  | { type: 'occurrence'; recurrenceId: string; date: ISODate }
  | { type: 'block'; block: Block };

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
      <header className="pt-safe no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <div className="lg:hidden">
            <CourtBadge size={36} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-500 lg:hidden">{settings.courtName}</p>
            <h1 className="truncate text-lg font-bold leading-tight first-letter:uppercase">
              {rel ?? WEEKDAY_LONG[weekdayOf(date)]}, {dayNum} de {MONTH_LONG[m - 1]}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3 lg:max-w-lg">
          <button type="button" aria-label="Dia anterior" onClick={() => goTo(addDays(date, -1))} className="grid size-11 place-items-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <label className="relative flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50">
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
          <button type="button" aria-label="Próximo dia" onClick={() => goTo(addDays(date, 1))} className="grid size-11 place-items-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50">
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => goTo(today)}
            disabled={date === today}
            className="min-h-11 rounded-xl bg-brand-soft px-4 text-sm font-semibold text-brand-strong disabled:opacity-50"
          >
            Hoje
          </button>
        </div>
        <div className="px-4 pb-3">
          <WeekStrip dates={week} selected={date} today={today} prep={data?.prep} slotMinutes={settings.slotMinutes} onSelect={goTo} />
        </div>
        {!isDesktop && courts.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3" role="group" aria-label="Quadras">
            {courts.map((c) => (
              <Chip key={c.id} selected={c.id === selectedCourtId} onClick={() => setCourtSel(c.id)} className="shrink-0">
                {c.name}
              </Chip>
            ))}
          </div>
        )}
      </header>

      <div className="p-4">
        {!data ? (
          <p className="py-10 text-center text-slate-500">Carregando agenda…</p>
        ) : courts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">Nenhuma quadra cadastrada ainda.</p>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${visibleCourts.length}, minmax(0, 1fr))` }}>
            {visibleCourts.map((c) => (
              <section key={c.id} aria-label={c.name}>
                {isDesktop && <h2 className="mb-2 font-semibold text-slate-700">{c.name}</h2>}
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
      </div>

      <button
        type="button"
        onClick={() => newReservation(selectedCourtId)}
        className="fab-bottom no-print fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-white shadow-lg hover:bg-brand-strong lg:right-8"
      >
        <Plus className="size-5" aria-hidden /> Nova reserva
      </button>

      {overlay?.type === 'form' && <ReservationSheet init={overlay.init} onClose={() => setOverlay(null)} />}
      {overlay?.type === 'detail' && (
        <ReservationDetail
          reservationId={overlay.id}
          onClose={() => setOverlay(null)}
          onEdit={() => void editReservation(overlay.id, setOverlay)}
        />
      )}
      {overlay?.type === 'occurrence' && <OccurrenceDetail recurrenceId={overlay.recurrenceId} date={overlay.date} onClose={() => setOverlay(null)} />}
      {overlay?.type === 'block' && <BlockSheet block={overlay.block} onClose={() => setOverlay(null)} />}
    </>
  );
}

async function editReservation(id: string, setOverlay: (o: Overlay | null) => void) {
  const r: Reservation | undefined = await db.reservations.get(id);
  if (r) setOverlay({ type: 'form', init: { mode: 'edit', reservation: r } });
}
