/**
 * Resumo (a tela que vende): recebido, a receber, ocupação, faltas, horas vazias,
 * mapa de calor com sugestões, ranking de clientes, lista "A receber" e exportação CSV.
 * Carregada sob demanda (lazy).
 */
import { useMemo, useState } from 'react';
import { Download, Hourglass, Lightbulb, MessageCircle, Trophy } from 'lucide-react';
import { PageHeader } from '../../components/AppShell';
import { Button, Chip } from '../../components/ui/controls';
import { Sheet } from '../../components/ui/Sheet';
import { WhatsAppSheet } from '../../components/WhatsAppSheet';
import { useToast } from '../../components/ui/Toast';
import { useAllData, useSettings } from '../../db/hooks';
import { formatDateBR, formatMonthBR, nowMinutes, todayISO } from '../../domain/dates';
import { formatBRL } from '../../domain/money';
import { minToHHMM } from '../../domain/time';
import { prepareSchedule } from '../../domain/schedule';
import { buildReport, PERIOD_LABELS, periodFor, type PeriodKind } from '../../domain/report';
import type { ReceivableItem } from '../../domain/metrics';
import { paymentsCSV, reservationsCSV, slugify } from '../../domain/csv';
import { downloadText } from '../../utils/download';
import { Heatmap } from './Heatmap';

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' }) {
  const toneCls = tone === 'good' ? 'text-green-800' : tone === 'warn' ? 'text-amber-800' : tone === 'bad' ? 'text-red-700' : 'text-slate-900';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`break-words text-xl font-bold tabular-nums sm:text-2xl ${toneCls}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function ResumoPage() {
  const all = useAllData();
  const settings = useSettings();
  const toast = useToast();
  const [kind, setKind] = useState<PeriodKind>('mes_atual');
  const [charge, setCharge] = useState<ReceivableItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const today = todayISO();

  const view = useMemo(() => {
    if (!all) return undefined;
    const prep = prepareSchedule({ ...all, openingHours: settings.openingHours });
    const period = periodFor(kind, today);
    const report = buildReport(prep, all.payments, all.priceRules, period, settings.slotMinutes, today, nowMinutes());
    return {
      prep,
      report,
      lookups: {
        customers: new Map(all.customers.map((c) => [c.id, c])),
        courts: new Map(all.courts.map((c) => [c.id, c])),
        recurrences: new Map(all.recurrences.map((r) => [r.id, r])),
        rules: all.priceRules,
      },
    };
  }, [all, settings.openingHours, settings.slotMinutes, kind, today]);

  const r = view?.report;
  const periodText = r ? `${formatDateBR(r.period.from)} a ${formatDateBR(r.period.to)}` : '';

  function exportCsv(which: 'reservas' | 'pagamentos') {
    if (!view || !all || !r) return;
    const slug = slugify(settings.shortName || settings.courtName);
    const name = `${which}-${slug}-${r.period.from}_a_${r.period.to}.csv`;
    const content =
      which === 'reservas'
        ? reservationsCSV(view.prep, all.payments, r.period, view.lookups)
        : paymentsCSV(all.payments, all.reservations, r.period, view.lookups);
    downloadText(name, content);
    toast.success(`Arquivo ${name} gerado.`);
    setExporting(false);
  }

  const chargeInfo = (i: ReceivableItem) => {
    if (i.kind === 'reserva') return { courtId: i.reservation.courtId, startMin: i.reservation.startMin, endMin: i.reservation.endMin, date: i.date };
    const rec = view?.lookups.recurrences.get(i.recurrenceId);
    return { courtId: rec?.courtId ?? '', startMin: rec?.startMin ?? 0, endMin: rec?.endMin ?? 60, date: i.kind === 'ocorrencia' ? i.date : `${i.month}-01` };
  };

  return (
    <>
      <PageHeader
        title="Resumo"
        subtitle={periodText}
        actions={
          <Button variant="secondary" className="px-3" onClick={() => setExporting(true)} aria-label="Exportar CSV" disabled={!r}>
            <Download className="size-4" aria-hidden /> <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Período">
          {(Object.keys(PERIOD_LABELS) as PeriodKind[]).map((k) => (
            <Chip key={k} selected={k === kind} onClick={() => setKind(k)} className="shrink-0">
              {PERIOD_LABELS[k]}
            </Chip>
          ))}
        </div>

        {!r || !view ? (
          <p className="py-10 text-center text-slate-500">Calculando…</p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Indicadores">
              <Kpi label="Recebido" value={formatBRL(r.received)} hint="Por data de pagamento" tone="good" />
              <Kpi label="A receber" value={formatBRL(r.receivable)} hint={`${r.receivables.length} pendência(s)`} tone={r.receivable > 0 ? 'warn' : undefined} />
              <Kpi label="Ocupação" value={`${Math.round(r.occupancy.rate * 100)}%`} hint={`${r.occupancy.occupied} de ${r.occupancy.available} horários`} />
              <Kpi label="Faltas" value={String(r.faltas)} hint="Times que não apareceram" tone={r.faltas > 0 ? 'bad' : undefined} />
            </section>

            <section className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
                <Hourglass className="size-4" aria-hidden /> Horas vazias
              </p>
              {r.empty.hours > 0 ? (
                <>
                  <p className="mt-1 text-lg leading-snug">
                    Você deixou <strong className="text-2xl tabular-nums">{Math.round(r.empty.hours)} horas</strong> vazias neste período, cerca de{' '}
                    <strong className="text-2xl tabular-nums text-amber-300">{formatBRL(r.empty.value)}</strong> não aproveitados.
                  </p>
                  <p className="mt-2 text-xs text-white/70">Calculado pela sua tabela de preços, só com horários que já passaram.</p>
                </>
              ) : (
                <p className="mt-1 text-lg">Nenhum horário vazio até agora neste período.</p>
              )}
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 font-semibold">Ocupação por dia e horário</h2>
                <Heatmap cells={r.heat} weekStartsOn={settings.weekStartsOn} />
                {r.promotions.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="mb-1 flex items-center gap-2 font-semibold">
                      <Lightbulb className="size-4" aria-hidden /> Horários mais vazios
                    </p>
                    <ol className="list-decimal pl-5">
                      {r.promotions.map((p) => (
                        <li key={`${p.cell.weekday}-${p.cell.hour}`}>
                          <span className="first-letter:uppercase">{p.label}</span>: {Math.round(p.cell.ratio * 100)}% ocupado
                          {p.currentPrice > 0 && p.suggestedPrice < p.currentPrice && (
                            <>
                              {' '}· que tal uma promoção de {formatBRL(p.currentPrice)} por <strong>{formatBRL(p.suggestedPrice)}</strong>?
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  <Trophy className="size-4 text-amber-500" aria-hidden /> Melhores clientes
                </h2>
                {r.top.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum pagamento neste período.</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {r.top.map((t, i) => {
                      const c = view.lookups.customers.get(t.customerId);
                      const max = r.top[0]!.total || 1;
                      return (
                        <li key={t.customerId}>
                          <a href={`#/clientes/${t.customerId}`} className="block rounded-xl px-1 py-1 hover:bg-slate-50">
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="truncate font-medium">
                                {i + 1}. {c?.name ?? 'Cliente'}
                              </span>
                              <span className="shrink-0 tabular-nums text-slate-700">{formatBRL(t.total)}</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden>
                              <div className="h-full rounded-full bg-brand" style={{ width: `${(t.total / max) * 100}%` }} />
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{t.games} jogo(s) no período</p>
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 font-semibold">A receber</h2>
              {r.receivables.length === 0 ? (
                <p className="rounded-xl bg-green-50 p-3 text-sm text-green-900">Nenhuma pendência no período.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {r.receivables.map((i, idx) => {
                    const c = view.lookups.customers.get(i.customerId);
                    const info = chargeInfo(i);
                    const what =
                      i.kind === 'mensalidade'
                        ? `Mensalidade de ${formatMonthBR(i.month)}`
                        : `Jogo de ${formatDateBR(i.date)} às ${minToHHMM(info.startMin)}`;
                    return (
                      <li key={idx} className="flex items-center gap-2 py-2">
                        <a href={`#/clientes/${i.customerId}`} className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{c?.name ?? 'Cliente'}</span>
                          <span className="block truncate text-xs text-slate-500">{what}</span>
                        </a>
                        <span className="font-semibold tabular-nums text-amber-800">{formatBRL(i.amount)}</span>
                        <button
                          type="button"
                          aria-label={`Cobrar ${c?.name ?? ''} pelo WhatsApp`}
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
            </section>
          </>
        )}
      </div>

      {exporting && r && (
        <Sheet open onClose={() => setExporting(false)} title="Exportar CSV">
          <p className="mb-3 text-sm text-slate-600">
            Período: {periodText}. O arquivo abre direto no Excel ou no Google Planilhas, com acentos e valores em reais.
          </p>
          <div className="grid gap-2">
            <Button onClick={() => exportCsv('reservas')}>
              <Download className="size-4" aria-hidden /> Reservas do período
            </Button>
            <Button variant="secondary" onClick={() => exportCsv('pagamentos')}>
              <Download className="size-4" aria-hidden /> Pagamentos do período
            </Button>
          </div>
        </Sheet>
      )}

      {charge && view && (
        <WhatsAppSheet
          phone={view.lookups.customers.get(charge.customerId)?.phone ?? ''}
          kinds={charge.kind === 'mensalidade' ? ['mensalidade'] : ['cobrar']}
          context={{
            customerName: view.lookups.customers.get(charge.customerId)?.name ?? '',
            courtName: view.lookups.courts.get(chargeInfo(charge).courtId)?.name ?? '',
            date: chargeInfo(charge).date,
            startMin: chargeInfo(charge).startMin,
            endMin: chargeInfo(charge).endMin,
            price: charge.amount,
            balance: charge.amount,
            month: charge.kind === 'mensalidade' ? charge.month : undefined,
          }}
          onClose={() => setCharge(null)}
        />
      )}
    </>
  );
}
