/** Aparência: Automático (segue o celular), Claro ou Escuro. Muda na hora, sem precisar salvar. */
import { Monitor, Moon, Sun } from 'lucide-react';
import { useSettings } from '../../../db/hooks';
import { saveSettings } from '../../../db/settingsRepo';
import type { ThemePreference } from '../../../domain/types';
import { Chip, Field } from '../../../components/ui/controls';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Automático', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
];

export function ThemeField() {
  const s = useSettings();
  return (
    <Field label="Aparência" hint="Automático segue o modo claro/escuro do celular. Muda na hora.">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Aparência">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <Chip key={value} role="radio" aria-checked={s.theme === value} aria-pressed={undefined} selected={s.theme === value} onClick={() => void saveSettings({ theme: value })}>
            <Icon className="size-4" aria-hidden /> {label}
          </Chip>
        ))}
      </div>
    </Field>
  );
}
