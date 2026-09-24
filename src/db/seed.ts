/**
 * Dados de exemplo gerados RELATIVOS À DATA ATUAL (sempre parecem "vivos"):
 * últimas 6 semanas + próximas 4.
 * Puro e determinístico (PRNG com semente fixa) para ser testável.
 */
import type { TenantConfig } from '../config/types';
import type {
  Block, Customer, DataSet, ISODate, ISODateTime, Payment, PaymentMethod, Recurrence, Reservation,
} from '../domain/types';
import { addDays, dateRange, diffDays, firstDayOfMonth, monthOf, parseISODate, weekdayOf } from '../domain/dates';
import { hhmmToMin } from '../domain/time';
import { priceFor } from '../domain/pricing';
import { occurrenceDates, occurrencePrice } from '../domain/recurrence';
import { billableMonths } from '../domain/payments';
import { reaisToCents } from '../domain/money';
import { defaultSettings, settingsToRows, tenantEntities } from './fromTenant';

export interface SeedOptions {
  tenant: TenantConfig;
  now?: Date;
  idFn: () => string;
  seed?: number;
  pastWeeks?: number;
  futureWeeks?: number;
}

/** PRNG determinístico (mulberry32). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMER_NAMES = [
  'João Ribeiro', 'Pedro Almeida', 'Carlos Menezes', 'Ricardo Souza', 'Marcos Oliveira', 'Fernanda Lima',
  'Lucas Pereira', 'Rafael Costa', 'Bruno Carvalho', 'Thiago Martins', 'Gustavo Rocha', 'Felipe Araújo',
  'André Barbosa', 'Diego Nascimento', 'Juliana Santos', 'Rodrigo Teixeira', 'Vinícius Moreira', 'Paulo Henrique Dias',
];

/** Telefones claramente fictícios: (11) 90000-00NN */
function fakePhone(i: number): string {
  return `(11) 90000-${String(i + 1).padStart(4, '0')}`;
}

/** Converte data local + minutos em timestamp ISO (fuso do aparelho). */
function localDateTime(date: ISODate, min: number): ISODateTime {
  const { y, m, d } = parseISODate(date);
  return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).toISOString();
}

interface RecSpec {
  customer: number;
  team: string;
  court: string;
  weekday: number;
  start: string;
  end: string;
  billing: 'por_jogo' | 'mensal';
  monthly?: number;
  debtCurrentMonth?: boolean;
}

const RECURRENCES: RecSpec[] = [
  { customer: 0, team: 'Time do João', court: 'q1', weekday: 2, start: '20:00', end: '21:00', billing: 'por_jogo' },
  { customer: 1, team: 'Amigos do Pedro', court: 'q1', weekday: 4, start: '21:00', end: '22:00', billing: 'mensal', monthly: 440 },
  { customer: 2, team: 'Basquete da Vila', court: 'q2', weekday: 3, start: '19:00', end: '20:00', billing: 'por_jogo' },
  { customer: 3, team: 'Pelada dos Coroas', court: 'q1', weekday: 1, start: '19:00', end: '20:00', billing: 'mensal', monthly: 450, debtCurrentMonth: true },
  { customer: 4, team: 'Racha do Sábado', court: 'q1', weekday: 6, start: '09:00', end: '11:00', billing: 'por_jogo' },
  { customer: 5, team: 'Basquete das Meninas', court: 'q2', weekday: 5, start: '18:00', end: '19:00', billing: 'por_jogo' },
];

