/**
 * Detalhe de uma ocorrência (ainda virtual) de mensalista.
 * Ações que precisam de registro próprio (pagamento, falta) MATERIALIZAM a ocorrência.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, CalendarX2, Clock, HandCoins, MapPin, MoveRight, Repeat, UserX } from 'lucide-react';
import { db } from '../../db/database';
import { materializeRecurrenceDate, setFalta, skipRecurrenceDate } from '../../db/repo';
import type { ISODate, Recurrence } from '../../domain/types';
import { formatDateBR, formatLongDate, monthOf, WEEKDAY_LONG } from '../../domain/dates';
import { formatDuration, formatTimeRange, minToHHMM } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import { occurrencePrice } from '../../domain/recurrence';
import { monthStatus } from '../../domain/payments';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/controls';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { PaymentSheet } from '../../components/PaymentSheets';
import { useToast } from '../../components/ui/Toast';
import { errorMessage } from '../../utils/text';

type Sub = null | 'skip' | 'monthPay';

export function OccurrenceDetail({
  recurrenceId,
  date,
  onClose,
  onOpenReservation,
  onReschedule,
}: {
  recurrenceId: string;
  date: ISODate;
  onClose: () => void;
  /** Abre o detalhe da reserva materializada (para pagamento/quitar). */
  onOpenReservation: (reservationId: string, then?: 'pay') => void;
  /** Remarcar: abre o formulário de reserva avulsa; ao salvar, esta data é pulada. */
  onReschedule: (rec: Recurrence, date: ISODate) => void;
}) {
  const toast = useToast();
  const [sub, setSub] = useState<Sub>(null);
  const month = monthOf(date);
  const data = useLiveQuery(async () => {
    const rec = await db.recurrences.get(recurrenceId);
    if (!rec) return null;
    const [customer, court, rules, payments] = await Promise.all([
      db.customers.get(rec.customerId),
      db.courts.get(rec.courtId),
      db.priceRules.toArray(),
      db.payments.where('recurrenceId').equals(rec.id).toArray(),
    ]);
    return { rec, customer, court, rules, payments };
  }, [recurrenceId]);

  if (data === null) return null;
  if (!data)
    return (
      <Sheet open onClose={onClose} title="Mensalista">
        <p className="py-6 text-center text-slate-500">Carregando…</p>
      </Sheet>
    );

  const { rec, customer, court, rules, payments } = data;
  const mensal = rec.billingMode === 'mensal';
  const price = occurrencePrice(rec, rules, date);
  const ms = mensal ? monthStatus(rec, payments, month) : undefined;

  async function act(fn: () => Promise<void>, ok?: string) {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <Sheet
        open={sub === null}
        onClose={onClose}
        title={customer?.name ?? 'Mensalista'}
        footer={
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2">
              {mensal ? (
                <Button variant={ms?.emDia ? 'secondary' : 'primary'} className="px-3" onClick={() => setSub('monthPay')}>
                  <HandCoins className="size-4" aria-hidden /> Mensalidade
                </Button>
              ) : (
                <Button
                  className="px-3"
                  onClick={() =>
                    act(async () => {
                      const r = await materializeRecurrenceDate(rec.id, date);
                      onOpenReservation(r.id, 'pay');
                    })
                  }
                >
                  <HandCoins className="size-4" aria-hidden /> Pagamento
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="secondary"
                className="px-2"
                onClick={() =>
                  act(async () => {
                    const r = await materializeRecurrenceDate(rec.id, date);
                    await setFalta(r.id, true);
                    onClose();
                  }, 'Falta registrada.')
                }
              >
                <UserX className="size-4" aria-hidden /> Falta
              </Button>
              <Button variant="secondary" className="px-2" onClick={() => setSub('skip')}>
                <CalendarX2 className="size-4" aria-hidden /> Pular
              </Button>
              <Button variant="secondary" className="px-2" onClick={() => onReschedule(rec, date)}>
                <MoveRight className="size-4" aria-hidden /> Remarcar
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
            <Repeat className="size-3.5" aria-hidden /> Mensalista{rec.notes ? ` · ${rec.notes}` : ''}
          </span>
          <ul className="flex flex-col gap-2 text-slate-700">
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 text-slate-400" aria-hidden /> <span className="first-letter:uppercase">{formatLongDate(date)}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-slate-400" aria-hidden /> {formatTimeRange(rec.startMin, rec.endMin)} ({formatDuration(rec.endMin - rec.startMin)})
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-slate-400" aria-hidden /> {court?.name}
            </li>
          </ul>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <p>
              Toda {WEEKDAY_LONG[rec.weekday]} às {minToHHMM(rec.startMin)} · {mensal ? `mensalidade de ${formatBRL(rec.monthlyPrice ?? 0)}` : `${formatBRL(price)} por jogo`}
            </p>
            {ms && (
              <p className={`mt-1 font-semibold ${ms.emDia ? 'text-green-800' : 'text-amber-800'}`}>
                {ms.emDia ? 'Mensalidade do mês em dia' : `Mensalidade do mês: falta ${formatBRL(ms.balance)}`}
              </p>
            )}
          </div>
          <a href={`#/mensalistas?id=${rec.id}`} className="text-sm font-medium text-brand underline-offset-2 hover:underline" onClick={onClose}>
            Ver mensalista
          </a>
        </div>
      </Sheet>

      <ConfirmSheet
        open={sub === 'skip'}
        title={`Pular ${formatDateBR(date)}?`}
        confirmLabel="Pular esta data"
        onClose={() => setSub(null)}
        onConfirm={() =>
          act(async () => {
            await skipRecurrenceDate(rec.id, date);
            onClose();
          }, 'Data pulada. O horário ficou livre.')
        }
      >
        <p>O mensalista não joga neste dia e o horário fica livre para outra reserva. As outras semanas continuam iguais.</p>
      </ConfirmSheet>

      {sub === 'monthPay' && ms && (
        <PaymentSheet
          title={`Mensalidade de ${month.slice(5)}/${month.slice(0, 4)}`}
          target={{ recurrenceId: rec.id, referenceMonth: month }}
          suggested={ms.balance}
          onClose={() => setSub(null)}
        />
      )}
    </>
  );
}
