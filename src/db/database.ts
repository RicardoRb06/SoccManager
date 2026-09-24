/**
 * Banco local (IndexedDB via Dexie).
 *
 * ATENÇÃO: o nome do banco é `agenda-quadra-<tenantId>` e NUNCA pode mudar entre versões
 * do app, senão os dados do cliente "somem" (ficam num banco antigo que ninguém abre).
 * Mudanças de esquema são feitas SOMENTE adicionando novas versões em `db.version(n)`
 * (ver db/migrations.ts). Nunca edite uma versão já publicada.
 */
import Dexie, { type EntityTable } from 'dexie';
import tenant from '../config/tenant.config';
import type { Block, Court, Customer, DataSet, Payment, PriceRule, Recurrence, Reservation, SettingRow } from '../domain/types';

export interface Snapshot {
  id: string;
  createdAt: string;
  reason: 'diario' | 'antes-de-importar' | 'antes-de-restaurar-exemplo' | 'manual';
  schemaVersion: number;
  counts: Record<string, number>;
  data: DataSet;
}

export const DB_NAME = `agenda-quadra-${tenant.tenantId}`;

export class AgendaDB extends Dexie {
  courts!: EntityTable<Court, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  reservations!: EntityTable<Reservation, 'id'>;
  payments!: EntityTable<Payment, 'id'>;
  recurrences!: EntityTable<Recurrence, 'id'>;
  blocks!: EntityTable<Block, 'id'>;
  priceRules!: EntityTable<PriceRule, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  snapshots!: EntityTable<Snapshot, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);

    // ---------------- Versão 1 (NÃO EDITAR depois de publicado) ----------------
    this.version(1).stores({
      courts: 'id, order',
      customers: 'id, name, phone, deletedAt',
      reservations: 'id, date, courtId, customerId, recurrenceId, [recurrenceId+date], status, deletedAt',
      payments: 'id, reservationId, recurrenceId, [recurrenceId+referenceMonth], paidAt',
      recurrences: 'id, courtId, customerId, status',
      blocks: 'id, dateStart, dateEnd',
      priceRules: 'id, courtId',
      settings: 'key',
      snapshots: 'id, createdAt',
    });

    // Exemplo de como adicionar a versão 2 no futuro:
    // this.version(2).stores({ customers: 'id, name, phone, deletedAt, email' })
    //   .upgrade(tx => tx.table('customers').toCollection().modify(c => { c.email ??= ''; }));
  }
}

export const db = new AgendaDB();

/** Tabelas que fazem parte do backup (tudo menos snapshots). */
export const DATA_TABLES = ['courts', 'customers', 'reservations', 'payments', 'recurrences', 'blocks', 'priceRules', 'settings'] as const;
export type DataTableName = (typeof DATA_TABLES)[number];
