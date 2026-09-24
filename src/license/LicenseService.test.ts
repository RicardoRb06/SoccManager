import { describe, expect, it } from 'vitest';
import { createLicenseService } from './LicenseService';

describe('LicenseService (esboço)', () => {
  it('demo: true → versão de demonstração', () => {
    const s = createLicenseService({ demo: true, courtName: 'Arena X' });
    expect(s.getStatus()).toEqual({ mode: 'demo' });
    expect(s.isDemo()).toBe(true);
  });
  it('demo: false → licenciado para a quadra do tenant', () => {
    const s = createLicenseService({ demo: false, courtName: 'Arena X' });
    expect(s.getStatus()).toEqual({ mode: 'licensed', licensedTo: 'Arena X' });
    expect(s.isDemo()).toBe(false);
  });
});
