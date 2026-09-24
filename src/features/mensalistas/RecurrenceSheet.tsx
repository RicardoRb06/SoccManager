/** Detalhe e ações de um mensalista. */
import { useState } from 'react';
import { CalendarX2, HandCoins, MessageCircle, Pause, Pencil, Play, Square, Undo2, User } from 'lucide-react';
import type { Court, Customer, ISODate, ISOMonth, Recurrence } from '../../domain/types';
import { addMonths, formatDateBR, formatMonthBR, monthOf, WEEKDAY_LONG } from '../../domain/dates';
import { nextOccurrenceDates } from '../../domain/recurrence';
import { formatTimeRange } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import type { RecurrenceSummary } from '../../domain/recurrenceSummary';
import {
  ConflictError, endRecurrenceRepo, pauseRecurrenceRepo, RecurrenceConflictError, resumeRecurrenceRepo, skipRecurrenceDate, unskipRecurrenceDate,
} from '../../db/repo';
import { Sheet } from '../../components/ui/Sheet';
import { Button, Chip, Field, Input } from '../../components/ui/controls';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { PaymentSheet } from '../../components/PaymentSheets';
import { WhatsAppSheet } from '../../components/WhatsAppSheet';
import { useToast } from '../../components/ui/Toast';
import { errorMessage } from '../../utils/text';
import { TermsSheet } from './TermsSheet';

type Sub = null | 'pay' | 'whatsapp' | 'pause' | 'resume' | 'end' | 'terms' | { skip: ISODate };

