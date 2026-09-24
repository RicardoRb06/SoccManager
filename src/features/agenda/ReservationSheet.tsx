/**
 * Nova reserva / Editar reserva.
 * Validação de conflito ao vivo: mostra quem ocupa e sugere os 3 horários livres mais próximos.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Minus, Plus, Sparkles } from 'lucide-react';
import { db } from '../../db/database';
import { useSettings } from '../../db/hooks';
import { ConflictError, saveReservation, scheduleForDate } from '../../db/repo';
import type { ISODate, Minutes, PaymentMethod, Reservation } from '../../domain/types';
import { formatLongDate, isISODate, todayISO, nowMinutes } from '../../domain/dates';
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
  | { mode: 'new'; courtId: string; date: ISODate; startMin?: Minutes }
  | { mode: 'edit'; reservation: Reservation };

export function ReservationSheet({ init, onClose, onSaved }: { init: ReservationSheetInit; onClose: () => void; onSaved?: (r: Reservation) => void }) {
  const settings = useSettings();
  const toast = useToast();
  const slot = settings.slotMinutes;
  const editing = init.mode === 'edit' ? init.reservation : undefined;

  const [courtId, setCourtId] = useState(editing?.courtId ?? (init.mode === 'new' ? init.courtId : ''));
  const [date, setDate] = useState<ISODate>(editing?.date ?? (init.mode === 'new' ? init.date : todayISO()));
  const [startMin, setStartMin] = useState<Minutes | undefined>(editing?.startMin ?? (init.mode === 'new' ? init.startMin : undefined));
  const [duration, setDuration] = useState<Minutes>(editing ? editing.endMin - editing.startMin : 60);
  const [customer, setCustomer] = useState<CustomerChoice>(editing ? { kind: 'existing', id: editing.customerId } : { kind: 'none' });
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
  const canSave = !saving && occupants.length === 0 && startMin !== undefined && price !== null && !depositError;

  async function handleSave() {
    setSubmitted(true);
    if (customer.kind === 'none' || (customer.kind === 'new' && !customer.name.trim())) return;
    if (!canSave || startMin === undefined || endMin === undefined || price === null) return;
    setSaving(true);
    try {
      const r = await saveReservation({
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
      });
      toast.success(editing ? 'Reserva atualizada.' : 'Reserva criada.');
      onSaved?.(r);
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
      title={editing ? 'Editar reserva' : 'Nova reserva'}
      footer={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-bold tabular-nums">{price !== null ? formatBRL(price) : '—'}</p>
          </div>
          <Button onClick={handleSave} disabled={!canSave} className="min-w-40">
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Confirmar reserva'}
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
            <div className="flex items-center rounded-full border border-slate-300 bg-white">
              <button type="button" aria-label="Diminuir duração" className="grid size-11 place-items-center disabled:text-slate-300" disabled={duration <= slot} onClick={() => setDuration((d) => Math.max(slot, d - slot))}>
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="min-w-12 text-center text-sm font-semibold tabular-nums">{formatDuration(duration)}</span>
              <button type="button" aria-label="Aumentar duração" className="grid size-11 place-items-center disabled:text-slate-300" disabled={duration >= 8 * 60} onClick={() => setDuration((d) => d + slot)}>
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </Field>

        {occupants.length > 0 && maps && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3">
            <p className="flex items-center gap-2 font-semibold text-red-800">
              <AlertTriangle className="size-5" aria-hidden /> Horário indisponível
            </p>
            <ul className="mt-1 list-disc pl-6 text-sm text-red-800">
              {occupants.map((o, i) => (
                <li key={i}>{occupantText(o, maps, courtId)}</li>
              ))}
            </ul>
            {suggestions.length > 0 ? (
              <>
                <p className="mt-3 text-sm font-medium text-slate-700">Horários livres mais próximos:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <Chip key={s.startMin} onClick={() => setStartMin(s.startMin)}>
                      {minToHHMM(s.startMin)}–{minToHHMM(s.endMin)}
                    </Chip>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-700">Não há outro horário livre com essa duração neste dia. Tente outra data ou quadra.</p>
            )}
          </div>
        )}

        <Field label="Cliente">
          {lookups ? <CustomerPicker customers={lookups.customers} value={customer} onChange={setCustomer} error={customerError || undefined} /> : <Input disabled placeholder="Carregando…" />}
        </Field>

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
          <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${priceManual ? 'text-amber-700' : 'text-brand-strong'}`}>
            <Sparkles className="size-3.5" aria-hidden />
            {priceManual ? 'Alterado manualmente' : 'Preço automático pela tabela'}
          </p>
        </Field>

        {!editing && (
          <div className="rounded-2xl border border-slate-200 p-3">
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

        {!hours && isISODate(date) && <p className="text-sm text-amber-700">A quadra não abre neste dia da semana.</p>}
      </div>
    </Sheet>
  );
}
