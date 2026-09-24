/**
 * Licença (esboço). Hoje a situação vem só do `tenant.config.ts`:
 *  - `demo: true`  → versão de demonstração;
 *  - `demo: false` → licenciado para a quadra do arquivo.
 * Não há verificação online, chave nem expiração: é o ponto único onde isso
 * entraria no futuro, sem mexer nas telas.
 */
import type { TenantConfig } from '../config/types';
import tenant from '../config/tenant.config';

export type LicenseStatus = { mode: 'demo' } | { mode: 'licensed'; licensedTo: string };

export interface LicenseService {
  getStatus(): LicenseStatus;
  isDemo(): boolean;
}

export function createLicenseService(t: Pick<TenantConfig, 'demo' | 'courtName'>): LicenseService {
  const status: LicenseStatus = t.demo ? { mode: 'demo' } : { mode: 'licensed', licensedTo: t.courtName };
  return {
    getStatus: () => status,
    isDemo: () => status.mode === 'demo',
  };
}

export const licenseService = createLicenseService(tenant);
