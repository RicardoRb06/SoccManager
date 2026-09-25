/** Mensalistas: receita fixa prevista, filtros, cards com situação do mês e próximas datas. */
import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Repeat, TrendingUp } from 'lucide-react';
import { PageHeader } from '../../components/AppShell';
import { Chip } from '../../components/ui/controls';
import { useAllData, useSettings } from '../../db/hooks';
import type { Recurrence } from '../../domain/types';
import { formatDateBR, formatMonthBR, monthOf, nowMinutes, todayISO, WEEKDAY_SHORT } from '../../domain/dates';
import { formatTimeRange, minToHHMM } from '../../domain/time';
import { formatBRL } from '../../domain/money';
import { prepareSchedule } from '../../domain/schedule';
import { occurrencePrice } from '../../domain/recurrence';
import { expectedMonthlyRevenue } from '../../domain/payments';
import { recurrenceSummary, type RecurrenceSummary } from '../../domain/recurrenceSummary';
import { navigate, useHashQuery } from '../../utils/router';
import { ReservationSheet } from '../agenda/ReservationSheet';
import { RecurrenceSheet } from './RecurrenceSheet';

type Filter = 'todos' | 'devendo' | 'pausados';

interface Row {
  rec: Recurrence;
  summary: RecurrenceSummary;
  /** Preço de um jogo (por jogo: fixo ou tabela na próxima data) */
  gamePrice: number;
}

