import { describe, expect, it } from 'vitest';
import { customerStats } from './customers';
import { daySummary } from './daySummary';
import type { Payment } from './types';
import { C1, RULES, rec, res, schedule } from '../test/fixtures';

const pay = (p: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({ method: 'pix', paidAt: '2026-09-22T15:00:00.000Z', ...p });

describe('estatísticas do cliente', () => {
  it('conta jogos, faltas, cancelamentos, total pago e próximos jogos', () => {
    const reservations = [
      res({ id: 'a', date: '2026-09-01', startMin: 1200, endMin: 1260 }),
      res({ id: 'b', date: '2026-09-08', startMin: 1200, endMin: 1260, status: 'falta' }),
      res({ id: 'c', date: '2026-09-15', startMin: 1200, endMin: 1260, status: 'cancelada' }),
      res({ id: 'd', date: '2026-10-01', startMin: 1200, endMin: 1260 }),
      res({ id: 'e', date: '2026-09-02', startMin: 1200, endMin: 1260, deletedAt: 'x' }),
      res({ id: 'o', date: '2026-09-02', startMin: 1200, endMin: 1260, customerId: 'outro' }),
    ];
    const recurrences = [rec({ id: 'm', weekday: 1, startMin: 1200, endMin: 1260, customerId: 'cust1', billingMode: 'mensal', monthlyPrice: 40000 })];
    const payments = [
      pay({ id: '1', amount: 12000, reservationId: 'a' }),
      pay({ id: '2', amount: 40000, recurrenceId: 'm', referenceMonth: '2026-09' }),
      pay({ id: '3', amount: 999, reservationId: 'o' }),
    ];
    // mensalista toda segunda desde 01/09 → segundas passadas: 07, 14, 21 (3 jogos virtuais); próxima: 28/09
    expect(customerStats('cust1', reservations, payments, recurrences, '2026-09-24')).toEqual({
      games: 2 + 3, faltas: 1, cancelamentos: 1, totalPaid: 52000, lastGame: '2026-09-21', nextGame: '2026-09-28',
    });
  });
});

describe('resumo do dia', () => {
  it('soma recebido por forma, pendências e faltas', () => {
    const TUE = '2026-09-22';
    const s = schedule({
      courts: [C1],
      reservations: [
        res({ id: 'a', date: TUE, startMin: 1080, endMin: 1140, price: 12000 }),
        res({ id: 'b', date: TUE, startMin: 1140, endMin: 1200, price: 12000, status: 'falta' }),
      ],
      recurrences: [rec({ id: 'm', weekday: 2, startMin: 1200, endMin: 1260, startDate: TUE })],
    });
    const payments = [pay({ id: '1', amount: 12000, reservationId: 'a', method: 'dinheiro' }), pay({ id: '2', amount: 3000, reservationId: 'b' })];
    const d = daySummary(s, payments, RULES, TUE);
    expect(d.received).toBe(15000);
    expect(d.byMethod).toEqual({ pix: 3000, dinheiro: 12000, cartao: 0, outro: 0 });
    expect(d.pendingTotal).toBe(9000 + 12000); // saldo da falta + jogo do mensalista
    expect(d.faltas).toBe(1);
    expect(d.games).toBe(3);
  });
});
