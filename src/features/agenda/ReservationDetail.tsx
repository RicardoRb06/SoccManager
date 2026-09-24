/**
 * Detalhe da reserva (marco 2: ver, editar, cancelar, reativar e excluir).
 * Pagamentos, falta e WhatsApp entram no marco 3.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, Clock, MapPin, Pencil, Phone, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { db } from '../../db/database';
import { cancelReservation, ConflictError, deleteReservation, reactivateReservation } from '../../db/repo';
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
import { errorMessage } from '../../utils/text';

const METHOD_LABEL = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', outro: 'Outro' } as const;

export function ReservationDetail({ reservationId, onClose, onEdit }: { reservationId: string; onClose: () => void; onEdit: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
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
  if (!data) return <Sheet open onClose={onClose} title="Reserva"><p className="py-6 text-center text-slate-500">Carregando…</p></Sheet>;

  const { r, customer, court, payments, rec } = data;
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const balance = reservationBalance(r, paid);
  const cancelled = r.status === 'cancelada';
  const state: VisualState = r.status === 'falta' ? 'falta' : cancelled ? 'livre' : (({ pendente: 'pendente', parcial: 'sinal', pago: 'pago' }) as const)[paymentStatus(r.price, paid)];

  async function run(action: () => Promise<void>, ok: string) {
    try {
      await action();
      toast.success(ok);
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof ConflictError ? 'O horário já foi ocupado por outra reserva.' : errorMessage(err));
    }
  }

  return (
    <>
      <Sheet
        open={!confirm}
        onClose={onClose}
        title={customer?.name ?? 'Reserva'}
        footer={
          <div className="grid grid-cols-2 gap-2">
            {!cancelled && !r.deletedAt && (
              <Button variant="secondary" onClick={onEdit}>
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
            {!cancelled && !r.deletedAt && (
              <Button variant="secondary" onClick={() => setConfirm('cancel')}>
                <XCircle className="size-4" aria-hidden /> Cancelar
              </Button>
            )}
            {cancelled && !r.deletedAt && (
              <Button variant="secondary" onClick={() => run(() => reactivateReservation(r.id), 'Reserva reativada.')}>
                <RotateCcw className="size-4" aria-hidden /> Reativar
              </Button>
            )}
            {!r.deletedAt && (
              <Button variant="ghost" className="text-red-700" onClick={() => setConfirm('delete')}>
                <Trash2 className="size-4" aria-hidden /> Excluir
              </Button>
            )}
          </div>
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
              </li>
            )}
          </ul>

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

          {payments.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Pagamentos</h3>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {new Date(p.paidAt).toLocaleDateString('pt-BR')} · {METHOD_LABEL[p.method]}
                      {p.note ? ` · ${p.note}` : ''}
                    </span>
                    <span className="font-semibold tabular-nums">{formatBRL(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.notes && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{r.notes}</p>}
          {cancelled && r.cancelReason && <p className="text-sm text-slate-600">Motivo do cancelamento: {r.cancelReason}</p>}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirm === 'cancel'}
        title="Cancelar reserva?"
        confirmLabel="Cancelar reserva"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => run(() => cancelReservation(r.id, reason), 'Reserva cancelada. O horário foi liberado.')}
      >
        <p className="mb-3">O horário fica livre na agenda. A reserva continua no histórico do cliente.</p>
        <Textarea aria-label="Motivo (opcional)" placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </ConfirmSheet>

      <ConfirmSheet
        open={confirm === 'delete'}
        title="Excluir reserva?"
        confirmLabel="Mover para a Lixeira"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          run(async () => {
            await deleteReservation(r.id);
            onClose();
          }, 'Reserva enviada para a Lixeira.')
        }
      >
        <p>A reserva sai da agenda e vai para a Lixeira, de onde pode ser restaurada.</p>
      </ConfirmSheet>
    </>
  );
}
