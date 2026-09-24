import type { Block, Court, OpeningHours, PriceRule, Recurrence, Reservation } from '../domain/types';
import { prepareSchedule, type ScheduleData } from '../domain/schedule';

export const NOW = '2026-09-01T12:00:00.000Z';

/** Seg–sex 16–23h, sáb/dom 8–22h */
export const HOURS: OpeningHours = [
  { open: 480, close: 1320 },
  { open: 960, close: 1380 },
  { open: 960, close: 1380 },
  { open: 960, close: 1380 },
  { open: 960, close: 1380 },
  { open: 960, close: 1380 },
  { open: 480, close: 1320 },
];

export const C1: Court = { id: 'c1', name: 'Quadra 1', modality: 'futsal', active: true, order: 0 };
export const C2: Court = { id: 'c2', name: 'Quadra 2', modality: 'basquete', active: true, order: 1 };

export function res(p: Partial<Reservation> & Pick<Reservation, 'id' | 'date' | 'startMin' | 'endMin'>): Reservation {
  return {
    courtId: 'c1',
    customerId: 'cust1',
    price: 12000,
    status: 'ativa',
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

export function rec(p: Partial<Recurrence> & Pick<Recurrence, 'id' | 'weekday' | 'startMin' | 'endMin'>): Recurrence {
  return {
    courtId: 'c1',
    customerId: 'custR',
    startDate: '2026-09-01',
    status: 'ativo',
    billingMode: 'por_jogo',
    skipDates: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

export function block(p: Partial<Block> & Pick<Block, 'id' | 'dateStart' | 'dateEnd'>): Block {
  return { courtIds: ['c1'], reason: 'Manutenção', createdAt: NOW, ...p };
}

export const RULES: PriceRule[] = [
  { id: 'r1', courtId: 'c1', weekdays: [1, 2, 3, 4, 5], startMin: 0, endMin: 1080, price: 9000 },
  { id: 'r2', courtId: 'c1', weekdays: [1, 2, 3, 4, 5], startMin: 1080, endMin: 1440, price: 12000 },
  { id: 'r3', courtId: 'c1', weekdays: [0, 6], startMin: 0, endMin: 1440, price: 13000 },
  { id: 'g1', courtId: '*', weekdays: [0, 1, 2, 3, 4, 5, 6], startMin: 0, endMin: 1440, price: 5000 },
];

export function schedule(p: Partial<ScheduleData> = {}) {
  return prepareSchedule({
    courts: [C1, C2],
    reservations: [],
    recurrences: [],
    blocks: [],
    openingHours: HOURS,
    ...p,
  });
}
