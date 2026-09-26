/**
 * Faixa fina "Demonstração" no topo (só com demo: true).
 * No celular é só texto; o "Como funciona?" fica em Mais. A partir de sm aparece também aqui.
 */
import { PlayCircle } from 'lucide-react';
import { openTour } from './tourStore';

export function DemoBanner() {
  return (
    <div className="no-print pt-safe flex min-h-7 items-center gap-2 border-b border-border px-4 text-xs text-muted-foreground">
      <p className="min-w-0 flex-1 truncate">
        Demonstração <span className="hidden sm:inline">· dados de exemplo</span>
      </p>
      <button type="button" onClick={openTour} className="hidden min-h-8 shrink-0 items-center gap-1 rounded-md px-2 font-medium text-brand hover:bg-accent sm:inline-flex">
        <PlayCircle className="size-3.5" aria-hidden /> Como funciona?
      </button>
    </div>
  );
}
