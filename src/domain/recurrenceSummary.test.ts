import { describe, expect, it } from 'vitest';
import { endRecurrence, pauseRecurrence, recurrenceSummary, resumeRecurrence } from './recurrenceSummary';
import { occurrenceDates } from './recurrence';
import type { Payment } from './types';
import { NOW, RULES, rec, res, schedule } from '../test/fixtures';

// terças a partir de 01/09/2026
const R = rec({ id: 'm', weekday: 2, startMin: 1200, endMin: 1260, startDate: '2026-09-01' });

describe('pausar, retomar e encerrar mensalista', () => {
  it('pausar mantém o histórico e para de gerar', () => {
    const p = pauseRecurrence(R, '2026-09-10', NOW);
    expect(occurrenceDates(p, '2026-09-01', '2026-10-31')).toEqual(['2026-09-01', '2026-09-08']);
  });

  it('retomar não ressuscita as datas do período pausado', () => {
    const p = pauseRecurrence(R, '2026-09-10', NOW);
    const r = resumeRecurrence(p, '2026-09-25', NOW);
    expect(r.status).toBe('ativo');
    expect(r.pausedAt).toBeUndefined();
    expect(r.skipDates).toEqual(['2026-09-15', '2026-09-22']);
    expect(occurrenceDates(r, '2026-09-01', '2026-10-06')).toEqual(['2026-09-01', '2026-09-08', '2026-09-29', '2026-10-06']);
  });

  it('encerrar gera só até a data final', () => {
    const e = endRecurrence(R, '2026-09-16', NOW);
    expect(e.status).toBe('encerrado');
    expect(occurrenceDates(e, '2026-09-01', '2026-12-31')).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
  });

  it('encerrar um pausado mantém o período pausado vazio', () => {
    const e = endRecurrence(pauseRecurrence(R, '2026-09-10', NOW), '2026-09-30', NOW);
    expect(occurrenceDates(e, '2026-09-01', '2026-12-31')).toEqual(['2026-09-01', '2026-09-08']);
  });
});

describe('resumo do mensalista', () => {
  const pay = (p: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({ method: 'pix', paidAt: '2026-09-02T15:00:00.000Z', ...p });

  it('por jogo: débito = jogos passados não pagos (virtuais e materializados com saldo)', () => {
    const s = schedule({
      recurrences: [R],
      reservations: [res({ id: 'x', date: '2026-09-08', startMin: 1200, endMin: 1260, recurrenceId: 'm', price: 12000 })],
    });
    const payments = [pay({ id: 'p', reservationId: 'x', amount: 2000 })];
    const sum = recurrenceSummary(R, s, payments, RULES, '2026-09-16', 0);
    // 01/09 virtual (120) + 08/09 saldo (100) + 15/09 virtual (120)
    expect(sum.debt).toBe(12000 + 10000 + 12000);
    expect(sum.nextDates).toEqual(['2026-09-22', '2026-09-29', '2026-10-06']);
  });

  it('mensal: débito por mês e situação do mês atual', () => {
    const m = { ...R, billingMode: 'mensal' as const, monthlyPrice: 40000, startDate: '2026-08-04' };
    const s = schedule({ recurrences: [m] });
    const sum = recurrenceSummary(m, s, [pay({ id: 'a', amount: 40000, recurrenceId: 'm', referenceMonth: '2026-08' })], RULES, '2026-09-16', 0);
    expect(sum.debt).toBe(40000);
    expect(sum.currentMonth).toMatchObject({ month: '2026-09', emDia: false, balance: 40000 });
  });
});
