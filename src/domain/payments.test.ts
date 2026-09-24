import { describe, expect, it } from 'vitest';
import {
  billableMonths, expectedMonthlyRevenue, monthStatus, monthlyDebt, paidByReservation, paidFor,
  paymentStatus, reservationBalance, reservationVisualState,
} from './payments';
import type { Payment } from './types';
import { rec, res } from '../test/fixtures';

const pay = (p: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({ method: 'pix', paidAt: '2026-09-10T15:00:00.000Z', ...p });

describe('pagamento de reserva (derivado)', () => {
  const r = res({ id: 'r1', date: '2026-09-22', startMin: 1200, endMin: 1260, price: 12000 });

  it('pendente, parcial (sinal) e pago', () => {
    expect(paymentStatus(12000, 0)).toBe('pendente');
    expect(paymentStatus(12000, 5000)).toBe('parcial');
    expect(paymentStatus(12000, 12000)).toBe('pago');
    expect(paymentStatus(12000, 15000)).toBe('pago');
  });

  it('saldo = preço − pagamentos; cancelada não gera saldo', () => {
    expect(reservationBalance(r, 5000)).toBe(7000);
    expect(reservationBalance(r, 20000)).toBe(0);
    expect(reservationBalance({ ...r, status: 'cancelada' }, 0)).toBe(0);
  });

  it('soma pagamentos por reserva', () => {
    const ps = [pay({ id: 'p1', amount: 5000, reservationId: 'r1' }), pay({ id: 'p2', amount: 7000, reservationId: 'r1' }), pay({ id: 'p3', amount: 1, reservationId: 'r2' })];
    expect(paidFor(ps, 'r1')).toBe(12000);
    expect(paidByReservation(ps).get('r2')).toBe(1);
  });

  it('estado visual', () => {
    expect(reservationVisualState(r, 0)).toBe('pendente');
    expect(reservationVisualState(r, 100)).toBe('sinal');
    expect(reservationVisualState(r, 12000)).toBe('pago');
    expect(reservationVisualState({ ...r, status: 'falta' }, 0)).toBe('falta');
    expect(reservationVisualState({ ...r, status: 'cancelada' }, 0)).toBe('livre');
    expect(reservationVisualState({ ...r, price: 0 }, 0, true)).toBe('mensalidade');
  });
});

describe('mensalidade', () => {
  // começa terça 2026-08-04; mensal R$ 400
  const m = rec({ id: 'm1', weekday: 2, startMin: 1200, endMin: 1260, startDate: '2026-08-04', billingMode: 'mensal', monthlyPrice: 40000 });

  it('em dia quando soma dos pagamentos do mês ≥ mensalidade', () => {
    const ps = [
      pay({ id: 'a', amount: 20000, recurrenceId: 'm1', referenceMonth: '2026-09' }),
      pay({ id: 'b', amount: 20000, recurrenceId: 'm1', referenceMonth: '2026-09' }),
    ];
    expect(monthStatus(m, ps, '2026-09')).toMatchObject({ emDia: true, balance: 0, paid: 40000 });
    expect(monthStatus(m, ps.slice(0, 1), '2026-09')).toMatchObject({ emDia: false, balance: 20000 });
  });

  it('meses cobráveis desde o início', () => {
    expect(billableMonths(m, '2026-10')).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(billableMonths({ ...m, billingMode: 'por_jogo' }, '2026-10')).toEqual([]);
    expect(billableMonths({ ...m, endDate: '2026-08-31' }, '2026-10')).toEqual(['2026-08']);
  });

  it('débito acumulado', () => {
    const ps = [pay({ id: 'a', amount: 40000, recurrenceId: 'm1', referenceMonth: '2026-08' })];
    const debt = monthlyDebt(m, ps, '2026-09');
    expect(debt.total).toBe(40000);
    expect(debt.months.map((x) => x.month)).toEqual(['2026-09']);
  });

  it('receita fixa prevista (mensal + por jogo)', () => {
    const porJogo = rec({ id: 'm2', weekday: 4, startMin: 1200, endMin: 1260, startDate: '2026-01-01', pricePerGame: 10000 });
    const pausado = rec({ id: 'm3', weekday: 5, startMin: 1200, endMin: 1260, status: 'pausado', pausedAt: '2026-01-01' });
    // setembro/2026 tem 4 quintas (3, 10, 17, 24)
    const total = expectedMonthlyRevenue([m, porJogo, pausado], '2026-09', (r) => r.pricePerGame ?? 0);
    expect(total).toBe(40000 + 4 * 10000);
  });
});

describe('mensalidade só vence quando o primeiro jogo do mês chega', () => {
  it('mensalista criado hoje para jogar semana que vem não deve nada ainda', () => {
    const m = rec({ id: 'n', weekday: 2, startMin: 1200, endMin: 1260, startDate: '2026-09-29', billingMode: 'mensal', monthlyPrice: 48000 });
    expect(billableMonths(m, '2026-09', '2026-09-24')).toEqual([]);
    expect(billableMonths(m, '2026-09', '2026-09-29')).toEqual(['2026-09']);
    expect(monthlyDebt(m, [], '2026-09', '2026-09-24').total).toBe(0);
  });
});
