/** Dados da quadra: nome, logo, cores, telefone e preferências gerais. */
import { useEffect, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useSettingsState } from '../../../db/hooks';
import { saveSettings } from '../../../db/settingsRepo';
import type { AppSettings } from '../../../domain/types';
import { Button, Chip, Field, Input, Select } from '../../../components/ui/controls';
import { CourtBadge } from '../../../components/AppShell';
import { useToast } from '../../../components/ui/Toast';
import { resizeImageToDataUrl } from '../../../utils/image';
import { errorMessage } from '../../../utils/text';

type VenueFields = Pick<
  AppSettings,
  'courtName' | 'shortName' | 'logo' | 'primaryColor' | 'accentColor' | 'courtPhone' | 'weekStartsOn' | 'slotMinutes' | 'backupReminderDays'
>;

export function VenueSection({ compact, onSaved }: { compact?: boolean; onSaved?: () => void }) {
  const { settings, loaded } = useSettingsState();
  const toast = useToast();
  const [f, setF] = useState<VenueFields | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loaded && !f) {
      const { courtName, shortName, logo, primaryColor, accentColor, courtPhone, weekStartsOn, slotMinutes, backupReminderDays } = settings;
      setF({ courtName, shortName, logo, primaryColor, accentColor, courtPhone, weekStartsOn, slotMinutes, backupReminderDays });
    }
  }, [loaded, settings, f]);

  if (!f) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
  const set = <K extends keyof VenueFields>(k: K, v: VenueFields[K]) => setF({ ...f, [k]: v });

  async function save() {
    if (!f) return;
    if (!f.courtName.trim()) return toast.error('Informe o nome do estabelecimento.');
    setBusy(true);
    try {
      await saveSettings({ ...f, courtName: f.courtName.trim(), shortName: (f.shortName.trim() || f.courtName.trim()).slice(0, 20) });
      toast.success('Dados da quadra salvos.');
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome do estabelecimento" htmlFor="v-name">
        <Input id="v-name" value={f.courtName} onChange={(e) => set('courtName', e.target.value)} placeholder="Ex.: Arena do Bairro" />
      </Field>
      <Field label="Nome curto (ícone do app)" htmlFor="v-short" hint="Até 20 letras. Aparece embaixo do ícone no celular.">
        <Input id="v-short" maxLength={20} value={f.shortName} onChange={(e) => set('shortName', e.target.value)} />
      </Field>

      <Field label="Logo">
        <div className="flex items-center gap-3">
          {f.logo ? <img src={f.logo} alt="Logo atual" className="size-14 rounded-xl object-cover" /> : <CourtBadge size={56} />}
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">
            <ImagePlus className="size-4" aria-hidden /> Escolher imagem
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  set('logo', await resizeImageToDataUrl(file));
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            />
          </label>
          {f.logo && (
            <Button variant="ghost" className="px-3" onClick={() => set('logo', '')} aria-label="Remover logo">
              <Trash2 className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cor principal" htmlFor="v-color1">
          <div className="flex items-center gap-2">
            <input id="v-color1" type="color" value={f.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300" />
            <span className="text-sm tabular-nums text-slate-600">{f.primaryColor}</span>
          </div>
        </Field>
        <Field label="Cor de destaque" htmlFor="v-color2">
          <div className="flex items-center gap-2">
            <input id="v-color2" type="color" value={f.accentColor} onChange={(e) => set('accentColor', e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300" />
            <span className="text-sm tabular-nums text-slate-600">{f.accentColor}</span>
          </div>
        </Field>
      </div>

      <Field label="Telefone da quadra" htmlFor="v-phone" hint="Opcional. Com DDD.">
        <Input id="v-phone" inputMode="tel" value={f.courtPhone} onChange={(e) => set('courtPhone', e.target.value)} />
      </Field>

      {!compact && (
        <>
          <Field label="A semana começa no">
            <div className="flex gap-2">
              <Chip selected={f.weekStartsOn === 0} onClick={() => set('weekStartsOn', 0)}>
                Domingo
              </Chip>
              <Chip selected={f.weekStartsOn === 1} onClick={() => set('weekStartsOn', 1)}>
                Segunda
              </Chip>
            </div>
          </Field>
          <Field label="Intervalo da agenda" hint="Tamanho de cada horário na agenda e das durações.">
            <div className="flex gap-2">
              <Chip selected={f.slotMinutes === 60} onClick={() => set('slotMinutes', 60)}>
                1 hora
              </Chip>
              <Chip selected={f.slotMinutes === 30} onClick={() => set('slotMinutes', 30)}>
                30 minutos
              </Chip>
            </div>
          </Field>
          <Field label="Lembrar de fazer backup a cada" htmlFor="v-bk">
            <Select id="v-bk" value={f.backupReminderDays} onChange={(e) => set('backupReminderDays', Number(e.target.value))}>
              {[1, 3, 7, 14, 30].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'dia' : 'dias'}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}

      <Button onClick={() => void save()} disabled={busy}>
        Salvar dados da quadra
      </Button>
    </div>
  );
}
