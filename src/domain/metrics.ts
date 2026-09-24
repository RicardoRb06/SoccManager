/**
 * Métricas do Resumo.
 *
 * A análise é feita por "slots" (granularidade slotMinutes) dentro do expediente:
 *  - ocupado: reserva (ativa ou falta) ou mensalista NA PRÓPRIA quadra
 *  - indisponível: bloqueio, ou ocupado por outra quadra do mesmo espaço físico
 *  - livre: nada acima
 * Taxa de ocupação, mapa de calor e horas vazias consideram apenas slots JÁ PASSADOS
 * do período (não faz sentido chamar de "vazio" um horário que ainda pode ser vendido).
 */
import type { Cents, Customer, ISODate, ISOMonth, Minutes, Payment, PriceRule, Recurrence, Reservation } from './types';
import { dateRange, isoDateTimeToLocalDate, monthOf, monthRange, weekdayOf } from './dates';
import { hoursOn, itemsOnDate, relatedCourtIds, reservationOccupies, virtualOccurrencesOn, type PreparedSchedule } from './schedule';
import { priceFor } from './pricing';
import { overlaps } from './time';
import { occurrencePrice } from './recurrence';
import { monthStatus, billableMonths, paidByReservation, reservationBalance } from './payments';

export interface Period {
  from: ISODate;
  to: ISODate;
}

export type SlotKind = 'ocupado' | 'indisponivel' | 'livre';

export interface SlotInfo {
  date: ISODate;
  courtId: string;
  startMin: Minutes;
  endMin: Minutes;
  kind: SlotKind;
  past: boolean;
}

/** Classifica todos os slots das quadras ativas no período. */
export function classifySlots(
  prep: PreparedSchedule,
  period: Period,
  slotMinutes: number,
  today: ISODate,
  nowMin: Minutes,
): SlotInfo[] {
  const out: SlotInfo[] = [];
  const courts = prep.data.courts.filter((c) => c.active);
  for (const date of dateRange(period.from, period.to)) {
    const h = hoursOn(prep.data.openingHours, date);
    if (!h) continue;
    const allItems = itemsOnDate(prep, date);
    for (const court of courts) {
      const related = new Set(relatedCourtIds(prep.data.courts, court.id));
      const items = allItems.filter((o) => related.has(o.courtId));
      for (let s = h.open; s + slotMinutes <= h.close; s += slotMinutes) {
        const e = s + slotMinutes;
        const hits = items.filter((o) => overlaps(o.startMin, o.endMin, s, e));
        let kind: SlotKind = 'livre';
        if (hits.some((o) => o.courtId === court.id && (o.kind === 'reserva' || o.kind === 'mensalista'))) kind = 'ocupado';
        else if (hits.length > 0) kind = 'indisponivel';
        const past = date < today || (date === today && e <= nowMin);
        out.push({ date, courtId: court.id, startMin: s, endMin: e, kind, past });
      }
    }
  }
  return out;
}

export interface HeatCell {
  weekday: number;
  hour: number; // hora cheia de início (ex.: 16 = 16:00–17:00)
  occupied: number;
  total: number;
  ratio: number; // 0..1
}

export function heatmap(slots: SlotInfo[]): HeatCell[] {
  const map = new Map<string, HeatCell>();
  for (const s of slots) {
    if (!s.past || s.kind === 'indisponivel') continue;
    const weekday = weekdayOf(s.date);
    const hour = Math.floor(s.startMin / 60);
    const key = `${weekday}|${hour}`;
    let cell = map.get(key);
    if (!cell) {
      cell = { weekday, hour, occupied: 0, total: 0, ratio: 0 };
      map.set(key, cell);
    }
    cell.total++;
    if (s.kind === 'ocupado') cell.occupied++;
  }
  const cells = [...map.values()];
  for (const c of cells) c.ratio = c.total ? c.occupied / c.total : 0;
  return cells.sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
}

/** Os N piores horários (menor ocupação), ignorando células com poucas amostras. */
export function worstCells(cells: HeatCell[], n = 3, minSamples = 2): HeatCell[] {
  return cells
    .filter((c) => c.total >= minSamples)
    .sort((a, b) => a.ratio - b.ratio || b.total - a.total || a.weekday - b.weekday || a.hour - b.hour)
    .slice(0, n);
}

export interface EmptyHours {
  minutes: number;
  hours: number;
  value: Cents;
}

/** Horas vazias já passadas e o valor que deixaram de render pela tabela de preços. */
export function emptyHours(slots: SlotInfo[], rules: PriceRule[]): EmptyHours {
  let minutes = 0;
  let value = 0;
  for (const s of slots) {
    if (!s.past || s.kind !== 'livre') continue;
    minutes += s.endMin - s.startMin;
    value += priceFor(rules, s.courtId, s.date, s.startMin, s.endMin);
  }
  return { minutes, hours: minutes / 60, value };
}

export function occupancyRate(slots: SlotInfo[]): { rate: number; occupied: number; available: number } {
  let occupied = 0;
  let available = 0;
  for (const s of slots) {
    if (!s.past || s.kind === 'indisponivel') continue;
    available++;
    if (s.kind === 'ocupado') occupied++;
  }
  return { rate: available ? occupied / available : 0, occupied, available };
}

/** Faturamento recebido: pagamentos cuja data (local) cai no período. */
export function receivedInPeriod(payments: Payment[], period: Period): Cents {
  let sum = 0;
  for (const p of payments) {
    const d = isoDateTimeToLocalDate(p.paidAt);
    if (d >= period.from && d <= period.to) sum += p.amount;
  }
  return sum;
}

