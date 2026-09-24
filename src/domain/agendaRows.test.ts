import { describe, expect, it } from 'vitest';
import { buildDayRows, dayOccupancy } from './agendaRows';
import { block, C1, C2, rec, res, schedule } from '../test/fixtures';

const TUE = '2026-09-22'; // 16:00–23:00

describe('linhas da agenda do dia', () => {
  it('intercala livres (por slot) e ocupados', () => {
    const s = schedule({
      reservations: [res({ id: 'a', date: TUE, startMin: 1080, endMin: 1200 })],
      recurrences: [rec({ id: 'm', weekday: 2, startMin: 1260, endMin: 1320 })],
    });
    const rows = buildDayRows(s, 'c1', TUE, 60);
    expect(rows.map((r) => `${r.type}:${r.startMin}-${r.endMin}`)).toEqual([
      'livre:960-1020', 'livre:1020-1080', 'item:1080-1200', 'livre:1200-1260', 'item:1260-1320', 'livre:1320-1380',
    ]);
  });

  it('alinha livres ao grid quando uma reserva termina fora do slot', () => {
    const s = schedule({ reservations: [res({ id: 'a', date: TUE, startMin: 960, endMin: 1050 })] });
    const rows = buildDayRows(s, 'c1', TUE, 60);
    expect(rows.slice(0, 3).map((r) => `${r.type}:${r.startMin}-${r.endMin}`)).toEqual(['item:960-1050', 'livre:1050-1080', 'livre:1080-1140']);
  });

  it('bloqueio de dia inteiro aparece recortado ao expediente', () => {
    const s = schedule({ blocks: [block({ id: 'b', dateStart: TUE, dateEnd: TUE })] });
    const rows = buildDayRows(s, 'c1', TUE, 60);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'item', startMin: 960, endMin: 1380 });
  });

  it('marca ocupação de outra quadra do mesmo espaço', () => {
    const s = schedule({
      courts: [{ ...C1, sharedSpaceGroup: 'g' }, { ...C2, sharedSpaceGroup: 'g' }],
      reservations: [res({ id: 'a', courtId: 'c2', date: TUE, startMin: 1200, endMin: 1260 })],
    });
    const row = buildDayRows(s, 'c1', TUE, 60).find((r) => r.type === 'item');
    expect(row).toMatchObject({ shared: true });
  });

  it('reserva fora do expediente continua visível', () => {
    const s = schedule({ reservations: [res({ id: 'a', date: TUE, startMin: 900, endMin: 960 })] });
    const rows = buildDayRows(s, 'c1', TUE, 60);
    expect(rows[0]).toMatchObject({ type: 'item', startMin: 900 });
  });

  it('dia fechado sem itens não tem linhas', () => {
    const s = schedule({ openingHours: [null, null, null, null, null, null, null] });
    expect(buildDayRows(s, 'c1', TUE, 60)).toEqual([]);
  });

  it('ocupação do dia', () => {
    const s = schedule({ courts: [C1], reservations: [res({ id: 'a', date: TUE, startMin: 960, endMin: 1170 - 30 })] });
    // 7 slots; reserva 16:00–19:00 → 3 ocupados
    expect(dayOccupancy(s, TUE, 60)).toBeCloseTo(3 / 7);
    expect(dayOccupancy(schedule({ openingHours: [null, null, null, null, null, null, null] }), TUE, 60)).toBeNull();
  });
});
