/**
 * Preço automático pela tabela de regras.
 *
 * - Uma regra vale para (quadra | "*") × dias da semana × faixa [startMin, endMin), com preço por hora.
 * - O preço de uma reserva é a soma proporcional de cada trecho coberto
 *   (ex.: 17:30–18:30 com faixas 90/h até 18:00 e 120/h depois = 45 + 60 = 105).
 * - Prioridade: regra específica da quadra vence a regra "*".
 *   Entre regras de mesma prioridade que se sobrepõem, vence a que aparece primeiro na lista.
 * - Trechos sem regra ficam com preço 0 e são sinalizados em `uncoveredMinutes`.
 */
import type { Cents, ISODate, Minutes, PriceRule } from './types';
import { weekdayOf } from './dates';

export interface PriceSegment {
  startMin: Minutes;
  endMin: Minutes;
  /** centavos por hora; null = sem regra */
  pricePerHour: Cents | null;
  ruleId: string | null;
  amount: Cents;
}

export interface PriceBreakdown {
  total: Cents;
  segments: PriceSegment[];
  uncoveredMinutes: number;
}

export const ALL_COURTS = '*';

function applicable(rules: PriceRule[], courtId: string, weekday: number): PriceRule[] {
  const specific = rules.filter((r) => r.courtId === courtId && r.weekdays.includes(weekday));
  const generic = rules.filter((r) => r.courtId === ALL_COURTS && r.weekdays.includes(weekday));
  return [...specific, ...generic];
}

export function priceBreakdown(
  rules: PriceRule[],
  courtId: string,
  date: ISODate,
  startMin: Minutes,
  endMin: Minutes,
): PriceBreakdown {
  if (endMin <= startMin) return { total: 0, segments: [], uncoveredMinutes: 0 };
  const candidates = applicable(rules, courtId, weekdayOf(date));

  // Pontos de quebra: início/fim da reserva + limites de todas as regras dentro dela.
  const points = new Set<number>([startMin, endMin]);
  for (const r of candidates) {
    if (r.startMin > startMin && r.startMin < endMin) points.add(r.startMin);
    if (r.endMin > startMin && r.endMin < endMin) points.add(r.endMin);
  }
  const sorted = [...points].sort((a, b) => a - b);

  const segments: PriceSegment[] = [];
  let exact = 0; // soma em "centavos × minutos / 60" sem arredondar por trecho
  let uncovered = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i]!;
    const e = sorted[i + 1]!;
    const rule = candidates.find((r) => r.startMin <= s && r.endMin >= e) ?? null;
    const minutes = e - s;
    const raw = rule ? (rule.price * minutes) / 60 : 0;
    if (!rule) uncovered += minutes;
    exact += raw;
    const last = segments[segments.length - 1];
    // junta trechos consecutivos da mesma regra
    if (last && last.ruleId === (rule?.id ?? null) && last.endMin === s) {
      last.endMin = e;
      last.amount = Math.round(((last.pricePerHour ?? 0) * (last.endMin - last.startMin)) / 60);
    } else {
      segments.push({ startMin: s, endMin: e, pricePerHour: rule?.price ?? null, ruleId: rule?.id ?? null, amount: Math.round(raw) });
    }
  }
  return { total: Math.round(exact), segments, uncoveredMinutes: uncovered };
}

export function priceFor(rules: PriceRule[], courtId: string, date: ISODate, startMin: Minutes, endMin: Minutes): Cents {
  return priceBreakdown(rules, courtId, date, startMin, endMin).total;
}
