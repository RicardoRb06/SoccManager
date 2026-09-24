/** Ações de backup reutilizadas (tela de Backup, banner, Encerrar o dia). */
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db } from '../../db/database';
import { useSettings } from '../../db/hooks';
import { backupFileName, buildBackup, markBackupDone } from '../../db/backup';
import { slugify } from '../../domain/csv';
import { diffDays, isoDateTimeToLocalDate, todayISO } from '../../domain/dates';
import { downloadText } from '../../utils/download';
import { useToast } from '../../components/ui/Toast';

/** Quantas reservas o usuário criou (sem contar os dados de exemplo) para decidir o lembrete. */
const REMINDER_MIN_RESERVATIONS = 10;

async function makeFile() {
  const bk = await buildBackup();
  const settings = await db.settings.get('shortName');
  const name = backupFileName(slugify(String(settings?.value ?? 'quadra')));
  const text = JSON.stringify(bk);
  return { name, text };
}

export function canShareFiles(): boolean {
  try {
    const f = new File(['{}'], 'teste.json', { type: 'application/json' });
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

export function useBackupActions() {
  const toast = useToast();

  const save = useCallback(async () => {
    try {
      const { name, text } = await makeFile();
      downloadText(name, text, 'application/json');
      await markBackupDone();
      toast.success(`Backup salvo: ${name}. Guarde-o fora do aparelho (Drive, e-mail).`);
      return true;
    } catch (err) {
      toast.error(`Não foi possível gerar o backup: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [toast]);

  const share = useCallback(async () => {
    try {
      const { name, text } = await makeFile();
      const file = new File([text], name, { type: 'application/json' });
      await navigator.share({ files: [file], title: 'Backup da agenda', text: 'Backup da Agenda da Quadra' });
      await markBackupDone();
      toast.success('Backup compartilhado.');
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false; // usuário cancelou
      toast.error('Não foi possível compartilhar. Use "Salvar arquivo".');
      return false;
    }
  }, [toast]);

  return { save, share, canShare: canShareFiles() };
}

/** Deve lembrar de fazer backup? */
export function useBackupReminder(): { due: boolean; daysSince: number | null } {
  const s = useSettings();
  const userReservations = useLiveQuery(async () => {
    const seeded = s.seededAt;
    return db.reservations.filter((r) => !seeded || r.createdAt > seeded).count();
  }, [s.seededAt]);
  return useMemo(() => {
    if (!s.lastBackupAt) return { due: (userReservations ?? 0) >= REMINDER_MIN_RESERVATIONS, daysSince: null };
    const days = diffDays(isoDateTimeToLocalDate(s.lastBackupAt), todayISO());
    return { due: days > s.backupReminderDays, daysSince: days };
  }, [s.lastBackupAt, s.backupReminderDays, userReservations]);
}