export function RecurrenceSheet({
  rec,
  customer,
  court,
  summary,
  today,
  onClose,
}: {
  rec: Recurrence;
  customer?: Customer;
  court?: Court;
  summary: RecurrenceSummary;
  today: ISODate;
  onClose: () => void;
}) {
  const toast = useToast();
  const [sub, setSub] = useState<Sub>(null);
  const [endDate, setEndDate] = useState<ISODate>(today);
  const mensal = rec.billingMode === 'mensal';
  const owedMonths = summary.pending.filter((p) => p.kind === 'mensalidade').map((p) => (p.kind === 'mensalidade' ? p.month : ''));
  const currentMonth = monthOf(today);
  const payMonths = [...new Set([...owedMonths, currentMonth, addMonths(currentMonth, 1)])].sort();
  const [payMonth, setPayMonth] = useState<ISOMonth>(owedMonths[0] ?? currentMonth);
  const upcoming = nextOccurrenceDates(rec, today, 6);
  const title = rec.notes || customer?.name || 'Mensalista';

  async function act(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      setSub(null);
    } catch (err) {
      if (err instanceof RecurrenceConflictError) toast.error(`Conflito em ${err.conflicts.map((c) => formatDateBR(c.date)).join(', ')}. Libere esses horários antes.`);
      else if (err instanceof ConflictError) toast.error('Esse horário já foi ocupado por outra reserva.');
      else toast.error(errorMessage(err));
    }
  }

  const oldestPending = [...summary.pending].sort((a, b) => {
    const ka = a.kind === 'mensalidade' ? a.month : a.date;
    const kb = b.kind === 'mensalidade' ? b.month : b.date;
    return ka < kb ? -1 : 1;
  })[0];
  const statusText =
    rec.status === 'encerrado'
      ? `Encerrado${rec.endDate ? ` em ${formatDateBR(rec.endDate)}` : ''}`
      : rec.status === 'pausado'
        ? `Pausado desde ${rec.pausedAt ? formatDateBR(rec.pausedAt) : '—'}`
        : summary.debt > 0
          ? `Devendo ${formatBRL(summary.debt)}`
          : 'Em dia';

  return (
    <>
      <Sheet
        open={sub === null}
        onClose={onClose}
        title={title}
        size="lg"
        footer={
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {mensal ? (
                <Button className="px-3" onClick={() => setSub('pay')}>
                  <HandCoins className="size-4" aria-hidden /> Mensalidade
                </Button>
              ) : (
                <a
                  href={`#/agenda/${summary.nextDates[0] ?? today}`}
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-3 font-semibold text-white hover:bg-brand-strong"
                >
                  Ver na agenda
                </a>
              )}
              <Button variant="secondary" className="px-3 text-green-800" disabled={summary.debt <= 0} onClick={() => setSub('whatsapp')}>
                <MessageCircle className="size-4" aria-hidden /> Cobrar
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" className="px-2" onClick={() => setSub('terms')}>
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
              {rec.status === 'pausado' ? (
                <Button variant="secondary" className="px-2" onClick={() => setSub('resume')}>
                  <Play className="size-4" aria-hidden /> Retomar
                </Button>
              ) : (
                <Button variant="secondary" className="px-2" disabled={rec.status !== 'ativo'} onClick={() => setSub('pause')}>
                  <Pause className="size-4" aria-hidden /> Pausar
                </Button>
              )}
              <Button variant="secondary" className="px-2 text-red-700" disabled={rec.status === 'encerrado'} onClick={() => setSub('end')}>
                <Square className="size-4" aria-hidden /> Encerrar
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                rec.status !== 'ativo' ? 'bg-slate-200 text-slate-700' : summary.debt > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
              }`}
            >
              {statusText}
            </span>
            {customer && (
              <a href={`#/clientes/${customer.id}`} onClick={onClose} className="inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-2 hover:underline">
                <User className="size-4" aria-hidden /> {customer.name}
              </a>
            )}
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-slate-700">
            <p className="font-medium">
              Toda {WEEKDAY_LONG[rec.weekday]} · {formatTimeRange(rec.startMin, rec.endMin)} · {court?.name}
            </p>
            <p className="text-sm">
              {mensal ? `Mensalidade de ${formatBRL(rec.monthlyPrice ?? 0)}` : rec.pricePerGame !== undefined ? `${formatBRL(rec.pricePerGame)} por jogo` : 'Por jogo, pela tabela de preços'}
              {' · '}desde {formatDateBR(rec.startDate)}
              {rec.endDate && rec.status !== 'encerrado' ? ` até ${formatDateBR(rec.endDate)}` : ''}
            </p>
            {summary.currentMonth && (
              <p className={`mt-1 text-sm font-semibold ${summary.currentMonth.emDia ? 'text-green-800' : 'text-amber-800'}`}>
                {formatMonthBR(summary.currentMonth.month)}: {summary.currentMonth.emDia ? 'pago' : `falta ${formatBRL(summary.currentMonth.balance)}`}
              </p>
            )}
          </div>

          {summary.pending.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Em aberto</h3>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
                {summary.pending.map((p, i) => (
                  <li key={i} className="flex justify-between px-3 py-2">
                    <span>{p.kind === 'mensalidade' ? `Mensalidade de ${formatMonthBR(p.month)}` : `Jogo de ${formatDateBR(p.date)}`}</span>
                    <span className="font-semibold tabular-nums">{formatBRL(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rec.status !== 'encerrado' && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Próximas datas · toque para pular</h3>
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma data programada.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {upcoming.map((d) => (
                    <Chip key={d} onClick={() => setSub({ skip: d })}>
                      <CalendarX2 className="size-4 text-slate-400" aria-hidden /> {formatDateBR(d).slice(0, 5)}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          {summary.upcomingSkips.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Exceções (não joga)</h3>
              <ul className="flex flex-col gap-1">
                {summary.upcomingSkips.map((d) => (
                  <li key={d} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-1 text-sm">
                    <span>{formatDateBR(d)}</span>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 font-medium text-brand"
                      onClick={() => act(() => unskipRecurrenceDate(rec.id, d), `${formatDateBR(d)} voltou para a agenda.`)}
                    >
                      <Undo2 className="size-4" aria-hidden /> Desfazer
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Sheet>

      {typeof sub === 'object' && sub && (
        <ConfirmSheet
          open
          title={`Pular ${formatDateBR(sub.skip)}?`}
          confirmLabel="Pular esta data"
          onClose={() => setSub(null)}
          onConfirm={() => act(() => skipRecurrenceDate(rec.id, sub.skip), 'Data pulada. O horário ficou livre.')}
        >
          <p>O mensalista não joga nesse dia e o horário fica livre para outra reserva.</p>
        </ConfirmSheet>
      )}

      <ConfirmSheet
        open={sub === 'pause'}
        title="Pausar mensalista?"
        confirmLabel="Pausar a partir de hoje"
        onClose={() => setSub(null)}
        onConfirm={() => act(() => pauseRecurrenceRepo(rec.id, today), 'Mensalista pausado. Os horários ficam livres.')}
      >
        <p>Os próximos horários ficam livres na agenda. O histórico é mantido e você pode retomar quando quiser.</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={sub === 'resume'}
        title="Retomar mensalista?"
        confirmLabel="Retomar a partir de hoje"
        onClose={() => setSub(null)}
        onConfirm={() => act(() => resumeRecurrenceRepo(rec.id, today), 'Mensalista retomado.')}
      >
        <p>Os horários voltam para a agenda a partir de hoje. As semanas em que ficou pausado continuam vazias.</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={sub === 'end'}
        title="Encerrar mensalista?"
        confirmLabel="Encerrar"
        danger
        onClose={() => setSub(null)}
        onConfirm={() => act(() => endRecurrenceRepo(rec.id, endDate), 'Mensalista encerrado.')}
      >
        <p className="mb-3">Depois da última data, os horários ficam livres. O histórico e os pagamentos são mantidos.</p>
        <Field label="Último jogo" htmlFor="end-date">
          <Input id="end-date" type="date" value={endDate} min={rec.startDate} onChange={(e) => e.target.value && setEndDate(e.target.value)} />
        </Field>
      </ConfirmSheet>

      {sub === 'pay' && (
        <PaymentSheet
          title="Registrar mensalidade"
          target={{ recurrenceId: rec.id, referenceMonth: payMonth }}
          suggested={summary.pending.find((p) => p.kind === 'mensalidade' && p.month === payMonth)?.amount ?? rec.monthlyPrice ?? 0}
          onClose={() => setSub(null)}
          header={
            <Field label="Mês de referência">
              <div className="flex flex-wrap gap-2">
                {payMonths.map((m) => (
                  <Chip key={m} selected={m === payMonth} onClick={() => setPayMonth(m)}>
                    {m.slice(5)}/{m.slice(0, 4)}
                    {owedMonths.includes(m) ? ' · devendo' : ''}
                  </Chip>
                ))}
              </div>
            </Field>
          }
        />
      )}

      {sub === 'whatsapp' && (
        <WhatsAppSheet
          phone={customer?.phone ?? ''}
          kinds={mensal ? ['mensalidade'] : ['cobrar']}
          context={{
            customerName: customer?.name ?? '',
            courtName: court?.name ?? '',
            date: oldestPending && oldestPending.kind !== 'mensalidade' ? oldestPending.date : (summary.nextDates[0] ?? today),
            startMin: rec.startMin,
            endMin: rec.endMin,
            price: summary.debt,
            balance: summary.debt,
            month: oldestPending && oldestPending.kind === 'mensalidade' ? oldestPending.month : currentMonth,
          }}
          onClose={() => setSub(null)}
        />
      )}

      {sub === 'terms' && <TermsSheet rec={rec} onClose={() => setSub(null)} />}
    </>
  );
}
