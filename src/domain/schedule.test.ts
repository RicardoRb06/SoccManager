import { describe, expect, it } from 'vitest';
import { checkRecurrenceConflicts, isFree, itemsOnDate, occupantsAt, suggestFreeSlots } from './schedule';
import { block, C1, C2, rec, res, schedule } from '../test/fixtures';

const TUE = '2026-09-22';

describe('conflitos de horário', () => {
  it('reservas sobrepostas na mesma quadra conflitam; encostadas não', () => {
    const s = schedule({ reservations: [res({ id: 'a', date: TUE, startMin: 1200, endMin: 1260 })] });
    expect(occupantsAt(s, 'c1', TUE, 1230, 1290).map((o) => o.kind)).toEqual(['reserva']);
    expect(isFree(s, 'c1', TUE, 1260, 1320)).toBe(true);
    expect(isFree(s, 'c1', TUE, 1140, 1200)).toBe(true);
  });

  it('outra quadra não conflita (sem espaço compartilhado)', () => {
    const s = schedule({ reservations: [res({ id: 'a', date: TUE, startMin: 1200, endMin: 1260 })] });
    expect(isFree(s, 'c2', TUE, 1200, 1260)).toBe(true);
  });

  it('cancelada e excluída não ocupam; falta ocupa', () => {
    const s = schedule({
      reservations: [
        res({ id: 'a', date: TUE, startMin: 1200, endMin: 1260, status: 'cancelada' }),
        res({ id: 'b', date: TUE, startMin: 1260, endMin: 1320, deletedAt: '2026-09-01T00:00:00Z' }),
        res({ id: 'c', date: TUE, startMin: 1320, endMin: 1380, status: 'falta' }),
      ],
    });
    expect(isFree(s, 'c1', TUE, 1200, 1260)).toBe(true);
    expect(isFree(s, 'c1', TUE, 1260, 1320)).toBe(true);
    expect(isFree(s, 'c1', TUE, 1320, 1380)).toBe(false);
  });

  it('ao editar, ignora a própria reserva', () => {
    const s = schedule({ reservations: [res({ id: 'a', date: TUE, startMin: 1200, endMin: 1260 })] });
    expect(isFree(s, 'c1', TUE, 1200, 1290, { ignoreReservationId: 'a' })).toBe(true);
  });

  it('ocorrência VIRTUAL de mensalista ocupa o horário', () => {
    const s = schedule({ recurrences: [rec({ id: 'm1', weekday: 2, startMin: 1200, endMin: 1260 })] });
    const occ = occupantsAt(s, 'c1', TUE, 1200, 1260);
    expect(occ).toHaveLength(1);
    expect(occ[0]!.kind).toBe('mensalista');
    // semana seguinte também
    expect(isFree(s, 'c1', '2026-09-29', 1200, 1260)).toBe(false);
    // data pulada fica livre
    const s2 = schedule({ recurrences: [rec({ id: 'm1', weekday: 2, startMin: 1200, endMin: 1260, skipDates: [TUE] })] });
    expect(isFree(s2, 'c1', TUE, 1200, 1260)).toBe(true);
  });

  it('ocorrência materializada não é contada duas vezes', () => {
    const s = schedule({
      recurrences: [rec({ id: 'm1', weekday: 2, startMin: 1200, endMin: 1260 })],
      reservations: [res({ id: 'x', date: TUE, startMin: 1200, endMin: 1260, recurrenceId: 'm1' })],
    });
    expect(occupantsAt(s, 'c1', TUE, 1200, 1260)).toHaveLength(1);
    expect(occupantsAt(s, 'c1', TUE, 1200, 1260)[0]!.kind).toBe('reserva');
  });

  it('ocorrência materializada e depois cancelada libera o horário (não "ressuscita")', () => {
    const s = schedule({
      recurrences: [rec({ id: 'm1', weekday: 2, startMin: 1200, endMin: 1260 })],
      reservations: [res({ id: 'x', date: TUE, startMin: 1200, endMin: 1260, recurrenceId: 'm1', status: 'cancelada' })],
    });
    expect(isFree(s, 'c1', TUE, 1200, 1260)).toBe(true);
  });

  it('bloqueio de parte do dia e de dia inteiro', () => {
    const s = schedule({
      blocks: [
        block({ id: 'b1', dateStart: TUE, dateEnd: TUE, startMin: 960, endMin: 1080 }),
        block({ id: 'b2', dateStart: '2026-09-23', dateEnd: '2026-09-24', courtIds: ['c1', 'c2'] }),
      ],
    });
    expect(occupantsAt(s, 'c1', TUE, 1020, 1080)[0]!.kind).toBe('bloqueio');
    expect(isFree(s, 'c1', TUE, 1080, 1140)).toBe(true);
    expect(isFree(s, 'c2', TUE, 960, 1020)).toBe(true);
    expect(isFree(s, 'c2', '2026-09-24', 1200, 1260)).toBe(false);
    expect(isFree(s, 'c2', '2026-09-25', 1200, 1260)).toBe(true);
  });

  it('fora do expediente conflita (fechado)', () => {
    const s = schedule();
    expect(occupantsAt(s, 'c1', TUE, 900, 960)[0]!.kind).toBe('fechado'); // 15h, abre 16h
    expect(occupantsAt(s, 'c1', TUE, 1320, 1440)[0]!.kind).toBe('fechado'); // passa das 23h
    expect(isFree(s, 'c1', TUE, 1320, 1380)).toBe(true);
    const closed = schedule({ openingHours: [null, null, null, null, null, null, null] });
    expect(isFree(closed, 'c1', TUE, 1200, 1260)).toBe(false);
  });

  it('quadras do mesmo espaço físico conflitam entre si', () => {
    const s = schedule({
      courts: [{ ...C1, sharedSpaceGroup: 'poli' }, { ...C2, sharedSpaceGroup: 'poli' }],
      reservations: [res({ id: 'a', courtId: 'c2', date: TUE, startMin: 1200, endMin: 1260 })],
    });
    const occ = occupantsAt(s, 'c1', TUE, 1200, 1260);
    expect(occ).toHaveLength(1);
    expect(occ[0]!.courtId).toBe('c2');
  });

  it('lista itens do dia ordenados', () => {
    const s = schedule({
      reservations: [res({ id: 'a', date: TUE, startMin: 1260, endMin: 1320 })],
      recurrences: [rec({ id: 'm1', weekday: 2, startMin: 1200, endMin: 1260 })],
    });
    expect(itemsOnDate(s, TUE).map((i) => i.startMin)).toEqual([1200, 1260]);
  });
});

