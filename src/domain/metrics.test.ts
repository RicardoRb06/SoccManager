import { describe, expect, it } from 'vitest';
import {
  classifySlots, emptyHours, faltasInPeriod, heatmap, occupancyRate, receivables, receivedInPeriod,
  topCustomers, worstCells,
} from './metrics';
import type { Payment } from './types';
import { block, C1, RULES, rec, res, schedule } from '../test/fixtures';

const TUE = '2026-09-22';
const period = { from: TUE, to: TUE };

function scenario() {
  const reservations = [
    res({ id: 'a', date: TUE, startMin: 1200, endMin: 1260, price: 12000 }),
    res({ id: 'b', date: TUE, startMin: 1260, endMin: 1320, price: 12000, status: 'falta', customerId: 'cust2' }),
    res({ id: 'c', date: TUE, startMin: 1020, endMin: 1080, price: 9000, status: 'cancelada' }),
  ];
  const s = schedule({
    courts: [C1],
    reservations,
    recurrences: [rec({ id: 'm1', weekday: 2, startMin: 1320, endMin: 1380, startDate: TUE })],
    blocks: [block({ id: 'bl', dateStart: TUE, dateEnd: TUE, startMin: 960, endMin: 1020 })],
  });
  const payments: Payment[] = [{ id: 'p', reservationId: 'a', amount: 5000, method: 'pix', paidAt: '2026-09-22T15:00:00.000Z' }];
  return { s, payments, reservations };
}

describe('métricas do Resumo', () => {
  it('classifica slots: ocupado, indisponível (bloqueio) e livre', () => {
    const { s } = scenario();
    const slots = classifySlots(s, period, 60, '2026-09-23', 0);
    expect(slots.map((x) => x.kind)).toEqual(['indisponivel', 'livre', 'livre', 'livre', 'ocupado', 'ocupado', 'ocupado']);
    expect(slots.every((x) => x.past)).toBe(true);
  });

  it('taxa de ocupação ignora bloqueios', () => {
    const { s } = scenario();
    const r = occupancyRate(classifySlots(s, period, 60, '2026-09-23', 0));
    expect(r).toEqual({ rate: 0.5, occupied: 3, available: 6 });
  });

  it('horas vazias valoradas pela tabela (cancelada volta a ser vazia)', () => {
    const { s } = scenario();
    const e = emptyHours(classifySlots(s, period, 60, '2026-09-23', 0), RULES);
    // 17h (90) + 18h (120) + 19h (120)
    expect(e.hours).toBe(3);
    expect(e.value).toBe(9000 + 12000 + 12000);
  });

  it('horário futuro não conta como vazio', () => {
    const { s } = scenario();
    // "agora" = 19:30 do mesmo dia: só 17h e 18h já passaram vazios
    const e = emptyHours(classifySlots(s, period, 60, TUE, 1170), RULES);
    expect(e.hours).toBe(2);
  });

  it('mapa de calor e piores horários', () => {
    const { s } = scenario();
    const cells = heatmap(classifySlots(s, period, 60, '2026-09-23', 0));
    expect(cells.map((c) => c.hour)).toEqual([17, 18, 19, 20, 21, 22]);
    expect(worstCells(cells, 3, 1).map((c) => c.hour)).toEqual([17, 18, 19]);
  });

  it('a receber: saldo de reserva, falta sem pagamento e jogo de mensalista não pago', () => {
    const { s, payments } = scenario();
    const items = receivables(s, payments, RULES, period, '2026-09-23');
    expect(items.map((i) => [i.kind, i.amount])).toEqual([
      ['reserva', 12000],
      ['ocorrencia', 12000],
      ['reserva', 7000],
    ]);
  });

  it('a receber inclui mensalidade em aberto', () => {
    const s = schedule({
      courts: [C1],
      recurrences: [rec({ id: 'm', weekday: 2, startMin: 1200, endMin: 1260, startDate: '2026-09-01', billingMode: 'mensal', monthlyPrice: 40000 })],
    });
    const items = receivables(s, [], RULES, { from: '2026-09-01', to: '2026-09-30' }, '2026-09-23');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'mensalidade', month: '2026-09', amount: 40000 });
  });

  it('recebido, faltas e ranking', () => {
    const { s, payments, reservations } = scenario();
    expect(receivedInPeriod(payments, period)).toBe(5000);
    expect(faltasInPeriod(reservations, period)).toBe(1);
    expect(topCustomers(s, payments, period)).toEqual([{ customerId: 'cust1', total: 5000, games: 1 }]);
  });
});
