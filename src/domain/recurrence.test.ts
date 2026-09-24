import { describe, expect, it } from 'vitest';
import {
  datesToCheck, materializeOccurrence, materializedKeys, nextOccurrenceDates, occurrenceDates,
  occurrencePrice, occursOn, skipDate, unskipDate, virtualOccurrences,
} from './recurrence';
import { NOW, RULES, rec, res } from '../test/fixtures';

// 2026-09-01 = terça
const R = rec({ id: 'm1', weekday: 2, startMin: 1200, endMin: 1260, startDate: '2026-09-01' });

describe('recorrência semanal', () => {
  it('gera as datas do dia da semana a partir do início', () => {
    expect(occurrenceDates(R, '2026-08-01', '2026-09-30')).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
  });

  it('startDate que não cai no dia da semana começa na próxima ocorrência', () => {
    const r = { ...R, startDate: '2026-09-03' };
    expect(occurrenceDates(r, '2026-09-01', '2026-09-20')).toEqual(['2026-09-08', '2026-09-15']);
  });

  it('respeita endDate e skipDates', () => {
    const r = { ...R, endDate: '2026-09-22', skipDates: ['2026-09-15'] };
    expect(occurrenceDates(r, '2026-09-01', '2026-12-31')).toEqual(['2026-09-01', '2026-09-08', '2026-09-22']);
  });

  it('pausado mantém o histórico e para de gerar a partir de pausedAt', () => {
    const r = { ...R, status: 'pausado' as const, pausedAt: '2026-09-15' };
    expect(occurrenceDates(r, '2026-09-01', '2026-10-31')).toEqual(['2026-09-01', '2026-09-08']);
  });

  it('encerrado gera só até endDate', () => {
    expect(occursOn({ ...R, status: 'encerrado', endDate: '2026-09-08' }, '2026-09-08')).toBe(true);
    expect(occursOn({ ...R, status: 'encerrado', endDate: '2026-09-08' }, '2026-09-15')).toBe(false);
    expect(occursOn({ ...R, status: 'encerrado' }, '2026-09-08')).toBe(false);
  });

  it('ocorrências materializadas somem das virtuais (sem duplicar)', () => {
    const mat = materializedKeys([res({ id: 'x', date: '2026-09-08', startMin: 1200, endMin: 1260, recurrenceId: 'm1' })]);
    const v = virtualOccurrences([R], mat, '2026-09-01', '2026-09-15');
    expect(v.map((o) => o.date)).toEqual(['2026-09-01', '2026-09-15']);
  });

  it('materializa com os dados da regra', () => {
    const r = materializeOccurrence(R, '2026-09-08', RULES, 'new', NOW);
    expect(r).toMatchObject({ id: 'new', recurrenceId: 'm1', date: '2026-09-08', startMin: 1200, endMin: 1260, price: 12000, status: 'ativa', courtId: 'c1' });
  });

  it('preço da ocorrência: por jogo usa preço fixo ou tabela; mensal é 0', () => {
    expect(occurrencePrice(R, RULES, '2026-09-08')).toBe(12000);
    expect(occurrencePrice({ ...R, pricePerGame: 10000 }, RULES, '2026-09-08')).toBe(10000);
    expect(occurrencePrice({ ...R, billingMode: 'mensal', monthlyPrice: 40000 }, RULES, '2026-09-08')).toBe(0);
  });

  it('pular e desfazer pular data', () => {
    const skipped = skipDate(R, '2026-09-08', NOW);
    expect(skipped.skipDates).toEqual(['2026-09-08']);
    expect(skipDate(skipped, '2026-09-08', NOW)).toBe(skipped);
    expect(unskipDate(skipped, '2026-09-08', NOW).skipDates).toEqual([]);
  });

  it('próximas datas e janela de checagem', () => {
    expect(nextOccurrenceDates(R, '2026-09-10', 2)).toEqual(['2026-09-15', '2026-09-22']);
    expect(datesToCheck({ weekday: 2, startDate: '2026-09-01', skipDates: [] }, '2026-09-10', 3)).toEqual(['2026-09-15', '2026-09-22', '2026-09-29']);
  });
});
