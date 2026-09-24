/** Item "Instalar app" em Mais: usa o pedido de instalação do navegador ou mostra o passo a passo. */
import { useState } from 'react';
import { CheckCircle2, ChevronRight, Download, Share, SquarePlus } from 'lucide-react';
import { promptInstall, useInstallState } from '../../pwa/install';
import { Sheet } from '../../components/ui/Sheet';

export function InstallItem() {
  const state = useInstallState();
  const [help, setHelp] = useState(false);

  if (state === 'installed') {
    return (
      <div className="flex min-h-16 items-center gap-3 px-4 py-2">
        <CheckCircle2 className="size-5 text-brand" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">App instalado</span>
          <span className="block text-xs text-slate-500">Abra pelo ícone na tela inicial</span>
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50"
        onClick={() => (state === 'available' ? void promptInstall() : setHelp(true))}
      >
        <Download className="size-5 text-brand" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Instalar app</span>
          <span className="block text-xs text-slate-500">Ícone na tela inicial, abre em tela cheia e funciona sem internet</span>
        </span>
        <ChevronRight className="size-5 text-slate-400" aria-hidden />
      </button>

      {help && (
        <Sheet open onClose={() => setHelp(false)} title="Instalar app">
          {state === 'ios' ? (
            <ol className="flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-strong">1</span>
                <span>
                  Abra esta página no <strong>Safari</strong> e toque em <strong>Compartilhar</strong> <Share className="inline size-4 align-text-bottom" aria-label="(ícone de compartilhar)" /> na barra de baixo.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-strong">2</span>
                <span>
                  Role e toque em <strong>Adicionar à Tela de Início</strong> <SquarePlus className="inline size-4 align-text-bottom" aria-hidden />.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-strong">3</span>
                <span>
                  Toque em <strong>Adicionar</strong>. O ícone da quadra aparece na tela inicial.
                </span>
              </li>
            </ol>
          ) : (
            <div className="flex flex-col gap-3 text-sm text-slate-700">
              <p>
                <strong>Android (Chrome):</strong> toque no menu ⋮ e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
              </p>
              <p>
                <strong>Computador (Chrome ou Edge):</strong> clique no ícone de instalar no fim da barra de endereço.
              </p>
              <p className="text-slate-500">Se a opção não aparecer, o app pode já estar instalado ou o navegador não oferece instalação.</p>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
