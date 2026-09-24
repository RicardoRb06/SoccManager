/**
 * Aviso "Nova versão disponível".
 * Atualizar só troca os arquivos do app (service worker). Os dados ficam no IndexedDB,
 * cujo nome nunca muda, então nada é perdido.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

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
      className="above-nav no-print fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-xl"
    >
      <RefreshCw className="size-5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm">Nova versão disponível. Seus dados continuam salvos.</p>
      <button
        type="button"
        className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900"
        onClick={() => updateServiceWorker(true)}
      >
        Atualizar
      </button>
      <button type="button" aria-label="Depois" className="grid size-11 place-items-center rounded-xl" onClick={() => setNeedRefresh(false)}>
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
