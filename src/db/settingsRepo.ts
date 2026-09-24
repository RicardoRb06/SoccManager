/** Gravação de configurações: dados da quadra, quadras, horários e tabela de preços. */
import type { AppSettings, Court, Modality, OpeningHours, PriceRule } from '../domain/types';
import { isValidRange } from '../domain/time';
import { ALL_COURTS } from '../domain/pricing';
import { newId } from '../utils/id';
import { db, type AgendaDB } from './database';
import { ValidationError } from './repo';

export async function saveSettings(patch: Partial<AppSettings>, database: AgendaDB = db): Promise<void> {
  const rows = (Object.keys(patch) as Array<keyof AppSettings>).map((key) => ({ key, value: patch[key] as never }));
  await database.settings.bulkPut(rows);
}

export function validateOpeningHours(h: OpeningHours): void {
  if (h.length !== 7) throw new ValidationError('Horário de funcionamento incompleto.');
  h.forEach((d, i) => {
    if (d && !isValidRange(d.open, d.close)) throw new ValidationError(`Confira o horário de ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][i]}: a abertura deve ser antes do fechamento.`);
  });
  if (h.every((d) => d === null)) throw new ValidationError('A quadra precisa abrir em pelo menos um dia.');
}

export async function saveOpeningHours(h: OpeningHours, database: AgendaDB = db): Promise<void> {
  validateOpeningHours(h);
  await saveSettings({ openingHours: h }, database);
}

// ------------------------------------------------------------------ quadras

export interface CourtInput {
  id?: string;
  name: string;
  modality: Modality;
  active: boolean;
  sharedSpaceGroup?: string;
}

export async function saveCourt(input: CourtInput, database: AgendaDB = db): Promise<Court> {
  const name = input.name.trim();
  if (!name) throw new ValidationError('Informe o nome da quadra.');
  return database.transaction('rw', database.courts, async () => {
    const all = await database.courts.toArray();
    if (all.some((c) => c.id !== input.id && c.name.trim().toLowerCase() === name.toLowerCase())) throw new ValidationError('Já existe uma quadra com esse nome.');
    const existing = input.id ? all.find((c) => c.id === input.id) : undefined;
    const group = input.sharedSpaceGroup?.trim();
    const court: Court = {
      id: existing?.id ?? newId(),
      name,
      modality: input.modality,
      active: input.active,
      order: existing?.order ?? Math.max(-1, ...all.map((c) => c.order)) + 1,
      ...(group ? { sharedSpaceGroup: group } : {}),
    };
    await database.courts.put(court);
    return court;
  });
}

/** Troca a posição com a vizinha (-1 = sobe, +1 = desce). */
export async function moveCourt(id: string, dir: -1 | 1, database: AgendaDB = db): Promise<void> {
  await database.transaction('rw', database.courts, async () => {
    const all = (await database.courts.toArray()).sort((a, b) => a.order - b.order);
    const i = all.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    const a = all[i]!;
    const b = all[j]!;
    await database.courts.bulkPut([{ ...a, order: b.order }, { ...b, order: a.order }]);
  });
}

/** Exclui só se a quadra nunca foi usada; senão, sugere desativar (mantém o histórico). */
export async function deleteCourt(id: string, database: AgendaDB = db): Promise<void> {
  await database.transaction('rw', [database.courts, database.reservations, database.recurrences, database.blocks, database.priceRules], async () => {
    const used =
      (await database.reservations.where('courtId').equals(id).count()) > 0 ||
      (await database.recurrences.where('courtId').equals(id).count()) > 0 ||
      (await database.blocks.filter((b) => b.courtIds.includes(id)).count()) > 0;
    if (used) throw new ValidationError('Esta quadra já tem reservas no histórico. Desative-a em vez de excluir.');
    if ((await database.courts.count()) <= 1) throw new ValidationError('É preciso ter pelo menos uma quadra.');
    await database.priceRules.where('courtId').equals(id).delete();
    await database.courts.delete(id);
  });
}

// ------------------------------------------------------------------ tabela de preços

export interface PriceRuleInput {
  id?: string;
  courtId: string;
  weekdays: number[];
  startMin: number;
  endMin: number;
  price: number;
}

export function validatePriceRule(r: PriceRuleInput): void {
  if (!r.courtId) throw new ValidationError('Escolha a quadra.');
  if (!r.weekdays.length) throw new ValidationError('Escolha pelo menos um dia da semana.');
  if (!isValidRange(r.startMin, r.endMin)) throw new ValidationError('O horário final deve ser depois do inicial.');
  if (!Number.isInteger(r.price) || r.price < 0) throw new ValidationError('Preço inválido.');
}

export async function savePriceRule(input: PriceRuleInput, database: AgendaDB = db): Promise<PriceRule> {
  validatePriceRule(input);
  if (input.courtId !== ALL_COURTS && !(await database.courts.get(input.courtId))) throw new ValidationError('Quadra não encontrada.');
  const rule: PriceRule = {
    id: input.id ?? newId(),
    courtId: input.courtId,
    weekdays: [...new Set(input.weekdays)].sort(),
    startMin: input.startMin,
    endMin: input.endMin,
    price: input.price,
  };
  await database.priceRules.put(rule);
  return rule;
}

export async function deletePriceRule(id: string, database: AgendaDB = db): Promise<void> {
  await database.priceRules.delete(id);
}
