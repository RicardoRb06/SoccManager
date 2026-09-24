/**
 * Monta as linhas da agenda de um dia para uma quadra:
 * itens ocupando (reserva, mensalista, bloqueio, outra quadra do mesmo espaço)
 * intercalados com horários livres na granularidade do slot.
 */
import type { ISODate, Minutes } from './types';
import { hoursOn, itemsOnDate, relatedCourtIds, type Occupant, type PreparedSchedule } from './schedule';
import { classifySlots } from './metrics';

export type AgendaRow =
  | { type: 'item'; startMin: Minutes; endMin: Minutes; occupant: Occupant; /** ocupado por outra quadra do mesmo espaço */ shared: boolean }
  | { type: 'livre'; startMin: Minutes; endMin: Minutes };

export function buildDayRows(prep: PreparedSchedule, courtId: string, date: ISODate, slotMinutes: number): AgendaRow[] {
  const h = hoursOn(prep.data.openingHours, date);
  const related = relatedCourtIds(prep.data.courts, courtId);
  const items = itemsOnDate(prep, date, related).map((o) => {
    // Bloqueio de dia inteiro: exibe só dentro do expediente
    if (o.kind === 'bloqueio' && h) return { ...o, startMin: Math.max(o.startMin, h.open), endMin: Math.min(o.endMin, h.close) };
    return o;
  }).filter((o) => o.endMin > o.startMin);

  const rows: AgendaRow[] = [];
  const open = h ? Math.min(h.open, ...items.map((i) => i.startMin)) : Math.min(...items.map((i) => i.startMin), 1440);
  const close = h ? Math.max(h.close, ...items.map((i) => i.endMin)) : Math.max(...items.map((i) => i.endMin), 0);
  const gridStart = h?.open ?? open;

  const pushFree = (from: Minutes, to: Minutes) => {
    if (!h) return; // dia fechado: não oferece horário livre
    let cur = Math.max(from, h.open);
    const end = Math.min(to, h.close);
    while (cur < end) {
      const offset = (cur - gridStart) % slotMinutes;
      const next = Math.min(end, offset === 0 ? cur + slotMinutes : cur + (slotMinutes - offset));
      rows.push({ type: 'livre', startMin: cur, endMin: next });
      cur = next;
    }
  };

  let cursor = open;
  for (const it of items) {
    if (it.startMin > cursor) pushFree(cursor, it.startMin);
    rows.push({ type: 'item', startMin: it.startMin, endMin: it.endMin, occupant: it, shared: it.courtId !== courtId });
    cursor = Math.max(cursor, it.endMin);
  }
  if (cursor < close) pushFree(cursor, close);
  return rows;
}

/** Ocupação do dia (0..1) considerando todas as quadras ativas; null se fechado. */
export function dayOccupancy(prep: PreparedSchedule, date: ISODate, slotMinutes: number): number | null {
  const slots = classifySlots(prep, { from: date, to: date }, slotMinutes, date, 0);
  const usable = slots.filter((s) => s.kind !== 'indisponivel');
  if (!slots.length) return null;
  if (!usable.length) return 1;
  return usable.filter((s) => s.kind === 'ocupado').length / usable.length;
}
