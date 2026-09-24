/**
 * Exportação CSV para abrir no Excel (pt-BR): separador ";", UTF-8 com BOM,
 * números com vírgula decimal e datas dd/MM/aaaa.
 */
import type { Court, Customer, Payment, PriceRule, Recurrence, Reservation } from './types';
import { dateRange, formatDateBR, isoDateTimeToLocalDate } from './dates';
import { minToHHMM } from './time';
import type { Period } from './metrics';
import { virtualOccurrencesOn, type PreparedSchedule } from './schedule';
import { occurrencePrice } from './recurrence';
import { paidByReservation, reservationBalance } from './payments';

export const BOM = '﻿';

function cell(v: string | number): string {
  const s = typeof v === 'number' ? String(v) : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Array<Array<string | number>>): string {
  return BOM + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** 12050 → "120,50" (sem símbolo, para o Excel somar) */
export function centsCSV(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}

const STATUS: Record<Reservation['status'], string> = { ativa: 'Ativa', cancelada: 'Cancelada', falta: 'Falta' };
const METHOD: Record<Payment['method'], string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', outro: 'Outro' };

export interface CsvLookups {
  customers: Map<string, Customer>;
  courts: Map<string, Court>;
  recurrences: Map<string, Recurrence>;
  rules: PriceRule[];
}

export function reservationsCSV(prep: PreparedSchedule, payments: Payment[], period: Period, lk: CsvLookups): string {
  const paid = paidByReservation(payments);
  const rows: Array<Array<string | number>> = [
    ['Data', 'Início', 'Fim', 'Quadra', 'Cliente', 'Telefone', 'Tipo', 'Situação', 'Valor (R$)', 'Pago (R$)', 'Saldo (R$)', 'Observações'],
  ];
  for (const date of dateRange(period.from, period.to)) {
    const list: Array<{ start: number; row: Array<string | number> }> = [];
    for (const r of prep.reservationsByDate.get(date) ?? []) {
      if (r.deletedAt) continue;
      const c = lk.customers.get(r.customerId);
      const rec = r.recurrenceId ? lk.recurrences.get(r.recurrenceId) : undefined;
      const p = paid.get(r.id) ?? 0;
      list.push({
        start: r.startMin,
        row: [
          formatDateBR(date), minToHHMM(r.startMin), minToHHMM(r.endMin), lk.courts.get(r.courtId)?.name ?? '', c?.name ?? '', c?.phone ?? '',
          rec ? `Mensalista${rec.notes ? ` (${rec.notes})` : ''}` : 'Avulsa', STATUS[r.status],
          centsCSV(r.price), centsCSV(p), centsCSV(reservationBalance(r, p)), [r.notes, r.cancelReason].filter(Boolean).join(' / '),
        ],
      });
    }
    for (const occ of virtualOccurrencesOn(prep, date)) {
      const rec = lk.recurrences.get(occ.recurrenceId);
      const c = lk.customers.get(occ.customerId);
      const price = rec ? occurrencePrice(rec, lk.rules, date) : 0;
      list.push({
        start: occ.startMin,
        row: [
          formatDateBR(date), minToHHMM(occ.startMin), minToHHMM(occ.endMin), lk.courts.get(occ.courtId)?.name ?? '', c?.name ?? '', c?.phone ?? '',
          `Mensalista${rec?.notes ? ` (${rec.notes})` : ''}`, rec?.billingMode === 'mensal' ? 'Mensalidade' : 'Ativa',
          centsCSV(price), centsCSV(0), centsCSV(price), '',
        ],
      });
    }
    list.sort((a, b) => a.start - b.start).forEach((x) => rows.push(x.row));
  }
  return toCSV(rows);
}

export function paymentsCSV(payments: Payment[], reservations: Reservation[], period: Period, lk: CsvLookups): string {
  const resById = new Map(reservations.map((r) => [r.id, r]));
  const rows: Array<Array<string | number>> = [['Data do pagamento', 'Hora', 'Cliente', 'Referência', 'Forma', 'Valor (R$)', 'Observação']];
  const list = payments
    .filter((p) => {
      const d = isoDateTimeToLocalDate(p.paidAt);
      return d >= period.from && d <= period.to;
    })
    .sort((a, b) => (a.paidAt < b.paidAt ? -1 : 1));
  for (const p of list) {
    const at = new Date(p.paidAt);
    const r = p.reservationId ? resById.get(p.reservationId) : undefined;
    const rec = p.recurrenceId ? lk.recurrences.get(p.recurrenceId) : undefined;
    const customerId = r?.customerId ?? rec?.customerId;
    const ref = r
      ? `Jogo ${formatDateBR(r.date)} ${minToHHMM(r.startMin)} · ${lk.courts.get(r.courtId)?.name ?? ''}`
      : p.referenceMonth
        ? `Mensalidade ${p.referenceMonth.slice(5)}/${p.referenceMonth.slice(0, 4)}${rec?.notes ? ` (${rec.notes})` : ''}`
        : '';
    rows.push([
      formatDateBR(isoDateTimeToLocalDate(p.paidAt)),
      `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
      customerId ? (lk.customers.get(customerId)?.name ?? '') : '',
      ref,
      METHOD[p.method],
      centsCSV(p.amount),
      p.note ?? '',
    ]);
  }
  return toCSV(rows);
}

/** "arena-modelo" */
export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quadra';
}
