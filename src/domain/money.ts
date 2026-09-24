/** Dinheiro sempre em centavos (inteiros). */
import type { Cents } from './types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlNoCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** 12050 -> "R$ 120,50" (o espaço é o NBSP do Intl) */
export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100);
}

/** 12000 -> "R$ 120"; útil em chips e gráficos. Mantém centavos se houver. */
export function formatBRLShort(cents: Cents): string {
  return cents % 100 === 0 ? brlNoCents.format(cents / 100) : brl.format(cents / 100);
}

/** Reais (número) -> centavos */
export function reaisToCents(reais: number): Cents {
  return Math.round(reais * 100);
}

/**
 * Interpreta texto digitado pelo usuário em centavos.
 * Aceita "120", "120,50", "R$ 1.200,50", "1200.5". Retorna null se inválido.
 */
export function parseBRL(input: string): Cents | null {
  let s = input.replace(/R\$|\s| /g, '').trim();
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}
