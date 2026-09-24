/**
 * Ocupação da agenda e detecção de conflitos.
 *
 * Regras (seção 7 do escopo):
 *  - Intervalos [startMin, endMin) na mesma data conflitam se se sobrepõem.
 *  - Reservas canceladas ou na lixeira NÃO ocupam. Reservas com falta OCUPAM.
 *  - Ocupam também: ocorrências virtuais de mensalistas, bloqueios e o horário fora do expediente.
 *  - Quadras com o mesmo sharedSpaceGroup conflitam entre si.
 */
import type { Block, Court, ISODate, Minutes, OpeningHours, Recurrence, Reservation } from './types';
import { weekdayOf } from './dates';
import { overlaps } from './time';
import { datesToCheck, materializedKeys, occursOn, occurrenceKey, toOccurrence, type Occurrence } from './recurrence';

export interface ScheduleData {
  courts: Court[];
  reservations: Reservation[];
  recurrences: Recurrence[];
  blocks: Block[];
  openingHours: OpeningHours;
}

export interface PreparedSchedule {
  data: ScheduleData;
  reservationsByDate: Map<ISODate, Reservation[]>;
  materialized: Set<string>;
  courtsById: Map<string, Court>;
}

export type Occupant =
  | { kind: 'reserva'; courtId: string; startMin: Minutes; endMin: Minutes; reservation: Reservation }
  | { kind: 'mensalista'; courtId: string; startMin: Minutes; endMin: Minutes; occurrence: Occurrence }
  | { kind: 'bloqueio'; courtId: string; startMin: Minutes; endMin: Minutes; block: Block }
  | { kind: 'fechado'; courtId: string; startMin: Minutes; endMin: Minutes };

export interface IgnoreOptions {
  /** Ignora esta reserva (ao editar a própria reserva). */
  ignoreReservationId?: string;
  /** Ignora ocorrências virtuais E materializadas deste mensalista (ao editar a regra). */
  ignoreRecurrenceId?: string;
  /** Ignora uma ocorrência virtual específica (ao materializar/mover). */
  ignoreOccurrence?: { recurrenceId: string; date: ISODate };
}

/** Reserva ocupa o horário? */
export function reservationOccupies(r: Reservation): boolean {
  return !r.deletedAt && r.status !== 'cancelada';
}

/** Pré-indexa os dados para consultas rápidas por data. Recrie quando os dados mudarem. */
export function prepareSchedule(data: ScheduleData): PreparedSchedule {
  const reservationsByDate = new Map<ISODate, Reservation[]>();
  for (const r of data.reservations) {
    const list = reservationsByDate.get(r.date);
    if (list) list.push(r);
    else reservationsByDate.set(r.date, [r]);
  }
  return {
    data,
    reservationsByDate,
    materialized: materializedKeys(data.reservations),
    courtsById: new Map(data.courts.map((c) => [c.id, c])),
  };
}

/** A quadra e todas as que dividem o mesmo espaço físico. */
export function relatedCourtIds(courts: Court[], courtId: string): string[] {
  const court = courts.find((c) => c.id === courtId);
  const group = court?.sharedSpaceGroup?.trim();
  if (!group) return [courtId];
  const ids = courts.filter((c) => c.sharedSpaceGroup?.trim() === group).map((c) => c.id);
  return ids.includes(courtId) ? ids : [courtId, ...ids];
}

export function blockAppliesOn(block: Block, date: ISODate): boolean {
  return date >= block.dateStart && date <= block.dateEnd;
}

export function blockRange(block: Block): { startMin: Minutes; endMin: Minutes } {
  return { startMin: block.startMin ?? 0, endMin: block.endMin ?? 1440 };
}

/** Ocorrências virtuais (não materializadas) em uma data. */
export function virtualOccurrencesOn(prep: PreparedSchedule, date: ISODate): Occurrence[] {
  const out: Occurrence[] = [];
  for (const rec of prep.data.recurrences) {
    if (occursOn(rec, date) && !prep.materialized.has(occurrenceKey(rec.id, date))) {
      out.push(toOccurrence(rec, date));
    }
  }
  return out;
}

/**
 * Tudo o que ocupa horário numa data (sem o "fechado").
 * Se courtIds for informado, filtra para essas quadras.
 */
