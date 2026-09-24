/** Mensagens de WhatsApp editáveis, com variáveis e pré-visualização. */
import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useSettingsState } from '../../../db/hooks';
import { saveSettings } from '../../../db/settingsRepo';
import type { WhatsAppTemplates } from '../../../domain/types';
import { DEFAULT_TEMPLATES, fillTemplate, templateValues, TEMPLATE_VARIABLES } from '../../../domain/whatsapp';
import { addDays, monthOf, todayISO } from '../../../domain/dates';
import { Button, Field, Textarea } from '../../../components/ui/controls';
import { useToast } from '../../../components/ui/Toast';

const LABELS: Record<keyof WhatsAppTemplates, string> = {
  confirmar: 'Confirmar horário',
  lembrar: 'Lembrar do jogo',
  cobrar: 'Cobrar saldo',
  mensalidade: 'Cobrar mensalidade',
};

export function TemplatesSection() {
  const { settings, loaded } = useSettingsState();
  const toast = useToast();
  const [t, setT] = useState<WhatsAppTemplates | null>(null);
  const refs = useRef<Partial<Record<keyof WhatsAppTemplates, HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    if (loaded && !t) setT(settings.whatsappTemplates);
  }, [loaded, settings.whatsappTemplates, t]);
  if (!t) return <p className="py-6 text-center text-slate-500">Carregando…</p>;

  const sample = templateValues({
    customerName: 'João Silva',
    courtName: 'Quadra 1',
    venueName: settings.courtName,
    date: addDays(todayISO(), 2),
    startMin: 20 * 60,
    endMin: 21 * 60,
    price: 12000,
    balance: 6000,
    pixKey: settings.pixKey,
    month: monthOf(todayISO()),
  });

  function insertVar(k: keyof WhatsAppTemplates, v: string) {
    const el = refs.current[k];
    const cur = t![k];
    const token = `{${v}}`;
    if (!el) return setT({ ...t!, [k]: cur + token });
    const s = el.selectionStart ?? cur.length;
    const e = el.selectionEnd ?? cur.length;
    setT({ ...t!, [k]: cur.slice(0, s) + token + cur.slice(e) });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-600">Toque numa variável para inseri-la no texto. Ela é trocada pelos dados da reserva na hora de enviar.</p>
      {(Object.keys(LABELS) as Array<keyof WhatsAppTemplates>).map((k) => (
        <section key={k} className="rounded-2xl border border-slate-200 bg-white p-3">
          <Field label={LABELS[k]} htmlFor={`tpl-${k}`}>
            <Textarea
              id={`tpl-${k}`}
              ref={(el) => {
                refs.current[k] = el;
              }}
              rows={4}
              value={t[k]}
              onChange={(e) => setT({ ...t, [k]: e.target.value })}
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <button key={v} type="button" className="min-h-9 rounded-lg bg-slate-100 px-2 text-xs font-medium text-slate-700 hover:bg-slate-200" onClick={() => insertVar(k, v)}>
                {`{${v}}`}
              </button>
            ))}
          </div>
          <p className="mt-2 rounded-xl bg-green-50 p-2 text-sm text-green-950">
            <span className="block text-xs font-semibold text-green-800">Exemplo</span>
            {fillTemplate(t[k], sample)}
          </p>
          {t[k] !== DEFAULT_TEMPLATES[k] && (
            <button type="button" className="mt-1 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand" onClick={() => setT({ ...t, [k]: DEFAULT_TEMPLATES[k] })}>
              <RotateCcw className="size-4" aria-hidden /> Voltar ao texto padrão
            </button>
          )}
        </section>
      ))}
      <Button
        onClick={() =>
          void saveSettings({ whatsappTemplates: t }).then(() => toast.success('Mensagens salvas.'))
        }
      >
        Salvar mensagens
      </Button>
    </div>
  );
}
