/**
 * Tipos da configuração do tenant (um cliente/quadra).
 * Este arquivo NÃO pode importar nada do navegador: ele também é lido pelo
 * vite.config.ts (Node) para gerar o manifest do PWA.
 */

export type Modality = 'futsal' | 'basquete' | 'society' | 'volei' | 'outro';

/** Horário de funcionamento de um dia. `null` = fechado. Minutos desde 00:00 (close até 1440). */
export type DayHours = { open: number; close: number } | null;

/** Índice 0 = domingo ... 6 = sábado (igual a Date.getDay()). */
export type OpeningHours = [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

export interface TenantCourt {
  /** Chave estável usada para ligar regras de preço à quadra neste arquivo. */
  key: string;
  name: string;
  modality: Modality;
  sharedSpaceGroup?: string;
}

export interface TenantPriceRule {
  /** `key` da quadra ou "*" para todas. */
  court: string;
  /** 0 = domingo ... 6 = sábado */
  weekdays: number[];
  /** "HH:MM" */
  start: string;
  /** "HH:MM" (use "24:00" para meia-noite) */
  end: string;
  /** Preço por hora em reais (ex.: 90 ou 92.5). Convertido para centavos internamente. */
  pricePerHour: number;
}

export interface TenantConfig {
  /** Identificador estável. Define o nome do banco (agenda-quadra-<tenantId>). NUNCA mude depois de publicar. */
  tenantId: string;
  courtName: string;
  shortName: string;
  /** Caminho em /public (ex.: "logo.png") ou data URL. Vazio = iniciais. */
  logo?: string;
  colors: { primary: string; accent: string };
  /** Ícones do PWA, relativos a /public */
  icons: { icon192: string; icon512: string; maskable512: string };
  weekStartsOn: 0 | 1;
  slotMinutes: 30 | 60;
  openingHours: OpeningHours;
  courts: TenantCourt[];
  priceRules: TenantPriceRule[];
  /** Telefone de contato do vendedor (exibido como texto na demonstração). */
  contactPhone: string;
  /** Telefone da própria quadra (opcional, só exibição). */
  courtPhone?: string;
  backupReminderDays: number;
  demo: boolean;
}