export function generateSeed(opts: SeedOptions): DataSet {
  const { tenant, idFn } = opts;
  const now = opts.now ?? new Date();
  const nowISO = now.toISOString();
  const rand = mulberry32(opts.seed ?? 20260924);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const from = addDays(today, -7 * (opts.pastWeeks ?? 6));
  const to = addDays(today, 7 * (opts.futureWeeks ?? 4));

  const { courts, priceRules, courtIdByKey } = tenantEntities(tenant, idFn);
  const courtKeys = tenant.courts.map((c) => c.key);
  const courtId = (key: string) => courtIdByKey.get(key) ?? courts[0]!.id;
  const hours = tenant.openingHours;
  const slot = 60;

  // ------------------------------------------------------------ clientes
  const customers: Customer[] = CUSTOMER_NAMES.map((name, i) => ({
    id: idFn(),
    name,
    phone: fakePhone(i),
    createdAt: localDateTime(addDays(from, -30 + i), 10 * 60),
  }));
  customers[3]!.notes = 'Costuma pagar a mensalidade no começo do mês.';
  customers[9]!.notes = 'Prefere horários depois das 21h.';

  const reservations: Reservation[] = [];
  const payments: Payment[] = [];
  const recurrences: Recurrence[] = [];
  const blocks: Block[] = [];

  /** Ocupação: "courtId|date" -> minutos ocupados (por hora cheia) */
  const busy = new Set<string>();
  const mark = (cid: string, date: ISODate, s: number, e: number) => {
    for (let m = s; m < e; m += 30) busy.add(`${cid}|${date}|${m}`);
  };
  const isBusy = (cid: string, date: ISODate, s: number, e: number) => {
    for (let m = s; m < e; m += 30) if (busy.has(`${cid}|${date}|${m}`)) return true;
    return false;
  };

  const addPayment = (p: Omit<Payment, 'id'>) => payments.push({ id: idFn(), ...p });
  const method = (): PaymentMethod => {
    const r = rand();
    return r < 0.6 ? 'pix' : r < 0.9 ? 'dinheiro' : 'cartao';
  };
  const isPast = (date: ISODate, endMin: number) => date < today || (date === today && endMin <= nowMin);

  // ------------------------------------------------------------ bloqueio (manutenção)
  const blockDate = addDays(today, 3);
  const q2 = courtId(courtKeys[1] ?? courtKeys[0]!);
  const blockHours = hours[weekdayOf(blockDate)];
  if (blockHours) {
    const bs = blockHours.open;
    const be = Math.min(blockHours.open + 180, blockHours.close);
    blocks.push({ id: idFn(), courtIds: [q2], dateStart: blockDate, dateEnd: blockDate, startMin: bs, endMin: be, reason: 'Manutenção do piso', createdAt: nowISO });
    mark(q2, blockDate, bs, be);
  }

  // ------------------------------------------------------------ mensalistas
  RECURRENCES.forEach((spec, idx) => {
    const cust = customers[spec.customer]!;
    const cid = courtId(courtKeys.includes(spec.court) ? spec.court : courtKeys[0]!);
    const rec: Recurrence = {
      id: idFn(),
      courtId: cid,
      customerId: cust.id,
      weekday: spec.weekday,
      startMin: hhmmToMin(spec.start),
      endMin: hhmmToMin(spec.end),
      startDate: from,
      status: 'ativo',
      billingMode: spec.billing,
      ...(spec.monthly ? { monthlyPrice: reaisToCents(spec.monthly) } : {}),
      skipDates: [],
      notes: spec.team,
      createdAt: localDateTime(from, 12 * 60),
      updatedAt: localDateTime(from, 12 * 60),
    };
    // Uma exceção futura para mostrar "pular data" (feriado) no Time do João
    if (idx === 0) {
      const next = occurrenceDates(rec, addDays(today, 8), to)[0];
      if (next) rec.skipDates.push(next);
    }
    recurrences.push(rec);

    const dates = occurrenceDates(rec, from, to);
    for (const d of dates) {
      const h = hours[weekdayOf(d)];
      if (h && (rec.startMin < h.open || rec.endMin > h.close)) throw new Error(`Seed: mensalista fora do expediente em ${d}`);
      mark(cid, d, rec.startMin, rec.endMin);
    }

    if (spec.billing === 'por_jogo') {
      // Materializa os jogos já passados, com pagamento (histórico realista)
      const pastDates = dates.filter((d) => isPast(d, rec.endMin));
      pastDates.forEach((d, i) => {
        const price = occurrencePrice(rec, priceRules, d);
        const res: Reservation = {
          id: idFn(), courtId: cid, customerId: cust.id, date: d, startMin: rec.startMin, endMin: rec.endMin,
          price, status: 'ativa', recurrenceId: rec.id,
          createdAt: localDateTime(d, rec.startMin), updatedAt: localDateTime(d, rec.endMin),
        };
        reservations.push(res);
        const isLast = i === pastDates.length - 1;
        if (idx === 0 && isLast) return; // Time do João: último jogo PENDENTE
        if (idx === 4 && isLast) {
          // Racha do Sábado: último jogo só com sinal
          addPayment({ reservationId: res.id, amount: Math.round(price / 2), method: 'pix', paidAt: localDateTime(d, rec.startMin - 60), note: 'Sinal' });
          return;
        }
        addPayment({ reservationId: res.id, amount: price, method: method(), paidAt: localDateTime(d, rec.endMin) });
      });
    } else {
      // Mensalidades
      const current = monthOf(today);
      for (const m of billableMonths(rec, current)) {
        if (spec.debtCurrentMonth && m === current) continue; // devendo o mês atual
        const payDay = m === monthOf(from) ? from : firstDayOfMonth(m);
        const payDate = payDay < from ? from : payDay;
        addPayment({ recurrenceId: rec.id, referenceMonth: m, amount: rec.monthlyPrice ?? 0, method: 'pix', paidAt: localDateTime(addDays(payDate, 2), 10 * 60), note: 'Mensalidade' });
      }
    }
  });

  // ------------------------------------------------------------ avulsas
  const regulars = customers.slice(RECURRENCES.length); // clientes avulsos
  const probability = (date: ISODate, key: string, s: number): number => {
    const wd = weekdayOf(date);
    const isQ1 = key === courtKeys[0];
    let p: number;
    if (wd === 0 || wd === 6) {
      p = isQ1 ? 0.65 : 0.45;
      if (s < 10 * 60) p *= 0.6;
    } else if (s >= 18 * 60) {
      p = isQ1 ? 0.8 : 0.55;
    } else {
      p = wd === 2 || wd === 3 ? 0.05 : isQ1 ? 0.35 : 0.22; // terça/quarta à tarde: buracos
    }
    const ahead = Math.max(0, diffDays(today, date));
    if (ahead >= 1 && ahead <= 7) p *= 0.7;
    else if (ahead > 7 && ahead <= 14) p *= 0.45;
    else if (ahead > 14) p *= 0.22;
    return p;
  };

  const avulsas: Reservation[] = [];
  for (const date of dateRange(from, to)) {
    const h = hours[weekdayOf(date)];
    if (!h) continue;
    for (const key of courtKeys) {
      const cid = courtId(key);
      for (let s = h.open; s + slot <= h.close; s += slot) {
        if (isBusy(cid, date, s, s + slot)) continue;
        if (rand() > probability(date, key, s)) continue;
        let e = s + slot;
        if (rand() < 0.18 && e + slot <= h.close && !isBusy(cid, date, e, e + slot)) e += slot;
        mark(cid, date, s, e);
        const cust = pick(regulars);
        const created = addDays(date, -1 - Math.floor(rand() * 6));
        // nunca "no futuro": reservas de exemplo são sempre anteriores à geração dos dados
        const createdAt = [localDateTime(created, 14 * 60), nowISO].sort()[0]!;
        const res: Reservation = {
          id: idFn(), courtId: cid, customerId: cust.id, date, startMin: s, endMin: e,
          price: priceFor(priceRules, cid, date, s, e), status: 'ativa',
          createdAt, updatedAt: createdAt,
        };
        avulsas.push(res);
      }
    }
  }
  reservations.push(...avulsas);

  // Casos especiais: 2 pendentes recentes, 1 falta, 1 cancelamento
  const past = avulsas.filter((r) => isPast(r.date, r.endMin));
  const future = avulsas.filter((r) => !isPast(r.date, r.endMin));
  const recentPast = past.filter((r) => r.date >= addDays(today, -10));
  const pendingIds = new Set<string>();
  const specials = [...recentPast].reverse();
  const pend1 = specials[1];
  const pend2 = specials[5];
  const falta = specials[8] ?? past[past.length - 1];
  if (pend1) pendingIds.add(pend1.id);
  if (pend2) pendingIds.add(pend2.id);
  if (falta) {
    falta.status = 'falta';
    falta.notes = 'Time não apareceu e não avisou.';
  }
  const cancel = future.find((r) => r.date > addDays(today, 1));
  if (cancel) {
    cancel.status = 'cancelada';
    cancel.cancelReason = 'Time desfalcado, remarcaram para outra semana.';
    cancel.updatedAt = nowISO;
  }

  for (const r of past) {
    if (pendingIds.has(r.id)) continue;
    if (r.id === falta?.id) {
      addPayment({ reservationId: r.id, amount: Math.round(r.price * 0.3), method: 'pix', paidAt: localDateTime(r.createdAt.slice(0, 10) as ISODate, 15 * 60), note: 'Sinal' });
      continue;
    }
    const roll = rand();
    if (roll < 0.1) {
      // pagou sinal antes e o resto no dia
      const sinal = Math.round(r.price / 2);
      addPayment({ reservationId: r.id, amount: sinal, method: 'pix', paidAt: localDateTime(addDays(r.date, -1), 12 * 60), note: 'Sinal' });
      addPayment({ reservationId: r.id, amount: r.price - sinal, method: method(), paidAt: localDateTime(r.date, r.endMin) });
    } else {
      addPayment({ reservationId: r.id, amount: r.price, method: method(), paidAt: localDateTime(r.date, r.endMin) });
    }
  }
  for (const r of future) {
    if (r.status === 'cancelada') continue;
    if (rand() < 0.35) {
      const paidAtDate = r.date > today ? today : r.date;
      addPayment({ reservationId: r.id, amount: Math.round(r.price / 2), method: 'pix', paidAt: localDateTime(paidAtDate, Math.min(nowMin, 12 * 60)), note: 'Sinal' });
    }
  }

  const settings = { ...defaultSettings(tenant), seededAt: nowISO, onboardingDone: true };

  return {
    courts,
    customers,
    reservations: reservations.sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1)),
    payments,
    recurrences,
    blocks,
    priceRules,
    settings: settingsToRows(settings),
  };
}
