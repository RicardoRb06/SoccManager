/** Condições comerciais da demonstração (textos do tenant.config.ts › conditions). */
import { Check, ChevronLeft, Info, LifeBuoy } from 'lucide-react';
import { PageHeader } from '../../components/AppShell';
import tenant from '../../config/tenant.config';
import { formatBRL, reaisToCents } from '../../domain/money';

export default function ConditionsPage() {
  const c = tenant.conditions;
  return (
    <>
      <PageHeader
        title="Condições"
        subtitle="Agenda da Quadra"
        actions={
          <a href="#/mais" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <ChevronLeft className="size-4" aria-hidden /> Mais
          </a>
        }
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-500">Valor único</p>
          <p className="text-4xl font-bold tabular-nums text-brand-strong">{formatBRL(reaisToCents(c.price))}</p>
          {c.trialDays > 0 && <p className="mt-2 text-sm text-slate-600">{c.trialDays} dias para testar com os dados da sua quadra.</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">O que está incluído</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {c.included.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <LifeBuoy className="size-5 text-brand" aria-hidden /> Suporte
          </h2>
          <p className="text-sm text-slate-700">{c.support}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Info className="size-5 text-slate-500" aria-hidden /> Bom saber
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-slate-700">
            {c.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
