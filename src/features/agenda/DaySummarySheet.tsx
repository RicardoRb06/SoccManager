/** "Encerrar o dia": recebido, pendências e faltas do dia. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Share2 } from 'lucide-react';
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

export function DaySummarySheet({ date, onClose }: { date: ISODate; onClose: () => void }) {
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
      <Sheet open onClose={onClose} title="Encerrar o dia">
        <p className="mb-3 text-sm text-muted-foreground first-letter:uppercase">{formatLongDate(date)}</p>
        {!sum || !data ? (
          <p className="py-6 text-center text-muted-foreground">Carregando…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-success-soft p-3">
                <p className="text-xs text-success-fg">Recebido hoje</p>
                <p className="text-lg font-bold tabular-nums text-success-fg">{formatBRL(sum.received)}</p>
              </div>
              <div className={`rounded-2xl p-3 ${sum.pendingTotal ? 'bg-warning-soft' : 'bg-muted/60'}`}>
                <p className="text-xs text-warning-fg">Pendente</p>
                <p className="text-lg font-bold tabular-nums text-warning-fg">{formatBRL(sum.pendingTotal)}</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Jogos · faltas</p>
                <p className="text-lg font-bold tabular-nums">
                  {sum.games} · <span className={sum.faltas ? 'text-danger' : ''}>{sum.faltas}</span>
                </p>
              </div>
            </div>

            {sum.received > 0 && (
              <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {(Object.keys(sum.byMethod) as Array<keyof typeof sum.byMethod>)
                  .filter((k) => sum.byMethod[k] > 0)
                  .map((k) => (
                    <li key={k} className="rounded-full bg-muted px-3 py-1">
                      {METHOD_LABEL[k]}: <strong className="tabular-nums">{formatBRL(sum.byMethod[k])}</strong>
                    </li>
                  ))}
              </ul>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground/85">Pendências do dia</h3>
              {sum.pending.length === 0 ? (
                <p className="rounded-2xl bg-success-soft p-3 text-sm text-success-fg">Tudo pago. Nenhuma pendência hoje.</p>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border border-border">
                  {sum.pending.map((i, idx) => {
                    const info = itemInfo(i);
                    return (
                      <li key={idx} className="flex items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{data.customers.get(i.customerId)?.name ?? 'Cliente'}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatTimeRange(info.startMin, info.endMin)} · {data.courts.get(info.courtId)?.name}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums text-warning-fg">{formatBRL(i.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Para receber uma pendência, toque no horário na agenda e use “Quitar”.</p>

            <div className="rounded-2xl border border-brand/40 bg-brand-soft p-3">
              <p className="mb-2 text-sm font-semibold text-brand-strong">Fim do dia: salve um backup</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => void backup.save()}>
                  <Download className="size-4" aria-hidden /> Salvar backup agora
                </Button>
                {backup.canShare && (
                  <Button variant="outline" onClick={() => void backup.share()}>
                    <Share2 className="size-4" aria-hidden /> Compartilhar backup
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
