// Carregada sob demanda (lazy). Backup, configurações, lixeira etc. chegam nos marcos 6 e 7.
import { ChevronRight, Database, Lock } from 'lucide-react';
import { ComingSoon, PageHeader } from '../../components/AppShell';
import { DB_NAME } from '../../db/database';
import { useCounts, useSettings } from '../../db/hooks';

export default function MaisPage() {
  const counts = useCounts();
  const s = useSettings();
  return (
    <>
      <PageHeader title="Mais" />
      <nav aria-label="Opções" className="m-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <a href="#/mais/bloqueios" className="flex min-h-14 items-center gap-3 px-4 hover:bg-slate-50">
          <Lock className="size-5 text-brand" aria-hidden />
          <span className="flex-1">
            <span className="block font-medium">Bloqueios de horário</span>
            <span className="block text-xs text-slate-500">Manutenção, eventos e feriados</span>
          </span>
          <ChevronRight className="size-5 text-slate-400" aria-hidden />
        </a>
      </nav>
      <section className="m-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Database className="size-5 text-brand" aria-hidden /> Dados neste aparelho
        </h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Reservas</dt>
          <dd className="text-right font-medium tabular-nums">{counts?.reservations ?? '…'}</dd>
          <dt className="text-slate-500">Clientes</dt>
          <dd className="text-right font-medium tabular-nums">{counts?.customers ?? '…'}</dd>
          <dt className="text-slate-500">Mensalistas</dt>
          <dd className="text-right font-medium tabular-nums">{counts?.recurrences ?? '…'}</dd>
          <dt className="text-slate-500">Pagamentos</dt>
          <dd className="text-right font-medium tabular-nums">{counts?.payments ?? '…'}</dd>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Banco: <code>{DB_NAME}</code> · formato {s.schemaVersion}
        </p>
      </section>
      <ComingSoon milestone={6} />
      <p className="px-4 pb-4 text-center text-xs text-slate-400">Versão {__APP_VERSION__}</p>
    </>
  );
}
