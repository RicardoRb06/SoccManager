/** Menu de mensagens prontas de WhatsApp (Confirmar / Lembrar / Cobrar). */
import { MessageCircle, AlertTriangle } from 'lucide-react';
import type { WhatsAppTemplates } from '../domain/types';
import { fillTemplate, normalizePhone, templateValues, waLink, type MessageContext } from '../domain/whatsapp';
import { useSettings } from '../db/hooks';
import { Sheet } from './ui/Sheet';

export type MessageKind = keyof WhatsAppTemplates;

const LABELS: Record<MessageKind, string> = {
  confirmar: 'Confirmar horário',
  lembrar: 'Lembrar do jogo',
  cobrar: 'Cobrar saldo',
  mensalidade: 'Cobrar mensalidade',
};

export function WhatsAppSheet({
  phone,
  context,
  kinds = ['confirmar', 'lembrar', 'cobrar'],
  onClose,
}: {
  phone: string;
  context: Omit<MessageContext, 'venueName' | 'pixKey'>;
  kinds?: MessageKind[];
  onClose: () => void;
}) {
  const s = useSettings();
  const values = templateValues({ ...context, venueName: s.courtName, pixKey: s.pixKey });
  const hasPhone = normalizePhone(phone) !== '';

  return (
    <Sheet open onClose={onClose} title="Enviar no WhatsApp">
      {!hasPhone && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Este cliente não tem telefone válido. O WhatsApp vai abrir para você escolher o contato.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {kinds.map((k) => {
          const text = fillTemplate(s.whatsappTemplates[k], values);
          return (
            <li key={k}>
              <a
                href={waLink(phone, text)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.setTimeout(onClose, 300)}
                className="block rounded-2xl border border-slate-200 p-3 hover:border-green-500 hover:bg-green-50"
              >
                <span className="mb-1 flex items-center gap-2 font-semibold text-green-800">
                  <MessageCircle className="size-5" aria-hidden /> {LABELS[k]}
                </span>
                <span className="block whitespace-pre-line text-sm text-slate-600">{text}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Os textos podem ser alterados em Mais › Configurações.</p>
    </Sheet>
  );
}