export function itemsOnDate(prep: PreparedSchedule, date: ISODate, courtIds?: string[], opts: IgnoreOptions = {}): Occupant[] {
  const want = courtIds ? new Set(courtIds) : null;
  const out: Occupant[] = [];

  for (const r of prep.reservationsByDate.get(date) ?? []) {
    if (!reservationOccupies(r)) continue;
    if (opts.ignoreReservationId === r.id) continue;
    if (opts.ignoreRecurrenceId && r.recurrenceId === opts.ignoreRecurrenceId) continue;
    if (want && !want.has(r.courtId)) continue;
    out.push({ kind: 'reserva', courtId: r.courtId, startMin: r.startMin, endMin: r.endMin, reservation: r });
  }

  for (const occ of virtualOccurrencesOn(prep, date)) {
    if (opts.ignoreRecurrenceId === occ.recurrenceId) continue;
    if (opts.ignoreOccurrence && opts.ignoreOccurrence.recurrenceId === occ.recurrenceId && opts.ignoreOccurrence.date === occ.date) continue;
    if (want && !want.has(occ.courtId)) continue;
    out.push({ kind: 'mensalista', courtId: occ.courtId, startMin: occ.startMin, endMin: occ.endMin, occurrence: occ });
  }

  for (const b of prep.data.blocks) {
    if (!blockAppliesOn(b, date)) continue;
    const { startMin, endMin } = blockRange(b);
    for (const cid of b.courtIds) {
      if (want && !want.has(cid)) continue;
      out.push({ kind: 'bloqueio', courtId: cid, startMin, endMin, block: b });
    }
  }

  return out.sort((a, b) => a.startMin - b.startMin);
}

/** Horário de funcionamento do dia (null = fechado). */
export function hoursOn(openingHours: OpeningHours, date: ISODate) {
  return openingHours[weekdayOf(date)] ?? null;
}

/** Retorna o trecho fora do expediente (ou null se está dentro). */
export function outsideHours(openingHours: OpeningHours, date: ISODate, startMin: Minutes, endMin: Minutes): boolean {
  const h = hoursOn(openingHours, date);
  if (!h) return true;
  return startMin < h.open || endMin > h.close;
}

/**
 * Quem ocupa [startMin, endMin) na quadra (considerando espaço compartilhado)?
 * Lista vazia = horário livre.
 */
export function occupantsAt(
  prep: PreparedSchedule,
  courtId: string,
  date: ISODate,
  startMin: Minutes,
  endMin: Minutes,
  opts: IgnoreOptions & { checkHours?: boolean } = {},
): Occupant[] {
  const related = relatedCourtIds(prep.data.courts, courtId);
  const out = itemsOnDate(prep, date, related, opts).filter((o) => overlaps(o.startMin, o.endMin, startMin, endMin));
  if (opts.checkHours !== false && outsideHours(prep.data.openingHours, date, startMin, endMin)) {
    out.unshift({ kind: 'fechado', courtId, startMin, endMin });
  }
  return out;
}

export function isFree(
  prep: PreparedSchedule,
  courtId: string,
  date: ISODate,
  startMin: Minutes,
  endMin: Minutes,
  opts: IgnoreOptions = {},
): boolean {
  return occupantsAt(prep, courtId, date, startMin, endMin, opts).length === 0;
}

/**
 * Sugere até `count` horários livres com a mesma duração, no mesmo dia,
 * ordenados pela proximidade do horário desejado (empate: o mais cedo).
 * `notBefore` permite excluir horários já passados (em minutos).
 */
export function suggestFreeSlots(
  prep: PreparedSchedule,
  courtId: string,
  date: ISODate,
  durationMin: Minutes,
  preferredStart: Minutes,
  slotMinutes: number,
  opts: IgnoreOptions & { count?: number; notBefore?: Minutes } = {},
): Array<{ startMin: Minutes; endMin: Minutes }> {
  const h = hoursOn(prep.data.openingHours, date);
  if (!h || durationMin <= 0) return [];
  const count = opts.count ?? 3;
  const candidates: Array<{ startMin: Minutes; endMin: Minutes }> = [];
  for (let s = h.open; s + durationMin <= h.close; s += slotMinutes) {
    if (opts.notBefore !== undefined && s < opts.notBefore) continue;
    if (isFree(prep, courtId, date, s, s + durationMin, opts)) candidates.push({ startMin: s, endMin: s + durationMin });
  }
  candidates.sort((a, b) => {
    const da = Math.abs(a.startMin - preferredStart);
    const db = Math.abs(b.startMin - preferredStart);
    return da === db ? a.startMin - b.startMin : da - db;
  });
  return candidates.slice(0, count);
}

export interface RecurrenceConflict {
  date: ISODate;
  occupants: Occupant[];
}

/**
 * Checa conflitos de uma regra de mensalista em todas as datas futuras
 * dentro da janela (padrão 12 semanas, ou até endDate).
 */
export function checkRecurrenceConflicts(
  prep: PreparedSchedule,
  draft: Pick<Recurrence, 'courtId' | 'weekday' | 'startMin' | 'endMin' | 'startDate' | 'endDate' | 'skipDates'>,
  fromDate: ISODate,
  opts: { weeks?: number; ignoreRecurrenceId?: string } = {},
): RecurrenceConflict[] {
  const out: RecurrenceConflict[] = [];
  for (const date of datesToCheck(draft, fromDate, opts.weeks ?? 12)) {
    const occupants = occupantsAt(prep, draft.courtId, date, draft.startMin, draft.endMin, {
      ignoreRecurrenceId: opts.ignoreRecurrenceId,
    });
    if (occupants.length) out.push({ date, occupants });
  }
  return out;
}
