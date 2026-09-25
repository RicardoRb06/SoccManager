/** Detalhe do cliente: contato, totais, débito, mensalista, histórico de reservas. */
import { useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Phone, Repeat, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/AppShell';
import { Button } from '../../components/ui/controls';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { StateBadge, type VisualState } from '../../components/StateBadge';
import { useToast } from '../../components/ui/Toast';
import { deleteCustomer, restoreCustomer } from '../../db/repo';
import { db } from '../../db/database';
import type { Reservation } from '../../domain/types';
import { formatDateBR, WEEKDAY_LONG, nowMinutes } from '../../domain/dates';
import { formatTimeRange, minToHHMM } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import { formatPhone } from '../../domain/phone';
import { paidByReservation, paymentStatus } from '../../domain/payments';
import { receivables } from '../../domain/metrics';
import { navigate } from '../../utils/router';
import { useCustomerSummaries } from './useCustomerSummaries';
import { CustomerSheet } from './CustomerSheet';
import { ReservationDetail } from '../agenda/ReservationDetail';
import { ReservationSheet } from '../agenda/ReservationSheet';

type Overlay = { type: 'edit' } | { type: 'delete' } | { type: 'res'; id: string } | { type: 'resEdit'; r: Reservation } | null;

export default function ClienteDetailPage({ id }: { id: string }) {
  const data = useCustomerSummaries();
  const toast = useToast();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [showAll, setShowAll] = useState(false);

  const view = useMemo(() => {
    if (!data) return undefined;
    const s = data.list.find((x) => x.customer.id === id);
    if (!s) return null;
    const { all, prep, today } = data;
    const history = all.reservations.filter((r) => r.customerId === id && !r.deletedAt).sort((a, b) => (a.date === b.date ? b.startMin - a.startMin : a.date < b.date ? 1 : -1));
    const paid = paidByReservation(all.payments);
    const recs = all.recurrences.filter((r) => r.customerId === id && r.status !== 'encerrado');
    const courts = new Map(all.courts.map((c) => [c.id, c]));
    const earliest = history.length ? history[history.length - 1]!.date : today;
    const pending = receivables(prep, all.payments, all.priceRules, { from: earliest < today ? earliest : today, to: today }, today, nowMinutes()).filter((i) => i.customerId === id);
    const future = history.filter((r) => r.date >= today && r.status !== 'cancelada').length;
    return { s, history, paid, recs, courts, pending, future, today };
  }, [data, id]);

  if (view === undefined) return <PageHeader title="Cliente" subtitle="Carregando…" />;
  if (view === null)
    return (
      <>
        <PageHeader title="Cliente não encontrado" />
        <p className="p-6 text-center text-muted-foreground">
          <a href="#/clientes" className="text-brand underline">
            Voltar para Clientes
          </a>
        </p>
      </>
    );

  const { s, history, paid, recs, courts, pending, future } = view;
  const c = s.customer;
  const visible = showAll ? history : history.slice(0, 20);

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={c.deletedAt ? 'Na Lixeira' : s.isMensalista ? 'Mensalista' : 'Cliente'}
        actions={
          <a href="#/clientes" className="grid size-11 place-items-center rounded-full hover:bg-accent" aria-label="Voltar para Clientes">
            <ChevronLeft className="size-5" aria-hidden />
          </a>
        }
      />
      <div className="flex flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          {c.deletedAt && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted p-3 text-sm">
              <span>Este cliente está na Lixeira.</span>
              <Button variant="outline" onClick={() => restoreCustomer(c.id).then(() => toast.success('Cliente restaurado.'))}>
                Restaurar
              </Button>
            </div>
          )}
          <section className="rounded-xl border bg-card shadow-xs p-4">
            {c.phone ? (
              <p className="flex items-center gap-2 text-foreground/85">
                <Phone className="size-4 text-muted-foreground/70" aria-hidden />
                <a href={`tel:${c.phone.replace(/\D/g, '')}`} className="text-brand underline-offset-2 hover:underline">
                  {formatPhone(c.phone)}
                </a>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem telefone cadastrado.</p>
            )}
            {c.notes && <p className="mt-3 rounded-xl bg-warning-soft p-3 text-sm text-warning-fg">{c.notes}</p>}
            <Button variant="outline" className="mt-4 w-full" onClick={() => setOverlay({ type: 'edit' })}>
              <Pencil className="size-4" aria-hidden /> Editar
            </Button>
          </section>

          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border bg-card shadow-xs p-3">
              <dt className="text-xs text-muted-foreground">Jogos</dt>
              <dd className="text-xl font-bold tabular-nums">{s.stats.games}</dd>
            </div>
            <div className="rounded-xl border bg-card shadow-xs p-3">
              <dt className="text-xs text-muted-foreground">Total pago</dt>
              <dd className="text-xl font-bold tabular-nums">{formatBRL(s.stats.totalPaid)}</dd>
            </div>
            <div className="rounded-xl border bg-card shadow-xs p-3">
              <dt className="text-xs text-muted-foreground">Faltas</dt>
              <dd className={`text-xl font-bold tabular-nums ${s.stats.faltas ? 'text-danger' : ''}`}>{s.stats.faltas}</dd>
            </div>
            <div className={`rounded-2xl border p-3 ${s.debt > 0 ? 'border-warning-border bg-warning-soft' : 'border-border bg-card'}`}>
              <dt className="text-xs text-muted-foreground">Débito</dt>
              <dd className={`text-xl font-bold tabular-nums ${s.debt > 0 ? 'text-warning-fg' : ''}`}>{formatBRL(s.debt)}</dd>
            </div>
          </dl>

          {s.debt > 0 && (
            <section className="rounded-2xl border border-warning-border bg-warning-soft p-4">
              <h2 className="mb-2 font-semibold text-warning-fg">Em aberto</h2>
              <ul className="flex flex-col gap-1 text-sm text-warning-fg">
                {pending.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{p.kind === 'mensalidade' ? `Mensalidade ${p.month.slice(5)}/${p.month.slice(0, 4)}` : `Jogo de ${formatDateBR(p.date)}`}</span>
                    <span className="font-semibold tabular-nums">{formatBRL(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recs.length > 0 && (
            <section className="rounded-xl border bg-card shadow-xs p-4">
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <Repeat className="size-4 text-brand" aria-hidden /> Mensalista
              </h2>
              <ul className="flex flex-col gap-1 text-sm text-foreground/85">
                {recs.map((r) => (
                  <li key={r.id}>
                    {r.notes ? <strong>{r.notes}: </strong> : null}
                    toda {WEEKDAY_LONG[r.weekday]} às {minToHHMM(r.startMin)} · {courts.get(r.courtId)?.name}
                    {r.status === 'pausado' ? ' (pausado)' : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!c.deletedAt && (
            <Button variant="ghost" className="self-start text-danger" onClick={() => setOverlay({ type: 'delete' })}>
              <Trash2 className="size-4" aria-hidden /> Excluir cliente
            </Button>
          )}
        </div>

        <section>
          <h2 className="mb-2 font-semibold text-foreground/85">Histórico de reservas</h2>
          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">Nenhuma reserva ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((r) => {
                const p = paid.get(r.id) ?? 0;
                const state: VisualState | null =
                  r.status === 'cancelada' ? null : r.status === 'falta' ? 'falta' : (({ pendente: 'pendente', parcial: 'sinal', pago: 'pago' }) as const)[paymentStatus(r.price, p)];
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOverlay({ type: 'res', id: r.id })}
                      className={`flex w-full items-center gap-3 rounded-xl border bg-card shadow-xs px-3 py-2 text-left hover:bg-accent ${r.status === 'cancelada' ? 'opacity-60' : ''}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {formatDateBR(r.date)} · {formatTimeRange(r.startMin, r.endMin)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {courts.get(r.courtId)?.name}
                          {r.recurrenceId ? ' · mensalista' : ''}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <span className="text-sm tabular-nums text-foreground/85">{formatBRL(r.price)}</span>
                        {state ? <StateBadge state={state} /> : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground/85">Cancelada</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!showAll && history.length > 20 && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setShowAll(true)}>
              Ver todas ({history.length})
            </Button>
          )}
        </section>
      </div>

      {overlay?.type === 'edit' && <CustomerSheet customer={c} onClose={() => setOverlay(null)} />}
      {overlay?.type === 'res' && (
        <ReservationDetail
          reservationId={overlay.id}
          onClose={() => setOverlay(null)}
          onEdit={async () => {
            const r = await db.reservations.get(overlay.id);
            if (r) setOverlay({ type: 'resEdit', r });
          }}
        />
      )}
      {overlay?.type === 'resEdit' && <ReservationSheet init={{ mode: 'edit', reservation: overlay.r }} onClose={() => setOverlay(null)} />}
      <ConfirmSheet
        open={overlay?.type === 'delete'}
        title="Excluir cliente?"
        confirmLabel="Mover para a Lixeira"
        danger
        onClose={() => setOverlay(null)}
        onConfirm={async () => {
          await deleteCustomer(c.id);
          toast.success('Cliente enviado para a Lixeira.');
          setOverlay(null);
          navigate('/clientes');
        }}
      >
        <p>O cliente sai da lista e vai para a Lixeira. O histórico e as reservas continuam salvos.</p>
        {future > 0 && <p className="mt-2 font-medium text-warning-fg">Atenção: ele tem {future} reserva(s) futura(s), que continuam na agenda.</p>}
      </ConfirmSheet>
    </>
  );
}
