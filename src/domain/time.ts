/** Horários como minutos desde 00:00. */
import type { Minutes } from './types';

export const DAY_MINUTES = 1440;

/** 1200 -> "20:00"; 1440 -> "24:00" */
export function minToHHMM(min: Minutes): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "20:00" -> 1200; "24:00" -> 1440. Lança erro se inválido. */
export function hhmmToMin(s: string): Minutes {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`Horário inválido: ${s}`);
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (mm > 59 || h > 24 || (h === 24 && mm !== 0)) throw new Error(`Horário inválido: ${s}`);
  return h * 60 + mm;
}

/** 60 -> "1h"; 90 -> "1h30"; 30 -> "30min" */
export function formatDuration(min: Minutes): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** "20:00–21:30" */
export function formatTimeRange(startMin: Minutes, endMin: Minutes): string {
  return `${minToHHMM(startMin)}–${minToHHMM(endMin)}`;
}

/** Intervalos semiabertos [aS, aE) e [bS, bE) se sobrepõem? */
export function overlaps(aS: Minutes, aE: Minutes, bS: Minutes, bE: Minutes): boolean {
  return aS < bE && bS < aE;
}

export function isValidRange(startMin: Minutes, endMin: Minutes): boolean {
  return Number.isInteger(startMin) && Number.isInteger(endMin) && startMin >= 0 && endMin <= DAY_MINUTES && startMin < endMin;
}
