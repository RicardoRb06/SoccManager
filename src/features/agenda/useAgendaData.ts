/**
 * Dados reativos da agenda para um intervalo de datas (ex.: a semana visível).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../../db/database';
import type { AppSettings, Cents, Court, Customer, ISODate, Payment, PriceRule, Recurrence } from '../../domain/types';
import { prepareSchedule, type Occupant, type PreparedSchedule } from '../../domain/schedule';
import { monthOf } from '../../domain/dates';
import { monthStatus, paidByReservation, reservationVisualState } from '../../domain/payments';
import { occurrencePrice } from '../../domain/recurrence';
import type { VisualState } from '../../components/StateBadge';

export interface AgendaData {
  prep: PreparedSchedule;
  courts: Court[];
  customers: Map<string, Customer>;
  recurrences: Map<string, Recurrence>;
  priceRules: PriceRule[];
  paid: Map<string, Cents>;
  recurrencePayments: Payment[];
}

export function useAgendaData(from: ISODate, to: ISODate, settings: AppSettings): AgendaData | undefined {
  const raw = useLiveQuery(async () => {
    const [courts, reservations, recurrences, blocks, customers, priceRules] = await Promise.all([
      db.courts.orderBy('order').toArray(),
      db.reservations.where('date').between(from, to, true, true).toArray(),
      db.recurrences.toArray(),
      db.blocks.toArray(),
      db.customers.toArray(),
      db.priceRules.toArray(),
    ]);
    const ids = reservations.map((r) => r.id);
    const [resPayments, recPayments] = await Promise.all([
      ids.length ? db.payments.where('reservationId').anyOf(ids).toArray() : Promise.resolve([] as Payment[]),
      db.payments.where('recurrenceId').above('').toArray(),
    ]);
    return { courts, reservations, recurrences, blocks, customers, priceRules, resPayments, recPayments };
  }, [from, to]);

  return useMemo(() => {
    if (!raw) return undefined;
    const activeCourts = raw.courts.filter((c) => c.active);
    return {
      prep: prepareSchedule({
        courts: raw.courts,
        reservations: raw.reservations,
        recurrences: raw.recurrences,
        blocks: raw.blocks,
        openingHours: settings.openingHours,
      }),
      courts: activeCourts,
      customers: new Map(raw.customers.map((c) => [c.id, c])),
      recurrences: new Map(raw.recurrences.map((r) => [r.id, r])),
      priceRules: raw.priceRules,
      paid: paidByReservation(raw.resPayments),
      recurrencePayments: raw.recPayments,
    };
  }, [raw, settings.openingHours]);
}

export interface OccupantView {
  state: VisualState;
  title: string;
  subtitle?: string;
  /** Valor exibido (preço ou "Mensalidade") */
  value?: string | Cents;
  /** Quanto já foi pago (só reservas avulsas); usado para mostrar o sinal */
  paid?: Cents;
  isRecurrence: boolean;
}

/** Como exibir um item ocupado na agenda. */
export function describeOccupant(o: Occupant, data: AgendaData, courtId: string, date: ISODate): OccupantView {
  const courtName = (id: string) => data.prep.courtsById.get(id)?.name ?? 'Outra quadra';
  const customerName = (id: string) => data.customers.get(id)?.name ?? 'Cliente removido';

  if (o.kind === 'bloqueio') {
    return { state: o.courtId !== courtId ? 'outra_quadra' : 'bloqueado', title: o.block.reason || 'Bloqueado', subtitle: o.courtId !== courtId ? courtName(o.courtId) : undefined, isRecurrence: false };
  }
  if (o.kind === 'fechado') return { state: 'bloqueado', title: 'Fechado', isRecurrence: false };

  const shared = o.courtId !== courtId;
  const customerId = o.kind === 'reserva' ? o.reservation.customerId : o.occurrence.customerId;
  const recId = o.kind === 'reserva' ? o.reservation.recurrenceId : o.occurrence.recurrenceId;
  const rec = recId ? data.recurrences.get(recId) : undefined;
  const title = customerName(customerId);
  const team = rec?.notes;
  const subtitle = shared ? `Em uso na ${courtName(o.courtId)}` : team;

  if (shared) return { state: 'outra_quadra', title, subtitle, isRecurrence: !!rec };

  if (o.kind === 'reserva') {
    const r = o.reservation;
    if (rec?.billingMode === 'mensal' && r.status !== 'falta') {
      const ms = monthStatus(rec, data.recurrencePayments, monthOf(date));
      return { state: ms.emDia ? 'mensal_ok' : 'mensal_devendo', title, subtitle, value: 'Mensalidade', isRecurrence: true };
    }
    const paid = data.paid.get(r.id) ?? 0;
    const v = reservationVisualState(r, paid);
    const state: VisualState = v === 'livre' || v === 'mensalidade' || v === 'bloqueado' ? 'pendente' : v;
    return { state, title, subtitle, value: r.price, paid, isRecurrence: !!rec };
  }

  // ocorrência virtual de mensalista
  if (rec?.billingMode === 'mensal') {
    const ms = monthStatus(rec, data.recurrencePayments, monthOf(date));
    return { state: ms.emDia ? 'mensal_ok' : 'mensal_devendo', title, subtitle, value: 'Mensalidade', isRecurrence: true };
  }
  return { state: 'pendente', title, subtitle, value: rec ? occurrencePrice(rec, data.priceRules, date) : undefined, isRecurrence: true };
}