describe('sugestão de horários livres', () => {
  it('sugere os 3 mais próximos do desejado', () => {
    const s = schedule({
      reservations: [
        res({ id: 'a', date: TUE, startMin: 1200, endMin: 1260 }),
        res({ id: 'b', date: TUE, startMin: 1260, endMin: 1320 }),
      ],
    });
    const sug = suggestFreeSlots(s, 'c1', TUE, 60, 1200, 60);
    // livres: 16,17,18,19,22 → mais próximos de 20h: 19h, 22h(dist 120) empata com 18h(dist 120) → 18h primeiro
    expect(sug.map((x) => x.startMin)).toEqual([1140, 1080, 1320]);
  });

  it('respeita duração e fechamento', () => {
    const s = schedule();
    const sug = suggestFreeSlots(s, 'c1', TUE, 120, 1320, 60, { count: 10 });
    expect(sug.every((x) => x.endMin <= 1380)).toBe(true);
    expect(sug[0]!.startMin).toBe(1260);
  });

  it('pode excluir horários já passados', () => {
    const sug = suggestFreeSlots(schedule(), 'c1', TUE, 60, 960, 60, { notBefore: 1150 });
    expect(sug[0]!.startMin).toBe(1200);
  });

  it('dia fechado não sugere nada', () => {
    const closed = schedule({ openingHours: [null, null, null, null, null, null, null] });
    expect(suggestFreeSlots(closed, 'c1', TUE, 60, 1200, 60)).toEqual([]);
  });
});

describe('conflitos de novo mensalista (12 semanas)', () => {
  it('lista as datas futuras em conflito', () => {
    const s = schedule({
      reservations: [
        res({ id: 'a', date: '2026-09-29', startMin: 1200, endMin: 1260 }),
        res({ id: 'b', date: '2026-11-10', startMin: 1230, endMin: 1290 }),
        res({ id: 'longe', date: '2027-03-02', startMin: 1200, endMin: 1260 }), // fora da janela
      ],
    });
    const conflicts = checkRecurrenceConflicts(
      s,
      { courtId: 'c1', weekday: 2, startMin: 1200, endMin: 1260, startDate: TUE, skipDates: [] },
      TUE,
    );
    expect(conflicts.map((c) => c.date)).toEqual(['2026-09-29', '2026-11-10']);
  });

  it('respeita endDate e datas puladas', () => {
    const s = schedule({ reservations: [res({ id: 'a', date: '2026-10-06', startMin: 1200, endMin: 1260 })] });
    const draft = { courtId: 'c1', weekday: 2, startMin: 1200, endMin: 1260, startDate: TUE, skipDates: ['2026-10-06'] };
    expect(checkRecurrenceConflicts(s, draft, TUE)).toEqual([]);
    expect(checkRecurrenceConflicts(s, { ...draft, skipDates: [], endDate: '2026-09-30' }, TUE)).toEqual([]);
  });

  it('ao editar a regra, ignora as próprias ocorrências', () => {
    const s = schedule({ recurrences: [rec({ id: 'm1', weekday: 2, startMin: 1200, endMin: 1260 })] });
    const draft = { courtId: 'c1', weekday: 2, startMin: 1230, endMin: 1290, startDate: TUE, skipDates: [] };
    expect(checkRecurrenceConflicts(s, draft, TUE).length).toBe(12);
    expect(checkRecurrenceConflicts(s, draft, TUE, { ignoreRecurrenceId: 'm1' })).toEqual([]);
  });
});
