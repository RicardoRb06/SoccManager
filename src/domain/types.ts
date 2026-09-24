/**
 * Entidades do domínio.
 * Convenções (ver README > Decisões técnicas):
 *  - Datas de agenda: string local "YYYY-MM-DD" (tipo ISODate). Nunca Date com fuso.
 *  - Horários: inteiros em minutos desde 00:00 (20:00 = 1200; 24:00 = 1440).
 *  - Dinheiro: inteiros em centavos.
 *  - Timestamps de auditoria (createdAt, paidAt...): string ISO 8601 completa.
 */
import type { Modality, OpeningHours } from '../config/types';

export type { Modality, OpeningHours, DayHours } from '../config/types';

/** "YYYY-MM-DD" */
export type ISODate = string;
/** "YYYY-MM" */
export type ISOMonth = string;
/** Timestamp ISO 8601 completo (ex.: new Date().toISOString()) */
export type ISODateTime = string;
/** Minutos desde 00:00 (0..1440) */
export type Minutes = number;
/** Valor em centavos */
export type Cents = number;

export interface Court {
  id: string;
  name: string;
  modality: Modality;
  active: boolean;
  order: number;
  /** Quadras com o mesmo grupo dividem o mesmo espaço físico. */
  sharedSpaceGroup?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: ISODateTime;
  deletedAt?: ISODateTime;
}

export type ReservationStatus = 'ativa' | 'cancelada' | 'falta';

export interface Reservation {
  id: string;
  courtId: string;
  customerId: string;
  date: ISODate;
  startMin: Minutes;
  endMin: Minutes;
  price: Cents;
  /** true quando o valor foi digitado pelo usuário (não segue a tabela). */
  priceManual?: boolean;
  status: ReservationStatus;
  cancelReason?: string;
  notes?: string;
  /** Presente quando é uma ocorrência materializada de um mensalista. */
  recurrenceId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime;
}

export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'outro';

export interface Payment {
  id: string;
  reservationId?: string;
  /** Para mensalidades: recurrenceId + referenceMonth */
  recurrenceId?: string;
  referenceMonth?: ISOMonth;
  amount: Cents;
  method: PaymentMethod;
  paidAt: ISODateTime;
  note?: string;
}

export type RecurrenceStatus = 'ativo' | 'pausado' | 'encerrado';
export type BillingMode = 'por_jogo' | 'mensal';

export interface Recurrence {
  id: string;
  courtId: string;
  customerId: string;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  startMin: Minutes;
  endMin: Minutes;
  startDate: ISODate;
  endDate?: ISODate;
  status: RecurrenceStatus;
  /** Data a partir da qual está pausado (ocorrências a partir dela não são geradas). */
  pausedAt?: ISODate;
  billingMode: BillingMode;
  /** Por jogo: preço fixo por ocorrência. Ausente = usa a tabela de preços. */
  pricePerGame?: Cents;
  /** Mensal: valor da mensalidade */
  monthlyPrice?: Cents;
  skipDates: ISODate[];
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Block {
  id: string;
  courtIds: string[];
  dateStart: ISODate;
  dateEnd: ISODate;
  /** Ausentes = dia inteiro */
  startMin?: Minutes;
  endMin?: Minutes;
  reason: string;
  createdAt: ISODateTime;
}

export interface PriceRule {
  id: string;
  /** id da quadra ou "*" para todas */
  courtId: string;
  weekdays: number[];
  startMin: Minutes;
  endMin: Minutes;
  /** centavos por hora */
  price: Cents;
}

/** Configurações do estabelecimento guardadas no banco (editáveis no app). */
export interface AppSettings {
  courtName: string;
  shortName: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
  /** Telefone da quadra (só exibição) */
  courtPhone: string;
  openingHours: OpeningHours;
  slotMinutes: 30 | 60;
  weekStartsOn: 0 | 1;
  backupReminderDays: number;
  lastBackupAt: ISODateTime | null;
  onboardingDone: boolean;
  tourDone: boolean;
  seededAt: ISODateTime | null;
  lastSnapshotDate: ISODate | null;
  persistRequested: boolean;
  schemaVersion: number;
}

export type SettingKey = keyof AppSettings;

export interface SettingRow<K extends SettingKey = SettingKey> {
  key: K;
  value: AppSettings[K];
}

/** Conjunto completo de dados (usado em backup, snapshot e seed). */
export interface DataSet {
  courts: Court[];
  customers: Customer[];
  reservations: Reservation[];
  payments: Payment[];
  recurrences: Recurrence[];
  blocks: Block[];
  priceRules: PriceRule[];
  settings: SettingRow[];
}
