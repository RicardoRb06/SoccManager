/** Links e mensagens de WhatsApp (wa.me). */
import type { WhatsAppTemplates } from './types';
import { formatDateBR, formatMonthBR, WEEKDAY_LONG, weekdayOf } from './dates';
import { formatDuration, minToHHMM } from './time';
import { formatBRL } from './money';

export const DEFAULT_TEMPLATES: WhatsAppTemplates = {
  confirmar:
    'Olá, {cliente}! Confirmando seu horário na {quadra} da {nomeQuadra}: {diaSemana}, {data} às {hora} ({duracao}). Valor: {valor}. Pode confirmar?',
  lembrar: 'Olá, {cliente}! Lembrete: hoje tem jogo na {quadra} da {nomeQuadra}, às {hora}. Até mais tarde!',
  cobrar: 'Olá, {cliente}! Passando para lembrar do saldo de {saldo} referente ao jogo de {data}. Pix: {chavePix}. Obrigado!',
  mensalidade:
    'Olá, {cliente}! Passando para lembrar da mensalidade de {mes} do seu horário de {diaSemana} às {hora} na {nomeQuadra}: {saldo}. Pix: {chavePix}. Obrigado!',
};

export const TEMPLATE_VARIABLES = [
  'cliente', 'quadra', 'nomeQuadra', 'diaSemana', 'data', 'hora', 'duracao', 'valor', 'saldo', 'chavePix', 'mes',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
export type TemplateValues = Partial<Record<TemplateVariable, string>>;

/**
 * Normaliza para somente dígitos. Se tiver 10 ou 11 dígitos (DDD + número),
 * prefixa 55 (Brasil). Retorna "" se não houver dígitos suficientes.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length < 10) return '';
  return digits;
}

/** Substitui {variavel} pelos valores. Variáveis sem valor ficam vazias. */
export function fillTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if ((TEMPLATE_VARIABLES as readonly string[]).includes(key)) return values[key as TemplateVariable] ?? '';
    return `{${key}}`;
  });
}

/** https://wa.me/<telefone>?text=<mensagem>. Sem telefone válido, abre o seletor de contato do WhatsApp. */
export function waLink(phone: string, message: string): string {
  const p = normalizePhone(phone);
  const text = encodeURIComponent(message);
  return p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Formata telefone para exibição: (11) 98765-4321 */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  const local = d.length > 11 && d.startsWith('55') ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

export interface MessageContext {
  customerName: string;
  courtName: string;
  venueName: string;
  date: string; // ISODate
  startMin: number;
  endMin: number;
  price: number; // centavos
  balance: number; // centavos
  pixKey: string;
  /** "YYYY-MM" (mensalidade) */
  month?: string;
}

/** Monta os valores das variáveis a partir de uma reserva/ocorrência. */
export function templateValues(ctx: MessageContext): TemplateValues {
  return {
    cliente: ctx.customerName.split(/\s+/)[0] ?? ctx.customerName,
    quadra: ctx.courtName,
    nomeQuadra: ctx.venueName,
    diaSemana: WEEKDAY_LONG[weekdayOf(ctx.date)],
    data: formatDateBR(ctx.date),
    hora: minToHHMM(ctx.startMin),
    duracao: formatDuration(ctx.endMin - ctx.startMin),
    valor: formatBRL(ctx.price),
    saldo: formatBRL(ctx.balance),
    chavePix: ctx.pixKey || '(peça a chave Pix no balcão)',
    mes: ctx.month ? formatMonthBR(ctx.month) : '',
  };
}
