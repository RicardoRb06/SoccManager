import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgendaDB } from './database';
import { deleteCourt, deletePriceRule, moveCourt, saveCourt, saveOpeningHours, savePriceRule, saveSettings } from './settingsRepo';
import { saveReservation, ValidationError } from './repo';
import { loadSettings } from './bootstrap';
import { defaultSettings, settingsToRows } from './fromTenant';
import tenant from '../config/tenant.config';
import { C1, C2, HOURS } from '../test/fixtures';
import { priceFor } from '../domain/pricing';

let d: AgendaDB;
beforeEach(async () => {
  d = new AgendaDB(`cfg-${Math.random()}`);
  await d.open();
  await d.courts.bulkAdd([C1, C2]);
  await d.settings.bulkPut(settingsToRows({ ...defaultSettings(tenant), openingHours: HOURS }));
  await d.customers.add({ id: 'cust1', name: 'Ana', phone: '', createdAt: '2026-09-01T00:00:00Z' });
});
afterEach(async () => {
  await d.delete();
});

describe('configurações', () => {
  it('salva dados da quadra e mantém o resto', async () => {
    await saveSettings({ courtName: 'Arena Nova', pixKey: 'x@y' }, d);
    const s = await loadSettings(d);
    expect(s.courtName).toBe('Arena Nova');
    expect(s.pixKey).toBe('x@y');
    expect(s.slotMinutes).toBe(tenant.slotMinutes);
  });

  it('valida horário de funcionamento', async () => {
    await expect(saveOpeningHours([null, null, null, null, null, null, null], d)).rejects.toBeInstanceOf(ValidationError);
    const bad = [...HOURS] as typeof HOURS;
    bad[1] = { open: 1200, close: 1100 };
    await expect(saveOpeningHours(bad, d)).rejects.toBeInstanceOf(ValidationError);
    const ok = [...HOURS] as typeof HOURS;
    ok[0] = null;
    await saveOpeningHours(ok, d);
    expect((await loadSettings(d)).openingHours[0]).toBeNull();
  });

  it('cria, reordena e protege quadras com histórico', async () => {
    const c3 = await saveCourt({ name: 'Quadra 3', modality: 'volei', active: true }, d);
    expect(c3.order).toBe(2);
    await expect(saveCourt({ name: 'quadra 3', modality: 'volei', active: true }, d)).rejects.toBeInstanceOf(ValidationError);
    await moveCourt(c3.id, -1, d);
    expect((await d.courts.get(c3.id))?.order).toBe(1);
    await saveReservation({ courtId: 'c1', customerId: 'cust1', date: '2026-09-22', startMin: 1200, endMin: 1260, price: 1, priceManual: true }, d);
    await expect(deleteCourt('c1', d)).rejects.toBeInstanceOf(ValidationError);
    await deleteCourt(c3.id, d);
    expect(await d.courts.get(c3.id)).toBeUndefined();
  });

  it('tabela de preços: cria, edita e remove regra', async () => {
    await expect(savePriceRule({ courtId: 'c1', weekdays: [], startMin: 0, endMin: 60, price: 100 }, d)).rejects.toBeInstanceOf(ValidationError);
    const r = await savePriceRule({ courtId: 'c1', weekdays: [2, 2, 1], startMin: 1080, endMin: 1440, price: 15000 }, d);
    expect(r.weekdays).toEqual([1, 2]);
    expect(priceFor(await d.priceRules.toArray(), 'c1', '2026-09-22', 1200, 1260)).toBe(15000);
    await savePriceRule({ ...r, price: 16000 }, d);
    expect(await d.priceRules.count()).toBe(1);
    await deletePriceRule(r.id, d);
    expect(await d.priceRules.count()).toBe(0);
  });
});
