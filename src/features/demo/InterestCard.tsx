/**
 * "Tenho interesse" (só na demonstração, no fim do Resumo).
 * Mostra o telefone do vendedor como texto e um botão que só copia o número.
 * Nada é enviado e nenhum app externo é aberto.
 */
import { useState } from 'react';
import { Copy, Phone, Sparkles } from 'lucide-react';
import tenant from '../../config/tenant.config';
import { formatPhone } from '../../domain/phone';
import { copyText } from '../../utils/clipboard';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';

export function InterestCard() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const phone = formatPhone(tenant.contactPhone);

  return (
    <>
      <section className="no-print rounded-2xl border border-brand/30 bg-brand-soft p-4">
        <h2 className="flex items-center gap-2 font-semibold text-brand-strong">
          <Sparkles className="size-5" aria-hidden /> Quer isso na sua quadra?
        </h2>
        <p className="mt-1 text-sm text-slate-700">Com o nome, a logo, as quadras e os preços do seu estabelecimento.</p>
        <Button className="mt-3" block onClick={() => setOpen(true)}>
          Tenho interesse
        </Button>
      </section>

      {open && (
        <Sheet open onClose={() => setOpen(false)} title="Tenho interesse">
          <p className="text-sm text-slate-600">Fale com o responsável pelo sistema:</p>
          <p className="my-3 flex items-center gap-2 text-2xl font-bold tabular-nums">
            <Phone className="size-5 text-brand" aria-hidden /> {phone}
          </p>
          <Button
            block
            variant="secondary"
            onClick={async () => {
              const ok = await copyText(tenant.contactPhone.replace(/\D/g, ''));
              if (ok) toast.success('Número copiado.');
              else toast.error('Não foi possível copiar. Anote o número acima.');
            }}
          >
            <Copy className="size-4" aria-hidden /> Copiar número
          </Button>
          <a href="#/mais/condicoes" onClick={() => setOpen(false)} className="mt-3 block text-center text-sm font-semibold text-brand underline-offset-2 hover:underline">
            Ver condições e valor
          </a>
        </Sheet>
      )}
    </>
  );
}
