import type { TenantConfig } from './types';

/**
 * ================================================================
 *  CONFIGURAÇÃO DO CLIENTE (TENANT)
 *  Para gerar a versão de outra quadra, edite SOMENTE este arquivo.
 *  Atenção: `tenantId` define o nome do banco de dados no aparelho.
 *  Depois de publicado para um cliente, nunca altere o tenantId.
 * ================================================================
 */
const tenant: TenantConfig = {
  tenantId: 'demo-arena-modelo',
  courtName: 'Arena Modelo',
  shortName: 'Arena',
  logo: '',
  colors: {
    primary: '#15803d', // verde gramado
    accent: '#f59e0b', // âmbar
  },
  icons: {
    icon192: 'icons/icon-192.png',
    icon512: 'icons/icon-512.png',
    maskable512: 'icons/maskable-512.png',
  },
  weekStartsOn: 0,
  slotMinutes: 60,
  // 0 = domingo ... 6 = sábado
  openingHours: [
    { open: 8 * 60, close: 22 * 60 }, // dom
    { open: 16 * 60, close: 23 * 60 }, // seg
    { open: 16 * 60, close: 23 * 60 }, // ter
    { open: 16 * 60, close: 23 * 60 }, // qua
    { open: 16 * 60, close: 23 * 60 }, // qui
    { open: 16 * 60, close: 23 * 60 }, // sex
    { open: 8 * 60, close: 22 * 60 }, // sáb
  ],
  courts: [
    { key: 'q1', name: 'Quadra 1 · Futsal', modality: 'futsal' },
    { key: 'q2', name: 'Quadra 2 · Basquete', modality: 'basquete' },
  ],
  priceRules: [
    // Futsal
    { court: 'q1', weekdays: [1, 2, 3, 4, 5], start: '00:00', end: '18:00', pricePerHour: 90 },
    { court: 'q1', weekdays: [1, 2, 3, 4, 5], start: '18:00', end: '24:00', pricePerHour: 120 },
    { court: 'q1', weekdays: [0, 6], start: '00:00', end: '24:00', pricePerHour: 130 },
    // Basquete
    { court: 'q2', weekdays: [1, 2, 3, 4, 5], start: '00:00', end: '18:00', pricePerHour: 60 },
    { court: 'q2', weekdays: [1, 2, 3, 4, 5], start: '18:00', end: '24:00', pricePerHour: 80 },
    { court: 'q2', weekdays: [0, 6], start: '00:00', end: '24:00', pricePerHour: 90 },
  ],
  // Telefone do vendedor mostrado na demonstração (fictício: troque pelo seu).
  contactPhone: '11999999999',
  backupReminderDays: 7,
  demo: true,
};

export default tenant;
