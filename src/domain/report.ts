/**
 * Relatório do Resumo: períodos, KPIs, horas vazias, mapa de calor e sugestões.
 * Tudo puro (sem React/Dexie) para ser testável.
 */
import type { Cents, Court, ISODate, Payment, PriceRule } from './types';
import { addDays, addMonths, firstDayOfMonth, lastDayOfMonth, monthOf, WEEKDAY_LONG, weekdayOf } from './dates';
import {
  classifySlots, emptyHours, faltasInPeriod, heatmap, occupancyRate, receivables, receivedInPeriod, topCustomers, worstCells,
  type CustomerRank, type EmptyHours, type HeatCell, type Period, type ReceivableItem,
} from './metrics';
import type { PreparedSchedule } from './schedule';
import { priceFor } from './pricing';

export type PeriodKind = 'mes_atual' | 'ultimos_30' | 'mes_anterior';

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  mes_atual: 'Mês atual',
  ultimos_30: 'Últimos 30 dias',
  mes_anterior: 'Mês anterior',
};

export function periodFor(kind: PeriodKind, today: ISODate): Period {
  const month = monthOf(today);
  if (kind === 'mes_atual') return { from: firstDayOfMonth(month), to: lastDayOfMonth(month) };
  if (kind === 'ultimos_30') return { from: addDays(today, -29), to: today };
  const prev = addMonths(month, -1);
  return { from: firstDayOfMonth(prev), to: lastDayOfMonth(prev) };
}

export interface Promotion {
  cell: HeatCell;
  label: string; // "terça, 16h–17h"
  /** preço médio atual por hora nesse horário (quadras ativas) */
  currentPrice: Cents;
  /** sugestão: 25% de desconto, arredondado para R$ 5 */
  suggestedPrice: Cents;
}

export interface Report {
  period: Period;
  received: Cents;
  receivable: Cents;
  receivables: ReceivableItem[];
  occupancy: { rate: number; occupied: number; available: number };
  faltas: number;
  empty: EmptyHours;
  heat: HeatCell[];
  promotions: Promotion[];
  top: CustomerRank[];
}

/** Uma data do período (ou a mais recente antes dele) com o dia da semana pedido — para consultar preço. */
function sampleDate(period: Period, weekday: number): ISODate {
  let d = period.from;
  for (let i = 0; i < 7; i++) {
    if (weekdayOf(d) === weekday) return d;
    d = addDays(d, 1);
  }
  return period.from;
}

export function buildReport(
  prep: PreparedSchedule,
  payments: Payment[],
  rules: PriceRule[],
  period: Period,
  slotMinutes: number,
  today: ISODate,
  nowMin: number,
): Report {
  const slots = classifySlots(prep, period, slotMinutes, today, nowMin);
  const heat = heatmap(slots);
  const recv = receivables(prep, payments, rules, period, today, nowMin);
  const courts = prep.data.courts.filter((c) => c.active);
  const promotions = worstCells(heat, 3, 2).map((cell) => promotionFor(cell, courts, rules, sampleDate(period, cell.weekday)));
  return {
    period,
    received: receivedInPeriod(payments, period),
    receivable: recv.reduce((a, i) => a + i.amount, 0),
    receivables: recv,
    occupancy: occupancyRate(slots),
    faltas: faltasInPeriod(prep.data.reservations, period),
    empty: emptyHours(slots, rules),
    heat,
    promotions,
    top: topCustomers(prep, payments, period, 5),
  };
}

export function promotionFor(cell: HeatCell, courts: Court[], rules: PriceRule[], date: ISODate): Promotion {
  const start = cell.hour * 60;
  const prices = courts.map((c) => priceFor(rules, c.id, date, start, start + 60)).filter((p) => p > 0);
  const current = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const suggested = Math.max(500, Math.round((current * 0.75) / 500) * 500);
  return {
    cell,
    label: `${WEEKDAY_LONG[cell.weekday]}, ${cell.hour}h–${cell.hour + 1}h`,
    currentPrice: current,
    suggestedPrice: current ? Math.min(suggested, current) : 0,
  };
}
