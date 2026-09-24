/** Demonstração: "Restaurar dados de exemplo", com confirmação e Desfazer. */
import { useState } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { restoreDemoData, restoreSnapshot } from '../../db/backup';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { useToast } from '../../components/ui/Toast';
import { errorMessage } from '../../utils/text';

export function RestoreDemoItem() {
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();

  async function run() {
    try {
      const before = await restoreDemoData();
      setConfirm(false);
      toast.show('Dados de exemplo restaurados.', {
        kind: 'success',
        durationMs: 10000,
        action: { label: 'Desfazer', onClick: () => void restoreSnapshot(before.id).then(() => toast.success('Restauração desfeita.')) },
      });
    } catch (err) {
      toast.error(`Não foi possível restaurar. Nada foi alterado. (${errorMessage(err)})`);
    }
  }

  return (
    <>
      <button type="button" className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50" onClick={() => setConfirm(true)}>
        <RotateCcw className="size-5 text-brand" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Restaurar dados de exemplo</span>
          <span className="block text-xs text-slate-500">Volta a demonstração ao estado inicial</span>
        </span>
        <ChevronRight className="size-5 text-slate-400" aria-hidden />
      </button>
      <ConfirmSheet open={confirm} title="Restaurar dados de exemplo?" confirmLabel="Restaurar" danger onConfirm={run} onClose={() => setConfirm(false)}>
        <p className="text-sm text-slate-700">
          Tudo o que foi criado ou alterado nesta demonstração será substituído pelos dados de exemplo, com datas a partir de hoje. Uma cópia do estado atual fica
          guardada em Backup e segurança, e dá para desfazer logo em seguida.
        </p>
      </ConfirmSheet>
    </>
  );
}
