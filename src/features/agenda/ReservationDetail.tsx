/**
 * Detalhe da reserva: dados, pagamento (registrar/quitar/remover), falta, WhatsApp,
 * editar, cancelar, reativar e excluir.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays, CheckCheck, Clock, HandCoins, MapPin, MessageCircle, Pencil, Phone, RotateCcw, Trash2, UserCheck, UserX, XCircle,
} from 'lucide-react';
import { db } from '../../db/database';
import { cancelReservation, ConflictError, deletePayment, deleteReservation, reactivateReservation, setFalta } from '../../db/repo';
import type { Payment } from '../../domain/types';
import { formatLongDate } from '../../domain/dates';
import { formatDuration, formatTimeRange } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import { paymentStatus, reservationBalance } from '../../domain/payments';
import { formatPhone } from '../../domain/whatsapp';
import { Sheet } from '../../components/ui/Sheet';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Button, Textarea } from '../../components/ui/controls';
import { StateBadge, type VisualState } from '../../components/StateBadge';
import { useToast } from '../../components/ui/Toast';
import { METHOD_LABEL, PayBalanceSheet, PaymentSheet } from '../../components/PaymentSheets';
import { WhatsAppSheet } from '../../components/WhatsAppSheet';
import { errorMessage } from '../../utils/text';

type Sub = 'cancel' | 'delete' | 'pay' | 'quitar' | 'whatsapp' | { removePayment: Payment } | null;

export function ReservationDetail({ reservationId, onClose, onEdit }: { reservationId: string; onClose: () => void; onEdit: () => void }) {
  const toast = useToast();
  const [sub, setSub] = useState<Sub>(null);
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
        <p className="py-6 text-center text-slate-500">Carregando…</p>
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
                  <Button variant="secondary" className="whitespace-nowrap px-3" onClick={() => setSub('pay')}>
                    <HandCoins className="size-4" aria-hidden /> Pagamento
                  </Button>
                  <Button className="whitespace-nowrap px-3" onClick={() => setSub('quitar')}>
                    <CheckCheck className="size-4" aria-hidden /> Quitar {formatBRL(balance)}
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" className="px-2 text-green-800" onClick={() => setSub('whatsapp')}>
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </Button>
                <Button variant="secondary" className="px-2" onClick={onEdit}>
                  <Pencil className="size-4" aria-hidden /> Editar
                </Button>
                {r.status === 'falta' ? (
                  <Button variant="secondary" className="px-2" onClick={() => run(() => setFalta(r.id, false), 'Falta removida.')}>
                    <UserCheck className="size-4" aria-hidden /> Tirar falta
                  </Button>
                ) : (
                  <Button variant="secondary" className="px-2" onClick={() => run(() => setFalta(r.id, true), 'Falta registrada. O horário continua ocupado.')}>
                    <UserX className="size-4" aria-hidden /> Falta
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setSub('cancel')}>
                  <XCircle className="size-4" aria-hidden /> Cancelar
                </Button>
                <Button variant="ghost" className="text-red-700" onClick={() => setSub('delete')}>
                  <Trash2 className="size-4" aria-hidden /> Excluir
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {cancelled && !r.deletedAt && (
                <Button variant="secondary" onClick={() => run(() => reactivateReservation(r.id), 'Reserva reativada.')}>
                  <RotateCcw className="size-4" aria-hidden /> Reativar
                </Button>
              )}
              {!r.deletedAt && (
                <Button variant="ghost" className="text-red-700" onClick={() => setSub('delete')}>
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
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Cancelada</span>
            ) : (
              <StateBadge state={state} />
            )}
            {rec && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">Mensalista{rec.notes ? ` · ${rec.notes}` : ''}</span>}
          </div>

          <ul className="flex flex-col gap-2 text-slate-700">
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 text-slate-400" aria-hidden /> <span className="first-letter:uppercase">{formatLongDate(r.date)}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-slate-400" aria-hidden /> {formatTimeRange(r.startMin, r.endMin)} ({formatDuration(r.endMin - r.startMin)})
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-slate-400" aria-hidden /> {court?.name ?? 'Quadra removida'}
            </li>
            {customer?.phone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-slate-400" aria-hidden />
                <a className="text-brand underline-offset-2 hover:underline" href={`tel:${customer.phone.replace(/\D/g, '')}`}>
                  {formatPhone(customer.phone)}
                </a>
                <a className="ml-auto text-sm font-medium text-slate-600 underline-offset-2 hover:underline" href={`#/clientes/${customer.id}`} onClick={onClose}>
                  Ver cliente
                </a>
              </li>
            )}
          </ul>

          {monthly ? (
            <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">Jogo coberto pela mensalidade do mensalista.</p>
          ) : (
            <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
              <div>
                <dt className="text-xs text-slate-500">Valor</dt>
                <dd className="font-bold tabular-nums">{formatBRL(r.price)}</dd>
                <dd className="text-[11px] text-slate-500">{r.priceManual ? 'manual' : 'automático'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Pago</dt>
                <dd className="font-bold tabular-nums text-green-700">{formatBRL(paid)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Saldo</dt>
                <dd className={`font-bold tabular-nums ${balance > 0 ? 'text-amber-700' : 'text-slate-700'}`}>{formatBRL(balance)}</dd>
              </div>
            </dl>
          )}

          {payments.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Pagamentos</h3>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
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
                      className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() => setSub({ removePayment: p })}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.notes && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{r.notes}</p>}
          {cancelled && r.cancelReason && <p className="text-sm text-slate-600">Motivo do cancelamento: {r.cancelReason}</p>}
        </div>
      </Sheet>

      {sub === 'pay' && <PaymentSheet target={{ reservationId: r.id }} suggested={balance} onClose={() => setSub(null)} />}
      {sub === 'quitar' && <PayBalanceSheet reservationId={r.id} balance={balance} onClose={() => setSub(null)} />}
      {sub === 'whatsapp' && (
        <WhatsAppSheet
          phone={customer?.phone ?? ''}
          context={{ customerName: customer?.name ?? '', courtName: court?.name ?? '', date: r.date, startMin: r.startMin, endMin: r.endMin, price: r.price, balance }}
          kinds={balance > 0 ? ['confirmar', 'lembrar', 'cobrar'] : ['confirmar', 'lembrar']}
          onClose={() => setSub(null)}
        />
      )}

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
