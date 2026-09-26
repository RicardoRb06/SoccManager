/** Mais (só na demonstração): abre o tour "Como funciona?". */
import { ChevronRight, PlayCircle } from 'lucide-react';
import { openTour } from './tourStore';

export function TourItem() {
  return (
    <button type="button" className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" onClick={openTour}>
      <PlayCircle className="size-5 text-brand" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Como funciona?</span>
        <span className="block text-xs text-muted-foreground">Tour rápido pelas telas do app</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground/70" aria-hidden />
    </button>
  );
}
