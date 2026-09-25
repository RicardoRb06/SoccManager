/**
 * Nova reserva / Editar reserva / Novo mensalista ("Repetir toda semana").
 * Validação de conflito ao vivo: mostra quem ocupa e sugere os 3 horários livres mais próximos.
 * Mensalista: checa as próximas 12 semanas (ou até a data final) e lista as datas em conflito.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Minus, Plus, Repeat, Sparkles } from 'lucide-react';
import { db } from '../../db/database';
import { useSettings } from '../../db/hooks';
import { ConflictError, createRecurrence, recurrenceConflicts, RecurrenceConflictError, rescheduleOccurrence, saveReservation, scheduleForDate } from '../../db/repo';
import type { BillingMode, ISODate, Minutes, PaymentMethod, Reservation } from '../../domain/types';
import { formatDateBR, formatLongDate, isISODate, todayISO, nowMinutes, WEEKDAY_LONG, weekdayOf } from '../../domain/dates';
import { formatDuration, minToHHMM } from '../../domain/time';
import { formatBRL, parseBRL } from '../../domain/money';
import { priceBreakdown } from '../../domain/pricing';
import { hoursOn, occupantsAt, suggestFreeSlots } from '../../domain/schedule';
import { Sheet } from '../../components/ui/Sheet';
import { Button, Chip, Field, Input, Select, Switch, Textarea } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { errorMessage } from '../../utils/text';
import { CustomerPicker, type CustomerChoice } from './CustomerPicker';
import { centsToInput, PAYMENT_METHODS } from '../../components/PaymentSheets';
import { occupantText } from './occupantText';

export type ReservationSheetInit =
  | {
      mode: 'new';
      courtId: string;
      date: ISODate;
      startMin?: Minutes;
      customerId?: string;
      repeat?: boolean;
      duration?: Minutes;
      /** Remarcar jogo de mensalista: a data original é pulada ao salvar */
      rescheduleFrom?: { recurrenceId: string; date: ISODate };
    }
  | { mode: 'edit'; reservation: Reservation };

