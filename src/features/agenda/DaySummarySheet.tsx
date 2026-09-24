/** "Encerrar o dia": recebido, pendências e faltas do dia. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '../../components/ui/controls';
import { useBackupActions } from '../mais/useBackup';
import { db } from '../../db/database';
import { scheduleForDate } from '../../db/repo';
import type { ISODate } from '../../domain/types';
import { formatLongDate } from '../../domain/dates';
import { formatBRL } from '../../domain/money';
import { formatTimeRange } from '../../domain/time';
import { daySummary } from '../../domain/daySummary';
import type { ReceivableItem } from '../../domain/metrics';
import { Sheet } from '../../components/ui/Sheet';
import { METHOD_LABEL } from '../../components/PaymentSheets';
import { WhatsAppSheet } from '../../components/WhatsAppSheet';

export function DaySummarySheet({ date, onClose }: { date: ISODate; onClose: () => void }) {
  const [charge, setCharge] = useState<ReceivableItem | null>(null);
  const backup = useBackupActions();
  const data = useLiveQuery(async () => {
    const [prep, payments, rules, customers, courts] = await Promise.all([
      scheduleForDate(date),
      db.payments.toArray(),
      db.priceRules.toArray(),
      db.customers.toArray(),
      db.courts.toArray(),
    ]);
    return { prep, payments, rules, customers: new Map(customers.map((c) => [c.id, c])), courts: new Map(courts.map((c) => [c.id, c])) };
  }, [date]);

  const sum = data ? daySummary(data.prep, data.payments, data.rules, date) : undefined;
  const itemInfo = (i: ReceivableItem) => {
    if (i.kind === 'reserva') return { courtId: i.reservation.courtId, startMin: i.reservation.startMin, endMin: i.reservation.endMin };
    if (i.kind === 'ocorrencia') {
      const rec = data?.prep.data.recurrences.find((r) => r.id === i.recurrenceId);
      return { courtId: rec?.courtId ?? '', startMin: rec?.startMin ?? 0, endMin: rec?.endMin ?? 60 };
    }
    return { courtId: '', startMin: 0, endMin: 60 };
  };

  return (
    <>
      <Sheet open={!charge} onClose={onClose} title="Encerrar o dia">
        <p className="mb-3 text-sm text-slate-500 first-letter:uppercase">{formatLongDate(date)}</p>
        {!sum || !data ? (
          <p className="py-6 text-center text-slate-500">Carregando…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-green-50 p-3">
                <p className="text-xs text-green-800">Recebido hoje</p>
                <p className="text-lg font-bold tabular-nums text-green-900">{formatBRL(sum.received)}</p>
              </div>
              <div className={`rounded-2xl p-3 ${sum.pendingTotal ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <p className="text-xs text-amber-800">Pendente</p>
                <p className="text-lg font-bold tabular-nums text-amber-900">{formatBRL(sum.pendingTotal)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-600">Jogos · faltas</p>
                <p className="text-lg font-bold tabular-nums">
                  {sum.games} · <span className={sum.faltas ? 'text-red-700' : ''}>{sum.faltas}</span>
                </p>
              </div>
            </div>

            {sum.received > 0 && (
              <ul className="flex flex-wrap gap-2 text-sm text-slate-600">
                {(Object.keys(sum.byMethod) as Array<keyof typeof sum.byMethod>)
                  .filter((k) => sum.byMethod[k] > 0)
                  .map((k) => (
                    <li key={k} className="rounded-full bg-slate-100 px-3 py-1">
                      {METHOD_LABEL[k]}: <strong className="tabular-nums">{formatBRL(sum.byMethod[k])}</strong>
                    </li>
                  ))}
              </ul>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Pendências do dia</h3>
              {sum.pending.length === 0 ? (
                <p className="rounded-2xl bg-green-50 p-3 text-sm text-green-900">Tudo pago. Nenhuma pendência hoje.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {sum.pending.map((i, idx) => {
                    const info = itemInfo(i);
                    return (
                      <li key={idx} className="flex items-center gap-2 py-2 pl-3 pr-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{data.customers.get(i.customerId)?.name ?? 'Cliente'}</span>
                          <span className="block text-xs text-slate-500">
                            {formatTimeRange(info.startMin, info.endMin)} · {data.courts.get(info.courtId)?.name}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums text-amber-800">{formatBRL(i.amount)}</span>
                        <button
                          type="button"
                          aria-label={`Cobrar ${data.customers.get(i.customerId)?.name ?? ''} pelo WhatsApp`}
                          className="grid size-11 place-items-center rounded-full text-green-700 hover:bg-green-50"
                          onClick={() => setCharge(i)}
                        >
                          <MessageCircle className="size-5" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-xs text-slate-500">Para receber uma pendência, toque no horário na agenda e use “Quitar”.</p>

            <div className="rounded-2xl border border-brand/40 bg-brand-soft p-3">
              <p className="mb-2 text-sm font-semibold text-brand-strong">Fim do dia: salve um backup</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => void backup.save()}>
                  <Download className="size-4" aria-hidden /> Salvar backup agora
                </Button>
                {backup.canShare && (
                  <Button variant="secondary" onClick={() => void backup.share()}>
                    <Share2 className="size-4" aria-hidden /> Compartilhar backup
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Sheet>
      {charge && data && (
        <WhatsAppSheet
          phone={data.customers.get(charge.customerId)?.phone ?? ''}
          kinds={['cobrar']}
          context={{
            customerName: data.customers.get(charge.customerId)?.name ?? '',
            courtName: data.courts.get(itemInfo(charge).courtId)?.name ?? '',
            date,
            startMin: itemInfo(charge).startMin,
            endMin: itemInfo(charge).endMin,
            price: charge.amount,
            balance: charge.amount,
          }}
          onClose={() => setCharge(null)}
        />
      )}
    </>
  );
}
