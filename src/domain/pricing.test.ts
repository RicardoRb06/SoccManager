import { describe, expect, it } from 'vitest';
import { priceBreakdown, priceFor } from './pricing';
import { RULES } from '../test/fixtures';

// 2026-09-22 = terça; 2026-09-26 = sábado
describe('preço automático', () => {
  it('usa a faixa da tarde e da noite', () => {
    expect(priceFor(RULES, 'c1', '2026-09-22', 960, 1020)).toBe(9000);
    expect(priceFor(RULES, 'c1', '2026-09-22', 1200, 1260)).toBe(12000);
  });

  it('soma proporcional quando cruza duas faixas (1h30 17:30–19:00)', () => {
    // 30 min a 90/h = 45 ; 60 min a 120/h = 120 → 165
    const b = priceBreakdown(RULES, 'c1', '2026-09-22', 1050, 1140);
    expect(b.total).toBe(16500);
    expect(b.segments.map((s) => [s.startMin, s.endMin, s.amount])).toEqual([
      [1050, 1080, 4500],
      [1080, 1140, 12000],
    ]);
    expect(b.uncoveredMinutes).toBe(0);
  });

  it('fim de semana tem preço próprio', () => {
    expect(priceFor(RULES, 'c1', '2026-09-26', 540, 660)).toBe(26000);
  });

  it('regra específica da quadra vence a regra "*"', () => {
    // c1 tem regra própria (120), "*" diria 50
    expect(priceFor(RULES, 'c1', '2026-09-22', 1200, 1260)).toBe(12000);
    // c2 só tem a "*"
    expect(priceFor(RULES, 'c2', '2026-09-22', 1200, 1260)).toBe(5000);
  });

  it('trecho sem regra fica com preço 0 e é sinalizado', () => {
    const rules = [{ id: 'x', courtId: 'c9', weekdays: [2], startMin: 1080, endMin: 1200, price: 6000 }];
    const b = priceBreakdown(rules, 'c9', '2026-09-22', 1140, 1260);
    expect(b.total).toBe(6000);
    expect(b.uncoveredMinutes).toBe(60);
  });

  it('arredonda só no final (sem erro acumulado)', () => {
    const rules = [{ id: 'x', courtId: '*', weekdays: [2], startMin: 0, endMin: 1440, price: 10001 }];
    expect(priceFor(rules, 'c1', '2026-09-22', 0, 90)).toBe(15002); // 150,015 → 150,02
  });

  it('intervalo vazio ou invertido = 0', () => {
    expect(priceFor(RULES, 'c1', '2026-09-22', 1200, 1200)).toBe(0);
  });
});
