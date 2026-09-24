import { describe, expect, it } from 'vitest';
import { buildReport, periodFor, promotionFor } from './report';
import { centsCSV, paymentsCSV, reservationsCSV, slugify, toCSV, BOM } from './csv';
import type { Payment } from './types';
import { C1, RULES, rec, res, schedule } from '../test/fixtures';

describe('períodos do Resumo', () => {
  it('mês atual, últimos 30 dias e mês anterior', () => {
    expect(periodFor('mes_atual', '2026-09-24')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodFor('ultimos_30', '2026-09-24')).toEqual({ from: '2026-08-26', to: '2026-09-24' });
    expect(periodFor('mes_anterior', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
});

describe('relatório', () => {
  const TUE = '2026-09-22';
  const s = schedule({
    courts: [C1],
    reservations: [res({ id: 'a', date: TUE, startMin: 1200, endMin: 1260, price: 12000 })],
  });
  const payments: Payment[] = [{ id: 'p', reservationId: 'a', amount: 12000, method: 'pix', paidAt: '2026-09-22T15:00:00.000Z' }];

  it('horas vazias batem com a tabela de preços e a agenda', () => {
    const r = buildReport(s, payments, RULES, { from: TUE, to: TUE }, 60, '2026-09-23', 0);
    // terça 16–23h: 7 slots, 1 ocupado → 6 vazios: 16h, 17h (90) + 18h, 19h, 21h, 22h (120)
    expect(r.empty.hours).toBe(6);
    expect(r.empty.value).toBe(2 * 9000 + 4 * 12000);
    expect(r.received).toBe(12000);
    expect(r.occupancy.rate).toBeCloseTo(1 / 7);
    expect(r.promotions).toHaveLength(0); // 1 amostra por célula < mínimo de 2
  });

  it('sugere promoção com 25% de desconto arredondado para R$ 5', () => {
    const p = promotionFor({ weekday: 2, hour: 16, occupied: 0, total: 4, ratio: 0 }, [C1], RULES, TUE);
    expect(p.label).toBe('terça-feira, 16h–17h');
    expect(p.currentPrice).toBe(9000);
    expect(p.suggestedPrice).toBe(7000); // 67,50 → 70,00
  });
});

describe('CSV', () => {
  it('usa ; , BOM, CRLF e aspas quando necessário', () => {
    expect(toCSV([['a', 'b;c'], ['x"y', 1]])).toBe(`${BOM}a;"b;c"\r\n"x""y";1\r\n`);
    expect(centsCSV(12050)).toBe('120,50');
    expect(slugify('Arena Modelo – Zé')).toBe('arena-modelo-ze');
  });

  it('reservas incluem avulsas e jogos de mensalista do período', () => {
    const TUE = '2026-09-22';
    const s = schedule({
      courts: [C1],
      reservations: [res({ id: 'a', date: TUE, startMin: 1080, endMin: 1140, price: 9000, notes: 'Aniversário; bolo' })],
      recurrences: [rec({ id: 'm', weekday: 2, startMin: 1200, endMin: 1260, startDate: TUE, notes: 'Time' })],
    });
    const lk = {
      customers: new Map([['cust1', { id: 'cust1', name: 'Ana', phone: '11', createdAt: '' }], ['custR', { id: 'custR', name: 'Beto', phone: '', createdAt: '' }]]),
      courts: new Map([['c1', C1]]),
      recurrences: new Map(s.data.recurrences.map((r) => [r.id, r])),
      rules: RULES,
    };
    const csv = reservationsCSV(s, [], { from: TUE, to: TUE }, lk).split('\r\n');
    expect(csv[1]).toBe('22/09/2026;18:00;19:00;Quadra 1;Ana;11;Avulsa;Ativa;90,00;0,00;90,00;"Aniversário; bolo"');
    expect(csv[2]).toBe('22/09/2026;20:00;21:00;Quadra 1;Beto;;Mensalista (Time);Ativa;120,00;0,00;120,00;');
    const pay = paymentsCSV(
      [{ id: 'p', reservationId: 'a', amount: 5000, method: 'pix', paidAt: '2026-09-22T15:00:00.000Z', note: 'Sinal' }],
      s.data.reservations,
      { from: TUE, to: TUE },
      lk,
    ).split('\r\n');
    expect(pay[1]).toContain(';Ana;Jogo 22/09/2026 18:00 · Quadra 1;Pix;50,00;Sinal');
  });
});
