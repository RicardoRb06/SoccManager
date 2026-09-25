/** Lembrete discreto de backup no topo (some por esta sessão ao fechar). */
import { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useBackupActions, useBackupReminder } from './useBackup';

let dismissedThisSession = false;

export function BackupBanner() {
  const { due, daysSince } = useBackupReminder();
  const { save } = useBackupActions();
  const [hidden, setHidden] = useState(dismissedThisSession);
  if (!due || hidden) return null;
  return (
    <div role="status" className="no-print pt-safe flex items-center gap-3 border-b border-warning-border bg-warning-soft px-4 py-2 text-sm text-warning-fg">
      <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden />
      <p className="flex-1">
        {daysSince === null ? 'Você ainda não fez nenhum backup.' : `Último backup há ${daysSince} dias.`}{' '}
        <a href="#/mais/backup" className="font-semibold underline">
          Saiba mais
        </a>
      </p>
      <button type="button" className="min-h-11 shrink-0 rounded-xl bg-amber-600 px-3 font-semibold text-white hover:bg-amber-700" onClick={() => void save()}>
        Fazer backup
      </button>
      <button
        type="button"
        aria-label="Lembrar depois"
        className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-warning-muted"
        onClick={() => {
          dismissedThisSession = true;
          setHidden(true);
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