export function ReservationSheet({
  init,
  onClose,
  onSaved,
  title,
}: {
  init: ReservationSheetInit;
  onClose: () => void;
  /** Chamado após salvar uma reserva avulsa (não é chamado ao criar mensalista). */
  onSaved?: (r: Reservation) => void | Promise<void>;
  title?: string;
}) {
  const settings = useSettings();
  const toast = useToast();
  const slot = settings.slotMinutes;
  const editing = init.mode === 'edit' ? init.reservation : undefined;
  const reschedule = init.mode === 'new' ? init.rescheduleFrom : undefined;

  const [courtId, setCourtId] = useState(editing?.courtId ?? (init.mode === 'new' ? init.courtId : ''));
  const [date, setDate] = useState<ISODate>(editing?.date ?? (init.mode === 'new' ? init.date : todayISO()));
  const [startMin, setStartMin] = useState<Minutes | undefined>(editing?.startMin ?? (init.mode === 'new' ? init.startMin : undefined));
  const [duration, setDuration] = useState<Minutes>(editing ? editing.endMin - editing.startMin : (init.mode === 'new' && init.duration) || 60);
  const [customer, setCustomer] = useState<CustomerChoice>(
    editing ? { kind: 'existing', id: editing.customerId } : init.mode === 'new' && init.customerId ? { kind: 'existing', id: init.customerId } : { kind: 'none' },
  );
  // Mensalista
  const [repeat, setRepeat] = useState(init.mode === 'new' && !!init.repeat);
  const [team, setTeam] = useState('');
  const [hasEnd, setHasEnd] = useState(false);
  const [endDate, setEndDate] = useState<ISODate>('');
  const [billing, setBilling] = useState<BillingMode>('por_jogo');
  const [monthlyText, setMonthlyText] = useState('');
  const [skipConflicts, setSkipConflicts] = useState(false);
  const [priceManual, setPriceManual] = useState(editing?.priceManual ?? false);
  const [priceText, setPriceText] = useState(editing ? centsToInput(editing.price) : '');
  const [depositOn, setDepositOn] = useState(false);
  const [depositText, setDepositText] = useState('');
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const lookups = useLiveQuery(async () => {
    const [courts, customers, priceRules, recurrences] = await Promise.all([
      db.courts.orderBy('order').toArray(),
      db.customers.toArray(),
      db.priceRules.toArray(),
      db.recurrences.toArray(),
    ]);
    return { courts, customers, priceRules, recurrences };
  }, []);
  const prep = useLiveQuery(() => (isISODate(date) ? scheduleForDate(date) : Promise.resolve(undefined)), [date]);

  const activeCourts = useMemo(() => lookups?.courts.filter((c) => c.active || c.id === editing?.courtId) ?? [], [lookups, editing]);
  const hours = hoursOn(settings.openingHours, isISODate(date) ? date : todayISO());

  // Horário inicial padrão: primeiro livre (a partir de agora, se for hoje)
  useEffect(() => {
    if (startMin !== undefined || !prep || !hours) return;
    const notBefore = date === todayISO() ? nowMinutes() - (nowMinutes() % slot) : undefined;
    const sug = suggestFreeSlots(prep, courtId, date, duration, notBefore ?? hours.open, slot, { count: 1, notBefore });
    setStartMin(sug[0]?.startMin ?? hours.open);
  }, [prep, hours, startMin, courtId, date, duration, slot]);

  const endMin = startMin !== undefined ? startMin + duration : undefined;

  const startOptions = useMemo(() => {
    const opts: Minutes[] = [];
    if (hours) for (let s = hours.open; s < hours.close; s += slot) opts.push(s);
    if (startMin !== undefined && !opts.includes(startMin)) opts.push(startMin);
    return opts.sort((a, b) => a - b);
  }, [hours, slot, startMin]);

  const durationChips = [60, 90, 120].filter((d) => d % slot === 0);

  const breakdown = useMemo(
    () => (lookups && startMin !== undefined && endMin !== undefined && isISODate(date) ? priceBreakdown(lookups.priceRules, courtId, date, startMin, endMin) : undefined),
    [lookups, courtId, date, startMin, endMin],
  );
  const autoPrice = breakdown?.total ?? 0;
  const price = priceManual ? parseBRL(priceText) : autoPrice;

  const ignore = editing
    ? { ignoreReservationId: editing.id, ...(editing.recurrenceId ? { ignoreOccurrence: { recurrenceId: editing.recurrenceId, date } } : {}) }
    : reschedule && reschedule.date === date
      ? { ignoreOccurrence: reschedule }
      : {};
  const occupants = prep && startMin !== undefined && endMin !== undefined ? occupantsAt(prep, courtId, date, startMin, endMin, ignore) : [];
  const suggestions =
    prep && occupants.length && startMin !== undefined ? suggestFreeSlots(prep, courtId, date, duration, startMin, slot, { ...ignore, count: 3 }) : [];

  const maps = useMemo(
    () =>
      lookups && {
        customers: new Map(lookups.customers.map((c) => [c.id, c])),
        courts: new Map(lookups.courts.map((c) => [c.id, c])),
        recurrences: new Map(lookups.recurrences.map((r) => [r.id, r])),
      },
    [lookups],
  );

  const deposit = depositOn ? parseBRL(depositText) : null;
  const customerError =
    submitted && (customer.kind === 'none' ? 'Escolha ou cadastre o cliente.' : customer.kind === 'new' && !customer.name.trim() ? 'Informe o nome.' : undefined);
  const priceError = price === null ? 'Valor inválido.' : undefined;
  const depositError = depositOn && (deposit === null || deposit <= 0) ? 'Informe o valor do sinal.' : undefined;
  // Conflitos do mensalista nas próximas semanas (a 1ª data já é checada acima)
  const recConflicts = useLiveQuery(
    () =>
      repeat && startMin !== undefined && endMin !== undefined && isISODate(date)
        ? recurrenceConflicts(
            { courtId, weekday: weekdayOf(date), startMin, endMin, startDate: date, endDate: hasEnd && isISODate(endDate) ? endDate : undefined, skipDates: [] },
            date,
          )
        : Promise.resolve([]),
    [repeat, courtId, date, startMin, endMin, hasEnd, endDate],
  );
  const futureConflicts = (recConflicts ?? []).filter((c) => c.date !== date);
  const monthly = repeat && billing === 'mensal' ? parseBRL(monthlyText) : null;
  const monthlyError = repeat && billing === 'mensal' && (monthly === null || monthly <= 0) ? 'Informe o valor da mensalidade.' : undefined;
  const endError = repeat && hasEnd && (!isISODate(endDate) || endDate < date) ? 'Escolha uma data depois do início.' : undefined;

  const canSave =
    !saving &&
    occupants.length === 0 &&
    startMin !== undefined &&
    price !== null &&
    (repeat ? !monthlyError && !endError && (futureConflicts.length === 0 || skipConflicts) : !depositError);

  async function handleSave() {
    setSubmitted(true);
    if (customer.kind === 'none' || (customer.kind === 'new' && !customer.name.trim())) return;
    if (!canSave || startMin === undefined || endMin === undefined || price === null) return;
    setSaving(true);
    if (repeat) {
      try {
        await createRecurrence({
          courtId,
          ...(customer.kind === 'existing' ? { customerId: customer.id } : { newCustomer: { name: customer.name, phone: customer.phone } }),
          startDate: date,
          startMin,
          endMin,
          endDate: hasEnd ? endDate : undefined,
          billingMode: billing,
          ...(billing === 'mensal' ? { monthlyPrice: monthly ?? 0 } : priceManual ? { pricePerGame: price } : {}),
          notes: team,
          skipDates: skipConflicts ? futureConflicts.map((c) => c.date) : [],
        });
        toast.success(`Mensalista criado: toda ${WEEKDAY_LONG[weekdayOf(date)]} às ${minToHHMM(startMin)}.`);
        onClose();
      } catch (err) {
        toast.error(err instanceof RecurrenceConflictError || err instanceof ConflictError ? 'Surgiu um conflito nas próximas semanas. Confira as datas.' : errorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }
    try {
      const input = {
        id: editing?.id,
        courtId,
        ...(customer.kind === 'existing' ? { customerId: customer.id } : { newCustomer: { name: customer.name, phone: customer.phone } }),
        date,
        startMin,
        endMin,
        price,
        priceManual,
        notes,
        ...(depositOn && deposit ? { deposit: { amount: deposit, method: depositMethod } } : {}),
      };
      const r = reschedule ? await rescheduleOccurrence(reschedule.recurrenceId, reschedule.date, input) : await saveReservation(input);
      toast.success(editing ? 'Reserva atualizada.' : reschedule ? 'Jogo remarcado. A data original ficou livre.' : 'Reserva criada.');
      await onSaved?.(r);
      onClose();
    } catch (err) {
      toast.error(err instanceof ConflictError ? 'Esse horário acabou de ser ocupado. Escolha outro.' : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={title ?? (editing ? 'Editar reserva' : repeat ? 'Novo mensalista' : 'Nova reserva')}
      footer={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{repeat ? (billing === 'mensal' ? 'Mensalidade' : 'Por jogo') : 'Total'}</p>
            <p className="text-lg font-bold tabular-nums">
              {repeat && billing === 'mensal' ? (monthly !== null ? formatBRL(monthly) : '—') : price !== null ? formatBRL(price) : '—'}
            </p>
          </div>
          <Button onClick={handleSave} disabled={!canSave} className="min-w-40">
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : repeat ? 'Criar mensalista' : 'Confirmar reserva'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {activeCourts.length > 1 && (
          <Field label="Quadra">
            <div className="flex flex-wrap gap-2">
              {activeCourts.map((c) => (
                <Chip key={c.id} selected={c.id === courtId} onClick={() => setCourtId(c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" htmlFor="res-date" hint={isISODate(date) ? formatLongDate(date) : undefined}>
            <Input id="res-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <Field label="Início" htmlFor="res-start">
            <Select id="res-start" value={startMin ?? ''} onChange={(e) => setStartMin(Number(e.target.value))} disabled={!startOptions.length}>
              {!startOptions.length && <option value="">Fechado</option>}
              {startOptions.map((m) => (
                <option key={m} value={m}>
                  {minToHHMM(m)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Duração" hint={endMin !== undefined ? `Termina às ${minToHHMM(endMin)}` : undefined}>
          <div className="flex flex-wrap items-center gap-2">
            {durationChips.map((d) => (
              <Chip key={d} selected={duration === d} onClick={() => setDuration(d)}>
                {formatDuration(d)}
              </Chip>
            ))}
            <div className="flex items-center rounded-full border border-input bg-card">
              <button type="button" aria-label="Diminuir duração" className="grid size-11 place-items-center disabled:text-muted-foreground/50" disabled={duration <= slot} onClick={() => setDuration((d) => Math.max(slot, d - slot))}>
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="min-w-12 text-center text-sm font-semibold tabular-nums">{formatDuration(duration)}</span>
              <button type="button" aria-label="Aumentar duração" className="grid size-11 place-items-center disabled:text-muted-foreground/50" disabled={duration >= 8 * 60} onClick={() => setDuration((d) => d + slot)}>
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </Field>

        {occupants.length > 0 && maps && (
          <div role="alert" className="rounded-2xl border border-danger-border bg-danger-soft p-3">
            <p className="flex items-center gap-2 font-semibold text-danger-fg">
              <AlertTriangle className="size-5" aria-hidden /> Horário indisponível
            </p>
            <ul className="mt-1 list-disc pl-6 text-sm text-danger-fg">
              {occupants.map((o, i) => (
                <li key={i}>{occupantText(o, maps, courtId)}</li>
              ))}
            </ul>
            {suggestions.length > 0 ? (
              <>
                <p className="mt-3 text-sm font-medium text-foreground/85">Horários livres mais próximos:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <Chip key={s.startMin} onClick={() => setStartMin(s.startMin)}>
                      {minToHHMM(s.startMin)}–{minToHHMM(s.endMin)}
                    </Chip>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-foreground/85">Não há outro horário livre com essa duração neste dia. Tente outra data ou quadra.</p>
            )}
          </div>
        )}

        <Field label="Cliente">
          {lookups ? <CustomerPicker customers={lookups.customers} value={customer} onChange={setCustomer} error={customerError || undefined} /> : <Input disabled placeholder="Carregando…" />}
        </Field>

        {!(repeat && billing === 'mensal') && (
        <Field
          label="Valor"
          htmlFor="res-price"
          error={priceError}
          hint={
            breakdown && breakdown.uncoveredMinutes > 0 && !priceManual
              ? 'Parte do horário não tem preço na tabela. Confira o valor.'
              : breakdown && breakdown.segments.length > 1 && !priceManual
                ? breakdown.segments.map((s) => `${minToHHMM(s.startMin)}–${minToHHMM(s.endMin)}: ${formatBRL(s.amount)}`).join(' + ')
                : undefined
          }
        >
          <div className="flex items-center gap-2">
            <Input
              id="res-price"
              inputMode="decimal"
              value={priceManual ? priceText : centsToInput(autoPrice)}
              onChange={(e) => {
                setPriceManual(true);
                setPriceText(e.target.value);
              }}
              className="flex-1"
            />
            {priceManual ? (
              <button type="button" className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-brand" onClick={() => setPriceManual(false)}>
                Usar automático
              </button>
            ) : null}
          </div>
          <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${priceManual ? 'text-warning' : 'text-brand-strong'}`}>
            <Sparkles className="size-3.5" aria-hidden />
            {priceManual ? 'Alterado manualmente' : 'Preço automático pela tabela'}
          </p>
        </Field>
        )}

        {!editing && !reschedule && (
          <div className={`rounded-2xl border p-3 ${repeat ? 'border-brand/50 bg-brand-soft/40' : 'border-border'}`}>
            <Switch
              id="res-repeat"
              label={
                <span className="inline-flex items-center gap-2">
                  <Repeat className="size-4 text-brand" aria-hidden /> Repetir toda semana (mensalista)
                </span>
              }
              checked={repeat}
              onChange={(v) => {
                setRepeat(v);
                if (v && !monthlyText && price) setMonthlyText(centsToInput(price * 4));
              }}
            />
            {repeat && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Toda <strong>{isISODate(date) ? WEEKDAY_LONG[weekdayOf(date)] : '—'}</strong>
                  {startMin !== undefined && endMin !== undefined ? ` das ${minToHHMM(startMin)} às ${minToHHMM(endMin)}` : ''}, a partir de{' '}
                  {isISODate(date) ? formatDateBR(date) : '—'}.
                </p>
                <Field label="Nome do time (opcional)" htmlFor="rec-team">
                  <Input id="rec-team" value={team} placeholder="Ex.: Time do João" onChange={(e) => setTeam(e.target.value)} />
                </Field>
                <Field label="Até quando" error={endError}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip selected={!hasEnd} onClick={() => setHasEnd(false)}>
                      Sem data final
                    </Chip>
                    <Chip selected={hasEnd} onClick={() => setHasEnd(true)}>
                      Até uma data
                    </Chip>
                    {hasEnd && <Input type="date" aria-label="Data final" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />}
                  </div>
                </Field>
                <Field label="Cobrança">
                  <div className="flex flex-wrap gap-2">
                    <Chip selected={billing === 'por_jogo'} onClick={() => setBilling('por_jogo')}>
                      Por jogo
                    </Chip>
                    <Chip selected={billing === 'mensal'} onClick={() => setBilling('mensal')}>
                      Mensalidade
                    </Chip>
                  </div>
                </Field>
                {billing === 'mensal' && (
                  <Field label="Valor da mensalidade" htmlFor="rec-monthly" error={monthlyError} hint="Cobrada uma vez por mês, independente de quantos jogos o mês tiver.">
                    <Input id="rec-monthly" inputMode="decimal" value={monthlyText} onChange={(e) => setMonthlyText(e.target.value)} />
                  </Field>
                )}
                {billing === 'por_jogo' && <p className="text-xs text-muted-foreground">Cada jogo usa o valor acima {priceManual ? '(fixo)' : '(tabela de preços)'}.</p>}

                {recConflicts === undefined ? (
                  <p className="text-sm text-muted-foreground">Verificando as próximas semanas…</p>
                ) : futureConflicts.length > 0 ? (
                  <div role="alert" className="rounded-2xl border border-warning-border bg-warning-soft p-3 text-sm text-warning-fg">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="size-4" aria-hidden /> {futureConflicts.length} data(s) já ocupada(s) nas próximas semanas
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                      {futureConflicts.slice(0, 6).map((c) => (
                        <li key={c.date}>
                          {formatDateBR(c.date)}: {maps ? occupantText(c.occupants[0]!, maps, courtId) : ''}
                        </li>
                      ))}
                    </ul>
                    <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 font-medium">
                      <input type="checkbox" className="size-5 accent-[var(--brand-primary)]" checked={skipConflicts} onChange={(e) => setSkipConflicts(e.target.checked)} />
                      Pular essas datas e criar o mensalista
                    </label>
                  </div>
                ) : (
                  <p className="text-sm text-success-fg">Nenhum conflito nas próximas 12 semanas.</p>
                )}
              </div>
            )}
          </div>
        )}

        {!editing && !repeat && (
          <div className="rounded-2xl border border-border p-3">
            <Switch
              id="res-deposit"
              label="Recebeu sinal agora?"
              checked={depositOn}
              onChange={(v) => {
                setDepositOn(v);
                if (v && !depositText && price) setDepositText(centsToInput(Math.round(price / 2)));
              }}
            />
            {depositOn && (
              <div className="mt-2 flex flex-col gap-3">
                <Field label="Valor do sinal" htmlFor="res-deposit-value" error={depositError}>
                  <Input id="res-deposit-value" inputMode="decimal" value={depositText} onChange={(e) => setDepositText(e.target.value)} />
                </Field>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Forma de pagamento">
                  {PAYMENT_METHODS.map((m) => (
                    <Chip key={m.value} selected={depositMethod === m.value} onClick={() => setDepositMethod(m.value)}>
                      {m.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Field label="Observações" htmlFor="res-notes">
          <Textarea id="res-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" rows={2} />
        </Field>

        {!hours && isISODate(date) && <p className="text-sm text-warning">A quadra não abre neste dia da semana.</p>}
      </div>
    </Sheet>
  );
}
