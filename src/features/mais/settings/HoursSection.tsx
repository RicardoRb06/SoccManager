/** Horário de funcionamento por dia da semana. */
import { useEffect, useState } from 'react';
import { useSettingsState } from '../../../db/hooks';
import { saveOpeningHours } from '../../../db/settingsRepo';
import type { OpeningHours } from '../../../domain/types';
import { WEEKDAY_LONG } from '../../../domain/dates';
import { minToHHMM } from '../../../domain/time';
import { Button, Select } from '../../../components/ui/controls';
import { useToast } from '../../../components/ui/Toast';
import { errorMessage } from '../../../utils/text';

export function HoursSection({ onSaved, saveLabel = 'Salvar horários' }: { onSaved?: () => void; saveLabel?: string }) {
  const { settings, loaded } = useSettingsState();
  const toast = useToast();
  const [hours, setHours] = useState<OpeningHours | null>(null);
  const step = settings.slotMinutes;

  useEffect(() => {
    if (loaded && !hours) setHours(settings.openingHours);
  }, [loaded, settings.openingHours, hours]);

  if (!hours) return <p className="py-6 text-center text-muted-foreground">Carregando…</p>;
  const times = Array.from({ length: 1440 / step + 1 }, (_, i) => i * step);
  const order = settings.weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

  function setDay(i: number, v: OpeningHours[number]) {
    const next = [...hours!] as OpeningHours;
    next[i] = v;
    setHours(next);
  }

  async function save() {
    try {
      await saveOpeningHours(hours!);
      toast.success('Horário de funcionamento salvo.');
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border rounded-xl border bg-card shadow-sm">
        {order.map((i) => {
          const d = hours[i] ?? null;
          return (
            <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <label className="flex min-h-10 w-40 cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--brand-primary)]"
                  checked={!!d}
                  onChange={(e) => setDay(i, e.target.checked ? (hours[i] ?? { open: 16 * 60, close: 23 * 60 }) : null)}
                />
                <span className="first-letter:uppercase">{WEEKDAY_LONG[i]}</span>
              </label>
              {d ? (
                <div className="flex items-center gap-2">
                  <Select aria-label={`Abre ${WEEKDAY_LONG[i]}`} className="w-28" value={d.open} onChange={(e) => setDay(i, { ...d, open: Number(e.target.value) })}>
                    {times.slice(0, -1).map((m) => (
                      <option key={m} value={m}>
                        {minToHHMM(m)}
                      </option>
                    ))}
                  </Select>
                  <span className="text-muted-foreground">às</span>
                  <Select aria-label={`Fecha ${WEEKDAY_LONG[i]}`} className="w-28" value={d.close} onChange={(e) => setDay(i, { ...d, close: Number(e.target.value) })}>
                    {times.slice(1).map((m) => (
                      <option key={m} value={m}>
                        {minToHHMM(m)}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fechado</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Reservas já marcadas fora do novo horário continuam na agenda; só não é possível marcar novas.</p>
      <Button onClick={() => void save()}>{saveLabel}</Button>
    </div>
  );
}