export default function MensalistasPage() {
  const all = useAllData();
  const settings = useSettings();
  const query = useHashQuery();
  const openId = query.get('id');
  const [filter, setFilter] = useState<Filter>('todos');
  const [showEnded, setShowEnded] = useState(false);
  const [creating, setCreating] = useState(false);
  const today = todayISO();

  const view = useMemo(() => {
    if (!all) return undefined;
    const prep = prepareSchedule({ ...all, openingHours: settings.openingHours });
    const nowMin = nowMinutes();
    const rows: Row[] = all.recurrences.map((rec) => {
      const summary = recurrenceSummary(rec, prep, all.payments, all.priceRules, today, nowMin);
      return { rec, summary, gamePrice: occurrencePrice(rec, all.priceRules, summary.nextDates[0] ?? today) };
    });
    const revenue = expectedMonthlyRevenue(all.recurrences, monthOf(today), (rec, d) => occurrencePrice(rec, all.priceRules, d));
    return {
      rows,
      revenue,
      customers: new Map(all.customers.map((c) => [c.id, c])),
      courts: new Map(all.courts.map((c) => [c.id, c])),
      firstCourt: all.courts.find((c) => c.active)?.id,
    };
  }, [all, settings.openingHours, today]);

  const sortKey = (r: Recurrence) => `${(r.weekday + 7 - settings.weekStartsOn) % 7}-${String(r.startMin).padStart(4, '0')}`;
  const live = (view?.rows ?? []).filter((r) => r.rec.status !== 'encerrado');
  const ended = (view?.rows ?? []).filter((r) => r.rec.status === 'encerrado');
  const list = live
    .filter((r) => (filter === 'devendo' ? r.summary.debt > 0 : filter === 'pausados' ? r.rec.status === 'pausado' : true))
    .sort((a, b) => (sortKey(a.rec) < sortKey(b.rec) ? -1 : 1));
  const activeCount = live.filter((r) => r.rec.status === 'ativo').length;
  const debtTotal = live.reduce((a, r) => a + r.summary.debt, 0);
  const opened = view?.rows.find((r) => r.rec.id === openId);

  function card({ rec, summary, gamePrice }: Row) {
    const customer = view?.customers.get(rec.customerId);
    const title = rec.notes || customer?.name || 'Mensalista';
    const status =
      rec.status === 'pausado'
        ? { text: 'Pausado', cls: 'bg-muted text-foreground/85' }
        : rec.status === 'encerrado'
          ? { text: 'Encerrado', cls: 'bg-muted text-foreground/85' }
          : summary.debt > 0
            ? { text: `Devendo ${formatBRL(summary.debt)}`, cls: 'bg-warning-muted text-warning-fg' }
            : { text: 'Em dia', cls: 'bg-success-muted text-success-fg' };
    return (
      <li key={rec.id}>
        <a
          href={`#/mensalistas?id=${rec.id}`}
          className={`block rounded-2xl border bg-card p-3 hover:bg-accent ${summary.debt > 0 && rec.status === 'ativo' ? 'border-warning-border' : 'border-border'} ${rec.status !== 'ativo' ? 'opacity-75' : ''}`}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-center text-brand-strong">
              <span className="text-[11px] font-bold uppercase leading-none">
                {WEEKDAY_SHORT[rec.weekday]}
                <span className="mt-0.5 block text-sm">{minToHHMM(rec.startMin)}</span>
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-semibold">{title}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.text}</span>
              </div>
              {rec.notes && customer && <p className="truncate text-xs text-muted-foreground">{customer.name}</p>}
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatTimeRange(rec.startMin, rec.endMin)} · {view?.courts.get(rec.courtId)?.name}
              </p>
              <p className="text-sm font-medium text-foreground/85">
                {rec.billingMode === 'mensal' ? `${formatBRL(rec.monthlyPrice ?? 0)}/mês` : `${formatBRL(gamePrice)} por jogo`}
              </p>
              {rec.status === 'ativo' && summary.nextDates.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Próximos: {summary.nextDates.map((d) => formatDateBR(d).slice(0, 5)).join(', ')}</p>
              )}
              {summary.upcomingSkips.length > 0 && rec.status !== 'encerrado' && (
                <p className="text-xs text-muted-foreground">Não joga: {summary.upcomingSkips.slice(0, 3).map((d) => formatDateBR(d).slice(0, 5)).join(', ')}</p>
              )}
            </div>
          </div>
        </a>
      </li>
    );
  }

  return (
    <>
      <PageHeader title="Mensalistas" subtitle={view ? `${activeCount} ativos` : 'Carregando…'} />
      <div className="flex flex-col gap-4 p-4">
        {view && (
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <div className="col-span-2 rounded-2xl bg-primary p-4 text-white lg:col-span-1">
              <p className="flex items-center gap-2 text-sm text-white/85">
                <TrendingUp className="size-4" aria-hidden /> Receita fixa prevista
              </p>
              <p className="text-2xl font-bold tabular-nums">{formatBRL(view.revenue)}/mês</p>
              <p className="text-xs text-white/75">Mensalistas ativos em {formatMonthBR(monthOf(today))}</p>
            </div>
            <div className="rounded-xl border bg-card shadow-xs p-4">
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold tabular-nums">{activeCount}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${debtTotal > 0 ? 'border-warning-border bg-warning-soft' : 'border-border bg-card'}`}>
              <p className="text-sm text-muted-foreground">Em aberto</p>
              <p className={`text-2xl font-bold tabular-nums ${debtTotal > 0 ? 'text-warning-fg' : ''}`}>{formatBRL(debtTotal)}</p>
            </div>
          </section>
        )}

        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtro">
          {(
            [
              ['todos', 'Todos'],
              ['devendo', 'Devendo'],
              ['pausados', 'Pausados'],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} selected={filter === k} onClick={() => setFilter(k)} className="shrink-0">
              {label}
            </Chip>
          ))}
        </div>

        {!view ? (
          <p className="py-10 text-center text-muted-foreground">Carregando…</p>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">
            <Repeat className="mx-auto mb-2 size-8 text-muted-foreground/50" aria-hidden />
            {filter === 'todos' ? 'Nenhum mensalista ainda. Crie o primeiro pelo botão abaixo.' : 'Nenhum mensalista neste filtro.'}
          </div>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">{list.map(card)}</ul>
        )}

        {ended.length > 0 && (
          <div>
            <button type="button" className="flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground" onClick={() => setShowEnded((v) => !v)} aria-expanded={showEnded}>
              <ChevronDown className={`size-4 transition-transform ${showEnded ? 'rotate-180' : ''}`} aria-hidden /> Encerrados ({ended.length})
            </button>
            {showEnded && <ul className="mt-2 grid gap-2 lg:grid-cols-2">{ended.map(card)}</ul>}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Dica: também dá para criar um mensalista pela agenda, ligando “Repetir toda semana” ao marcar um horário.</p>
      </div>

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="fab-bottom no-print fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-white shadow-lg hover:bg-primary/90 lg:right-8"
      >
        <Plus className="size-5" aria-hidden /> Novo mensalista
      </button>

      {creating && view?.firstCourt && (
        <ReservationSheet init={{ mode: 'new', courtId: view.firstCourt, date: today, repeat: true }} onClose={() => setCreating(false)} />
      )}
      {opened && (
        <RecurrenceSheet
          key={opened.rec.id}
          rec={opened.rec}
          summary={opened.summary}
          customer={view?.customers.get(opened.rec.customerId)}
          court={view?.courts.get(opened.rec.courtId)}
          today={today}
          onClose={() => navigate('/mensalistas', { replace: true })}
        />
      )}
    </>
  );
}
