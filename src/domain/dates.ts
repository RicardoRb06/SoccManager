/**
 * Utilitários de data sobre strings "YYYY-MM-DD" (sem fuso horário).
 * A aritmética usa Date.UTC internamente, então horário de verão e fuso
 * nunca deslocam um dia.
 */
import type { ISODate, ISOMonth } from './types';

export const WEEKDAY_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const;
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
export const MONTH_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

export function isISODate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function parseISODate(date: ISODate): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Data inválida: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function toISODate(y: number, m: number, d: number): ISODate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

function toUTC(date: ISODate): number {
  const { y, m, d } = parseISODate(date);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Data local de hoje (fuso do aparelho). */
export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Minutos desde 00:00 no horário local. */
export function nowMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Converte um timestamp ISO completo para a data local do aparelho. */
export function isoDateTimeToLocalDate(iso: string): ISODate {
  return todayISO(new Date(iso));
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromUTC(toUTC(date) + n * DAY_MS);
}

/** b - a em dias */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(date: ISODate): number {
  return new Date(toUTC(date)).getUTCDay();
}

export function startOfWeek(date: ISODate, weekStartsOn: 0 | 1 = 0): ISODate {
  const wd = weekdayOf(date);
  const delta = (wd - weekStartsOn + 7) % 7;
  return addDays(date, -delta);
}

export function weekDates(date: ISODate, weekStartsOn: 0 | 1 = 0): ISODate[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Lista de datas de from até to (inclusive). */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthOf(date: ISODate): ISOMonth {
  return date.slice(0, 7);
}

export function firstDayOfMonth(month: ISOMonth): ISODate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: ISOMonth): ISODate {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return toISODate(y, m, daysInMonth(y, m));
}

export function addMonths(month: ISOMonth, n: number): ISOMonth {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  return `${pad(Math.floor(idx / 12), 4)}-${pad((idx % 12) + 1)}`;
}

/** Meses de from até to (inclusive), ambos "YYYY-MM". */
export function monthRange(from: ISOMonth, to: ISOMonth): ISOMonth[] {
  const out: ISOMonth[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

/** dd/MM/aaaa */
export function formatDateBR(date: ISODate): string {
  const { y, m, d } = parseISODate(date);
  return `${pad(d)}/${pad(m)}/${pad(y, 4)}`;
}

/** dd/MM */
export function formatDayMonth(date: ISODate): string {
  const { m, d } = parseISODate(date);
  return `${pad(d)}/${pad(m)}`;
}

/** "terça-feira, 24 de setembro" */
export function formatLongDate(date: ISODate): string {
  const { m, d } = parseISODate(date);
  return `${WEEKDAY_LONG[weekdayOf(date)]}, ${d} de ${MONTH_LONG[m - 1]}`;
}

/** "setembro de 2026" */
export function formatMonthBR(month: ISOMonth): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTH_LONG[m - 1]} de ${y}`;
}

/** Converte "dd/MM/aaaa" em "YYYY-MM-DD" (ou null se inválida). */
export function parseDateBR(s: string): ISODate | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const iso = toISODate(Number(m[3]), Number(m[2]), Number(m[1]));
  return isISODate(iso) ? iso : null;
}
