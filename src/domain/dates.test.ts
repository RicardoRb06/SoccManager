import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, dateRange, diffDays, formatDateBR, formatLongDate, isISODate, lastDayOfMonth,
  monthRange, parseDateBR, startOfWeek, weekDates, weekdayOf,
} from './dates';
import { formatDuration, hhmmToMin, minToHHMM, overlaps } from './time';
import { formatBRL, parseBRL } from './money';

describe('datas (YYYY-MM-DD, sem fuso)', () => {
  it('soma dias atravessando meses, anos e ano bissexto', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('não sofre com horário de verão (datas históricas do Brasil)', () => {
    // 2018-11-04 foi início do horário de verão em SP
    expect(addDays('2018-11-03', 1)).toBe('2018-11-04');
    expect(addDays('2018-11-04', 1)).toBe('2018-11-05');
    expect(diffDays('2018-11-01', '2018-11-10')).toBe(9);
  });

  it('dia da semana: 0 = domingo', () => {
    expect(weekdayOf('2026-09-24')).toBe(4); // quinta
    expect(weekdayOf('2026-09-27')).toBe(0); // domingo
  });

  it('início da semana configurável', () => {
    expect(startOfWeek('2026-09-24', 0)).toBe('2026-09-20');
    expect(startOfWeek('2026-09-24', 1)).toBe('2026-09-21');
    expect(startOfWeek('2026-09-20', 1)).toBe('2026-09-14');
    expect(weekDates('2026-09-24', 0)).toHaveLength(7);
  });

  it('intervalos e meses', () => {
    expect(dateRange('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('formatos pt-BR', () => {
    expect(formatDateBR('2026-09-04')).toBe('04/09/2026');
    expect(formatLongDate('2026-09-24')).toBe('quinta-feira, 24 de setembro');
    expect(parseDateBR('4/9/2026')).toBe('2026-09-04');
    expect(parseDateBR('31/02/2026')).toBeNull();
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
  });
});

describe('horários em minutos', () => {
  it('converte ida e volta, incluindo 24:00', () => {
    expect(hhmmToMin('20:00')).toBe(1200);
    expect(hhmmToMin('24:00')).toBe(1440);
    expect(minToHHMM(1440)).toBe('24:00');
    expect(minToHHMM(570)).toBe('09:30');
    expect(() => hhmmToMin('24:30')).toThrow();
  });

  it('duração legível', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(30)).toBe('30min');
  });

  it('sobreposição semiaberta [início, fim)', () => {
    expect(overlaps(1200, 1260, 1260, 1320)).toBe(false); // encostados não conflitam
    expect(overlaps(1200, 1290, 1260, 1320)).toBe(true);
    expect(overlaps(1200, 1320, 1230, 1260)).toBe(true); // contido
  });
});

describe('dinheiro em centavos', () => {
  it('formata BRL', () => {
    expect(formatBRL(12050).replace(/\s/g, ' ')).toBe('R$ 120,50');
  });

  it('interpreta entradas comuns', () => {
    expect(parseBRL('120')).toBe(12000);
    expect(parseBRL('120,5')).toBe(12050);
    expect(parseBRL('R$ 1.200,50')).toBe(120050);
    expect(parseBRL('1.200')).toBe(120000);
    expect(parseBRL('12.5')).toBe(1250);
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('')).toBeNull();
  });
});
