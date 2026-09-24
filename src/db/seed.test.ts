import { describe, expect, it } from 'vitest';
import tenant from '../config/tenant.config';
import { generateSeed } from './seed';
import { addDays, dateRange, weekdayOf } from '../domain/dates';
import { itemsOnDate, outsideHours, prepareSchedule } from '../domain/schedule';
import { overlaps } from '../domain/time';
import { classifySlots, emptyHours, receivables } from '../domain/metrics';
import { monthlyDebt } from '../domain/payments';

let n = 0;
const idFn = () => `id-${++n}`;
// Quinta, 24/09/2026 às 15:00 (antes de abrir): dia de semana típico
const NOW = new Date(2026, 8, 24, 15, 0);
const TODAY = '2026-09-24';

describe('dados de exemplo (seed)', () => {
  const data = generateSeed({ tenant, now: NOW, idFn });
  const prep = prepareSchedule({
    courts: data.courts,
    reservations: data.reservations,
    recurrences: data.recurrences,
    blocks: data.blocks,
    openingHours: tenant.openingHours,
  });
  const from = addDays(TODAY, -42);
  const to = addDays(TODAY, 28);

  it('tem a estrutura pedida', () => {
    expect(data.courts.map((c) => c.name)).toEqual(['Quadra 1 · Futsal', 'Quadra 2 · Basquete']);
    expect(data.customers.length).toBeGreaterThanOrEqual(15);
    expect(data.customers.length).toBeLessThanOrEqual(20);
    expect(data.recurrences).toHaveLength(6);
    expect(data.recurrences.filter((r) => r.billingMode === 'mensal')).toHaveLength(2);
    expect(data.blocks).toHaveLength(1);
    expect(data.reservations.filter((r) => r.status === 'falta')).toHaveLength(1);
    expect(data.reservations.filter((r) => r.status === 'cancelada')).toHaveLength(1);
    expect(data.settings.find((s) => s.key === 'courtName')?.value).toBe(tenant.courtName);
  });

  it('não tem NENHUM conflito de horário e respeita o expediente', () => {
    for (const date of dateRange(from, to)) {
      const items = itemsOnDate(prep, date);
      for (let i = 0; i < items.length; i++) {
        const a = items[i]!;
        if (a.kind !== 'bloqueio') expect(outsideHours(tenant.openingHours, date, a.startMin, a.endMin)).toBe(false);
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j]!;
          if (a.courtId === b.courtId) expect(overlaps(a.startMin, a.endMin, b.startMin, b.endMin), `${date} ${a.kind}×${b.kind}`).toBe(false);
        }
      }
    }
  });

  it('um mensalista mensal está devendo e o outro em dia', () => {
    const mensais = data.recurrences.filter((r) => r.billingMode === 'mensal');
    const debts = mensais.map((r) => monthlyDebt(r, data.payments, '2026-09').total);
    expect(debts.filter((d) => d > 0)).toHaveLength(1);
    expect(debts.filter((d) => d === 0)).toHaveLength(1);
  });

  it('pagamentos pendentes de jogos passados: poucos (3 a 6)', () => {
    const items = receivables(prep, data.payments, data.priceRules, { from, to: TODAY }, TODAY, 15 * 60).filter((i) => i.kind !== 'mensalidade');
    // 2 avulsas pendentes + falta (só sinal) + último jogo do Time do João + saldo do Racha do Sábado
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(6);
  });

  it('terças e quartas à tarde têm muitos buracos (horas vazias relevantes)', () => {
    const slots = classifySlots(prep, { from, to: addDays(TODAY, -1) }, 60, TODAY, 0);
    const tueWedAfternoon = slots.filter((s) => [2, 3].includes(weekdayOf(s.date)) && s.startMin < 18 * 60);
    const free = tueWedAfternoon.filter((s) => s.kind === 'livre').length;
    expect(free / tueWedAfternoon.length).toBeGreaterThan(0.8);
    const empty = emptyHours(slots, data.priceRules);
    expect(empty.value).toBeGreaterThan(100_000); // mais de R$ 1.000 em 6 semanas
  });

  it('noites de semana bem ocupadas', () => {
    const slots = classifySlots(prep, { from, to: addDays(TODAY, -1) }, 60, TODAY, 0);
    const nights = slots.filter((s) => ![0, 6].includes(weekdayOf(s.date)) && s.startMin >= 18 * 60);
    const occ = nights.filter((s) => s.kind === 'ocupado').length / nights.length;
    expect(occ).toBeGreaterThan(0.6);
  });

  it('nenhum registro de exemplo com data de criação no futuro', () => {
    const seededAt = NOW.toISOString();
    expect(data.reservations.every((r) => r.createdAt <= seededAt)).toBe(true);
  });

  it('mistura status de pagamento no futuro (sinal e pendente)', () => {
    const paid = new Set(data.payments.map((p) => p.reservationId));
    const future = data.reservations.filter((r) => r.date > TODAY && r.status === 'ativa');
    expect(future.some((r) => paid.has(r.id))).toBe(true);
    expect(future.some((r) => !paid.has(r.id))).toBe(true);
  });
});
