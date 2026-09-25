/**
 * Aviso "Nova versão disponível".
 * Atualizar só troca os arquivos do app (service worker). Os dados ficam no IndexedDB,
 * cujo nome nunca muda, então nada é perdido.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '../components/ui/button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('Falha ao registrar o service worker', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="above-nav no-print fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
    >
      <RefreshCw className="size-5 shrink-0 text-brand" aria-hidden />
      <p className="flex-1 text-sm">Nova versão disponível. Seus dados continuam salvos.</p>
      <Button onClick={() => updateServiceWorker(true)}>Atualizar</Button>
      <Button variant="ghost" size="icon" aria-label="Depois" onClick={() => setNeedRefresh(false)}>
        <X className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
