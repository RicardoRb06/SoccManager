/**
 * Detalhe da reserva: dados, pagamento (registrar/quitar/remover), falta,
 * editar, cancelar, reativar e excluir.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays, CheckCheck, Clock, HandCoins, MapPin, Pencil, Phone, RotateCcw, Trash2, UserCheck, UserX, XCircle,
} from 'lucide-react';
import { db } from '../../db/database';
import { cancelReservation, ConflictError, deletePayment, deleteReservation, reactivateReservation, setFalta } from '../../db/repo';
import type { Payment } from '../../domain/types';
import { formatLongDate } from '../../domain/dates';
import { formatDuration, formatTimeRange } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import { paymentStatus, reservationBalance } from '../../domain/payments';
import { formatPhone } from '../../domain/phone';
import { Sheet } from '../../components/ui/Sheet';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Button, Textarea } from '../../components/ui/controls';
import { StateBadge, type VisualState } from '../../components/StateBadge';
import { useToast } from '../../components/ui/Toast';
import { METHOD_LABEL, PayBalanceSheet, PaymentSheet } from '../../components/PaymentSheets';
import { errorMessage } from '../../utils/text';

type Sub = 'cancel' | 'delete' | 'pay' | 'quitar' | { removePayment: Payment } | null;

export function ReservationDetail({
  reservationId,
  onClose,
  onEdit,
  initial,
}: {
  reservationId: string;
  onClose: () => void;
  onEdit: () => void;
  /** Abre direto o registro de pagamento */
  initial?: 'pay';
}) {
  const toast = useToast();
  const [sub, setSub] = useState<Sub>(initial ?? null);
  const [reason, setReason] = useState('');

  const data = useLiveQuery(async () => {
    const r = await db.reservations.get(reservationId);
    if (!r) return null;
    const [customer, court, payments, rec] = await Promise.all([
      db.customers.get(r.customerId),
      db.courts.get(r.courtId),
      db.payments.where('reservationId').equals(r.id).sortBy('paidAt'),
      r.recurrenceId ? db.recurrences.get(r.recurrenceId) : Promise.resolve(undefined),
    ]);
    return { r, customer, court, payments, rec };
  }, [reservationId]);

  if (data === null) return null;
  if (!data)
    return (
      <Sheet open onClose={onClose} title="Reserva">
        <p className="py-6 text-center text-muted-foreground">Carregando…</p>
      </Sheet>
    );

  const { r, customer, court, payments, rec } = data;
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const balance = reservationBalance(r, paid);
  const cancelled = r.status === 'cancelada';
  const live = !cancelled && !r.deletedAt;
  const monthly = rec?.billingMode === 'mensal' && r.price === 0;
  const state: VisualState =
    r.status === 'falta' ? 'falta' : cancelled ? 'livre' : monthly ? 'mensal_ok' : (({ pendente: 'pendente', parcial: 'sinal', pago: 'pago' }) as const)[paymentStatus(r.price, paid)];

  async function run(action: () => Promise<void>, ok: string) {
    try {
      await action();
      toast.success(ok);
      setSub(null);
    } catch (err) {
      toast.error(err instanceof ConflictError ? 'O horário já foi ocupado por outra reserva.' : errorMessage(err));
    }
  }

  const mainOpen = sub === null;

  return (
    <>
      <Sheet
        open={mainOpen}
        onClose={onClose}
        title={customer?.name ?? 'Reserva'}
        footer={
          live ? (
            <div className="flex flex-col gap-2">
              {balance > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="whitespace-nowrap px-3" onClick={() => setSub('pay')}>
                    <HandCoins className="size-4" aria-hidden /> Pagamento
                  </Button>
                  <Button className="whitespace-nowrap px-3" onClick={() => setSub('quitar')}>
                    <CheckCheck className="size-4" aria-hidden /> Quitar {formatBRL(balance)}
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="px-2" onClick={onEdit}>
                  <Pencil className="size-4" aria-hidden /> Editar
                </Button>
                {r.status === 'falta' ? (
                  <Button variant="outline" className="px-2" onClick={() => run(() => setFalta(r.id, false), 'Falta removida.')}>
                    <UserCheck className="size-4" aria-hidden /> Tirar falta
                  </Button>
                ) : (
                  <Button variant="outline" className="px-2" onClick={() => run(() => setFalta(r.id, true), 'Falta registrada. O horário continua ocupado.')}>
                    <UserX className="size-4" aria-hidden /> Falta
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setSub('cancel')}>
                  <XCircle className="size-4" aria-hidden /> Cancelar
                </Button>
                <Button variant="ghost" className="text-danger" onClick={() => setSub('delete')}>
                  <Trash2 className="size-4" aria-hidden /> Excluir
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {cancelled && !r.deletedAt && (
                <Button variant="outline" onClick={() => run(() => reactivateReservation(r.id), 'Reserva reativada.')}>
                  <RotateCcw className="size-4" aria-hidden /> Reativar
                </Button>
              )}
              {!r.deletedAt && (
                <Button variant="ghost" className="text-danger" onClick={() => setSub('delete')}>
                  <Trash2 className="size-4" aria-hidden /> Excluir
                </Button>
              )}
            </div>
          )
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {cancelled ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground/85">Cancelada</span>
            ) : (
              <StateBadge state={state} />
            )}
            {rec && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">Mensalista{rec.notes ? ` · ${rec.notes}` : ''}</span>}
          </div>

          <ul className="flex flex-col gap-2 text-foreground/85">
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground/70" aria-hidden /> <span className="first-letter:uppercase">{formatLongDate(r.date)}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground/70" aria-hidden /> {formatTimeRange(r.startMin, r.endMin)} ({formatDuration(r.endMin - r.startMin)})
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground/70" aria-hidden /> {court?.name ?? 'Quadra removida'}
            </li>
            {customer?.phone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground/70" aria-hidden />
                <a className="text-brand underline-offset-2 hover:underline" href={`tel:${customer.phone.replace(/\D/g, '')}`}>
                  {formatPhone(customer.phone)}
                </a>
                <a className="ml-auto text-sm font-medium text-muted-foreground underline-offset-2 hover:underline" href={`#/clientes/${customer.id}`} onClick={onClose}>
                  Ver cliente
                </a>
              </li>
            )}
          </ul>

          {monthly ? (
            <p className="rounded-2xl bg-muted/60 p-3 text-sm text-foreground/85">Jogo coberto pela mensalidade do mensalista.</p>
          ) : (
            <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-3 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Valor</dt>
                <dd className="font-semibold tabular-nums">{formatBRL(r.price)}</dd>
                <dd className="text-[11px] text-muted-foreground">{r.priceManual ? 'manual' : 'automático'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Pago</dt>
                <dd className="font-semibold tabular-nums text-success">{formatBRL(paid)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Saldo</dt>
                <dd className={`font-semibold tabular-nums ${balance > 0 ? 'text-warning' : 'text-foreground/85'}`}>{formatBRL(balance)}</dd>
              </div>
            </dl>
          )}

          {payments.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-foreground/85">Pagamentos</h3>
              <ul className="divide-y divide-border rounded-2xl border border-border">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-1 pl-3 pr-1 text-sm">
                    <span className="flex-1">
                      {new Date(p.paidAt).toLocaleDateString('pt-BR')} · {METHOD_LABEL[p.method]}
                      {p.note ? ` · ${p.note}` : ''}
                    </span>
                    <span className="font-semibold tabular-nums">{formatBRL(p.amount)}</span>
                    <button
                      type="button"
                      aria-label={`Remover pagamento de ${formatBRL(p.amount)}`}
                      className="grid size-10 place-items-center rounded-full text-muted-foreground/70 hover:bg-danger-soft hover:text-danger"
                      onClick={() => setSub({ removePayment: p })}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.notes && <p className="rounded-2xl bg-warning-soft p-3 text-sm text-warning-fg">{r.notes}</p>}
          {cancelled && r.cancelReason && <p className="text-sm text-muted-foreground">Motivo do cancelamento: {r.cancelReason}</p>}
        </div>
      </Sheet>

      {sub === 'pay' && <PaymentSheet target={{ reservationId: r.id }} suggested={balance} onClose={() => setSub(null)} />}
      {sub === 'quitar' && <PayBalanceSheet reservationId={r.id} balance={balance} onClose={() => setSub(null)} />}

      <ConfirmSheet
        open={sub === 'cancel'}
        title="Cancelar reserva?"
        confirmLabel="Cancelar reserva"
        danger
        onClose={() => setSub(null)}
        onConfirm={() => run(() => cancelReservation(r.id, reason), 'Reserva cancelada. O horário foi liberado.')}
      >
        <p className="mb-3">O horário fica livre na agenda. A reserva continua no histórico do cliente.</p>
        <Textarea aria-label="Motivo (opcional)" placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </ConfirmSheet>

      <ConfirmSheet
        open={sub === 'delete'}
        title="Excluir reserva?"
        confirmLabel="Mover para a Lixeira"
        danger
        onClose={() => setSub(null)}
        onConfirm={() =>
          run(async () => {
            await deleteReservation(r.id);
            onClose();
          }, 'Reserva enviada para a Lixeira.')
        }
      >
        <p>A reserva sai da agenda e vai para a Lixeira, de onde pode ser restaurada.</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={typeof sub === 'object' && sub !== null}
        title="Remover pagamento?"
        confirmLabel="Remover"
        danger
        onClose={() => setSub(null)}
        onConfirm={() => {
          if (typeof sub === 'object' && sub) return run(() => deletePayment(sub.removePayment.id), 'Pagamento removido.');
        }}
      >
        {typeof sub === 'object' && sub && (
          <p>
            O pagamento de {formatBRL(sub.removePayment.amount)} ({METHOD_LABEL[sub.removePayment.method]}) será apagado. Use só para corrigir um lançamento errado.
          </p>
        )}
      </ConfirmSheet>
    </>
  );
}
