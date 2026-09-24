/** Faixa fina "Versão de demonstração" no topo (só com demo: true). */
import { Info, PlayCircle } from 'lucide-react';
import { openTour } from './tourStore';

export function DemoBanner() {
  return (
    <div className="no-print pt-safe flex items-center gap-2 border-b border-brand/20 bg-brand-soft px-3 py-1 sm:px-4 text-sm text-brand-strong">
      <Info className="hidden size-4 shrink-0 sm:block" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold sm:hidden">Demo</span>
        <span className="hidden font-semibold sm:inline">Versão de demonstração</span>
        <span className="hidden sm:inline"> · dados de exemplo</span>
      </p>
      <button type="button" onClick={openTour} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 font-semibold hover:bg-white/60">
        <PlayCircle className="size-4" aria-hidden /> Como funciona?
      </button>
      <a href="#/mais/condicoes" className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-2 font-semibold underline-offset-2 hover:underline">
        Condições
      </a>
    </div>
  );
}