export type ReceivableItem =
  | { kind: 'reserva'; customerId: string; date: ISODate; amount: Cents; reservation: Reservation }
  | { kind: 'ocorrencia'; customerId: string; date: ISODate; amount: Cents; recurrenceId: string }
  | { kind: 'mensalidade'; customerId: string; month: ISOMonth; amount: Cents; recurrenceId: string };

/**
 * "A receber": jogos já realizados (até agora) dentro do período com saldo,
 * ocorrências por jogo não materializadas (não pagas) e mensalidades em aberto
 * dos meses do período até o mês atual.
 */
export function receivables(
  prep: PreparedSchedule,
  payments: Payment[],
  rules: PriceRule[],
  period: Period,
  today: ISODate,
  nowMin: Minutes = 1440,
): ReceivableItem[] {
  const out: ReceivableItem[] = [];
  const paid = paidByReservation(payments);
  const until = period.to < today ? period.to : today;
  const recById = new Map(prep.data.recurrences.map((r) => [r.id, r]));

  if (period.from <= until) {
    for (const date of dateRange(period.from, until)) {
      for (const r of prep.reservationsByDate.get(date) ?? []) {
        if (!reservationOccupies(r)) continue;
        if (date === today && r.endMin > nowMin) continue;
        const rec = r.recurrenceId ? recById.get(r.recurrenceId) : undefined;
        if (rec?.billingMode === 'mensal') continue;
        const bal = reservationBalance(r, paid.get(r.id) ?? 0);
        if (bal > 0) out.push({ kind: 'reserva', customerId: r.customerId, date, amount: bal, reservation: r });
      }
      for (const occ of virtualOccurrencesOn(prep, date)) {
        const rec = recById.get(occ.recurrenceId);
        if (!rec || rec.billingMode === 'mensal') continue;
        if (date === today && occ.endMin > nowMin) continue;
        const amount = occurrencePrice(rec, rules, date);
        if (amount > 0) out.push({ kind: 'ocorrencia', customerId: occ.customerId, date, amount, recurrenceId: rec.id });
      }
    }
  }

  const currentMonth = monthOf(today);
  const months = monthRange(monthOf(period.from), monthOf(period.to)).filter((m) => m <= currentMonth);
  for (const rec of prep.data.recurrences) {
    if (rec.billingMode !== 'mensal') continue;
    const billable = new Set(billableMonths(rec, currentMonth));
    for (const m of months) {
      if (!billable.has(m)) continue;
      const st = monthStatus(rec, payments, m);
      if (st.balance > 0) out.push({ kind: 'mensalidade', customerId: rec.customerId, month: m, amount: st.balance, recurrenceId: rec.id });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export function faltasInPeriod(reservations: Reservation[], period: Period): number {
  return reservations.filter((r) => !r.deletedAt && r.status === 'falta' && r.date >= period.from && r.date <= period.to).length;
}

export interface CustomerRank {
  customerId: string;
  total: Cents;
  games: number;
}

/** Top clientes por valor pago no período. */
export function topCustomers(
  prep: PreparedSchedule,
  payments: Payment[],
  period: Period,
  n = 5,
): CustomerRank[] {
  const resById = new Map(prep.data.reservations.map((r) => [r.id, r]));
  const recById = new Map(prep.data.recurrences.map((r) => [r.id, r]));
  const totals = new Map<string, CustomerRank>();
  const get = (id: string) => {
    let row = totals.get(id);
    if (!row) {
      row = { customerId: id, total: 0, games: 0 };
      totals.set(id, row);
    }
    return row;
  };
  for (const p of payments) {
    const d = isoDateTimeToLocalDate(p.paidAt);
    if (d < period.from || d > period.to) continue;
    const customerId = p.reservationId ? resById.get(p.reservationId)?.customerId : p.recurrenceId ? recById.get(p.recurrenceId)?.customerId : undefined;
    if (customerId) get(customerId).total += p.amount;
  }
  for (const date of dateRange(period.from, period.to)) {
    for (const o of itemsOnDate(prep, date)) {
      const customerId = o.kind === 'reserva' ? o.reservation.customerId : o.kind === 'mensalista' ? o.occurrence.customerId : null;
      const row = customerId ? totals.get(customerId) : undefined;
      if (row) row.games++;
    }
  }
  return [...totals.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, n);
}

/** Débito total por cliente (a receber até hoje, sem limite de período). */
export function debtByCustomer(
  prep: PreparedSchedule,
  payments: Payment[],
  rules: PriceRule[],
  today: ISODate,
  nowMin: Minutes,
  customers: Customer[],
): Map<string, Cents> {
  const earliest = prep.data.reservations.reduce((min, r) => (r.date < min ? r.date : min), today);
  const recEarliest = prep.data.recurrences.reduce((min, r) => (r.startDate < min ? r.startDate : min), earliest);
  const items = receivables(prep, payments, rules, { from: recEarliest, to: today }, today, nowMin);
  const map = new Map<string, Cents>(customers.map((c) => [c.id, 0]));
  for (const it of items) map.set(it.customerId, (map.get(it.customerId) ?? 0) + it.amount);
  return map;
}

/** Utilitário para mensalistas: ativos no período? */
export function activeRecurrences(recurrences: Recurrence[]): Recurrence[] {
  return recurrences.filter((r) => r.status === 'ativo');
}
