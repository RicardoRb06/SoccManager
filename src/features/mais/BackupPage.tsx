/** Mais › Backup e segurança. */
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ChevronLeft, Download, FileUp, History, Share2, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { PageHeader } from '../../components/AppShell';
import { Button } from '../../components/ui/controls';
import { Sheet } from '../../components/ui/Sheet';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { useToast } from '../../components/ui/Toast';
import { db, type Snapshot } from '../../db/database';
import { useSettings } from '../../db/hooks';
import { createSnapshot, importBackup, parseBackup, restoreSnapshot, type ParseResult } from '../../db/backup';
import { formatBytes, requestPersistence, storageStatus, type StorageStatus } from '../../db/storage';
import { useBackupActions, useBackupReminder } from './useBackup';

const REASON: Record<Snapshot['reason'], string> = {
  diario: 'Cópia automática do dia',
  'antes-de-importar': 'Antes de importar um backup',
  'antes-de-restaurar': 'Antes de restaurar uma cópia',
  'antes-de-restaurar-exemplo': 'Antes de restaurar os dados de exemplo',
  manual: 'Cópia feita manualmente',
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function countsLine(c: Record<string, number>) {
  return `${c.reservas ?? 0} reservas · ${c.clientes ?? 0} clientes · ${c.mensalistas ?? 0} mensalistas · ${c.pagamentos ?? 0} pagamentos`;
}

export default function BackupPage() {
  const s = useSettings();
  const toast = useToast();
  const { save, share, canShare } = useBackupActions();
  const reminder = useBackupReminder();
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [preview, setPreview] = useState<Extract<ParseResult, { ok: true }> | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<Snapshot | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), []);

  useEffect(() => {
    void storageStatus().then(setStatus);
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const result = parseBackup(text);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      setAgree(false);
      setPreview(result);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function doImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const before = await importBackup(preview.backup);
      setPreview(null);
      toast.show('Backup restaurado. Os dados anteriores foram guardados numa cópia interna.', {
        kind: 'success',
        durationMs: 10000,
        action: {
          label: 'Desfazer',
          onClick: () => void restoreSnapshot(before.id).then(() => toast.success('Importação desfeita.')),
        },
      });
    } catch (err) {
      toast.error(`Não foi possível importar. Nada foi alterado. (${err instanceof Error ? err.message : String(err)})`);
    } finally {
      setBusy(false);
    }
  }

  const protectedOk = status?.persisted === true;

  return (
    <>
      <PageHeader
        title="Backup e segurança"
        subtitle="Seus dados ficam só neste aparelho"
        actions={
          <a href="#/mais" className="grid size-11 place-items-center rounded-full hover:bg-accent" aria-label="Voltar para Mais">
            <ChevronLeft className="size-5" aria-hidden />
          </a>
        }
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        {/* Backup em arquivo */}
        <section className={`rounded-2xl border p-4 ${reminder.due ? 'border-warning-border bg-warning-soft' : 'border-border bg-card'}`}>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <Download className="size-5 text-brand" aria-hidden /> Backup em arquivo
          </h2>
          <p className="text-sm text-foreground/85">
            Último backup:{' '}
            <strong>
              {s.lastBackupAt ? `${fmtDateTime(s.lastBackupAt)}${reminder.daysSince ? ` (há ${reminder.daysSince} dia${reminder.daysSince > 1 ? 's' : ''})` : ''}` : 'nunca feito'}
            </strong>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Gera um arquivo com tudo (reservas, clientes, mensalistas, pagamentos e configurações). Guarde fora do aparelho: Google Drive, e-mail ou pendrive.
            Recomendado a cada {s.backupReminderDays} dias.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button onClick={() => void save()}>
              <Download className="size-4" aria-hidden /> Salvar arquivo
            </Button>
            {canShare && (
              <Button variant="outline" onClick={() => void share()}>
                <Share2 className="size-4" aria-hidden /> Compartilhar (Drive, e-mail…)
              </Button>
            )}
          </div>
        </section>

        {/* Restaurar de arquivo */}
        <section className="rounded-xl border bg-card shadow-xs p-4">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <FileUp className="size-5 text-brand" aria-hidden /> Restaurar de um arquivo
          </h2>
          <p className="text-sm text-muted-foreground">
            Use para trocar de aparelho ou recuperar dados. Antes de substituir, o app mostra o conteúdo do arquivo e guarda uma cópia do que existe hoje.
          </p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" id="backup-file" onChange={(e) => void onFile(e.target.files?.[0])} />
          <label
            htmlFor="backup-file"
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-input bg-card px-4 font-semibold text-foreground hover:bg-accent"
          >
            <FileUp className="size-4" aria-hidden /> Escolher arquivo de backup
          </label>
        </section>

        {/* Armazenamento protegido */}
        <section className={`rounded-2xl border p-4 ${protectedOk ? 'border-success-border bg-success-soft' : 'border-warning-border bg-warning-soft'}`}>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            {protectedOk ? <ShieldCheck className="size-5 text-success" aria-hidden /> : <ShieldAlert className="size-5 text-warning" aria-hidden />}
            Armazenamento protegido: {status === null ? '…' : protectedOk ? 'sim' : 'não'}
          </h2>
          <p className="text-sm text-foreground/85">
            {protectedOk
              ? 'O navegador foi instruído a não apagar os dados deste app para liberar espaço.'
              : 'O navegador ainda pode apagar os dados deste app se o aparelho ficar sem espaço. Instalar o app na tela inicial costuma liberar a proteção.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Espaço usado: {formatBytes(status?.usage ?? null)} de {formatBytes(status?.quota ?? null)} disponíveis para o app.
          </p>
          {!protectedOk && status?.supported && (
            <Button
              variant="outline"
              className="mt-3"
              onClick={async () => {
                const ok = await requestPersistence();
                setStatus(await storageStatus());
                if (ok) toast.success('Armazenamento protegido.');
                else toast.show('O navegador não concedeu agora. Instale o app na tela inicial e tente de novo.', { kind: 'info', durationMs: 6000 });
              }}
            >
              <ShieldCheck className="size-4" aria-hidden /> Pedir proteção
            </Button>
          )}
        </section>

        {/* Cópias internas */}
        <section className="rounded-xl border bg-card shadow-xs p-4">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <History className="size-5 text-brand" aria-hidden /> Cópias internas automáticas
          </h2>
          <p className="text-sm text-muted-foreground">
            Todo dia, na primeira abertura, o app guarda uma cópia (as 5 mais recentes). Serve para desfazer um erro, como excluir algo por engano.
          </p>
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning-soft p-2 text-sm text-warning-fg">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Elas ficam neste aparelho: se o celular quebrar ou os dados do navegador forem limpos, somem junto. Não substituem o backup em arquivo.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {(snapshots ?? []).map((sn) => (
              <li key={sn.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{fmtDateTime(sn.createdAt)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {REASON[sn.reason]} · {countsLine(sn.counts)}
                  </p>
                </div>
                <Button variant="outline" className="shrink-0 px-3 text-sm" onClick={() => setRestore(sn)}>
                  Restaurar
                </Button>
              </li>
            ))}
            {snapshots && snapshots.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nenhuma cópia ainda.</li>}
          </ul>
          <Button
            variant="ghost"
            className="mt-2"
            onClick={() => void createSnapshot('manual').then(() => toast.success('Cópia interna criada.'))}
          >
            Criar cópia agora
          </Button>
        </section>

        {/* Orientação */}
        <section className="rounded-xl border bg-card shadow-xs p-4 text-sm text-foreground/85">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <Info className="size-5 text-brand" aria-hidden /> Para não perder dados
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>Os dados ficam guardados no navegador deste aparelho</strong>, não na internet. Outro celular não vê a mesma agenda.
            </li>
            <li>
              <strong>“Limpar dados de navegação”</strong> (ou “limpar cache e dados do site”) apaga a agenda. Antes de fazer isso, salve um backup.
            </li>
            <li>
              <strong>Instale o app na tela inicial.</strong> Ele abre mais rápido, funciona sem internet e o navegador protege melhor os dados.
            </li>
            <li>
              <strong>Nunca use aba anônima</strong> (modo privado): tudo é apagado quando a aba fecha.
            </li>
            <li>
              <strong>Trocou de celular?</strong> Salve o backup no aparelho antigo, abra o app no novo e use “Restaurar de um arquivo”.
            </li>
          </ul>
        </section>
      </div>

      {preview && (
        <Sheet
          open
          onClose={() => setPreview(null)}
          title="Restaurar este backup?"
          footer={
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPreview(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" disabled={!agree || busy} onClick={() => void doImport()}>
                Substituir tudo
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-3">
              <dt className="text-muted-foreground">Backup de</dt>
              <dd className="font-medium">{fmtDateTime(preview.backup.exportedAt)}</dd>
              <dt className="text-muted-foreground">Reservas</dt>
              <dd className="font-medium tabular-nums">{preview.counts.reservas}</dd>
              <dt className="text-muted-foreground">Clientes</dt>
              <dd className="font-medium tabular-nums">{preview.counts.clientes}</dd>
              <dt className="text-muted-foreground">Mensalistas</dt>
              <dd className="font-medium tabular-nums">{preview.counts.mensalistas}</dd>
              <dt className="text-muted-foreground">Pagamentos</dt>
              <dd className="font-medium tabular-nums">{preview.counts.pagamentos}</dd>
              <dt className="text-muted-foreground">Quadras</dt>
              <dd className="font-medium tabular-nums">{preview.counts.quadras}</dd>
            </dl>
            {preview.otherTenant && (
              <p className="flex items-start gap-2 rounded-xl bg-warning-soft p-2 text-warning-fg">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Este backup parece ser de outra quadra. Confira antes de continuar.
              </p>
            )}
            {preview.migratedFrom !== undefined && <p className="text-muted-foreground">Backup de uma versão anterior do app: ele será convertido automaticamente.</p>}
            <p className="text-foreground/85">
              <strong>Todos os dados atuais deste aparelho serão substituídos</strong> pelos do arquivo. Uma cópia interna do estado atual é guardada antes, e você pode desfazer logo em seguida.
            </p>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
              <input type="checkbox" className="size-5 accent-[var(--brand-primary)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              Entendo que os dados atuais serão substituídos
            </label>
          </div>
        </Sheet>
      )}

      <ConfirmSheet
        open={!!restore}
        title="Restaurar esta cópia?"
        confirmLabel="Restaurar"
        danger
        onClose={() => setRestore(null)}
        onConfirm={async () => {
          if (!restore) return;
          try {
            await restoreSnapshot(restore.id);
            toast.success('Cópia restaurada. O estado anterior também foi guardado.');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Não foi possível restaurar.');
          }
          setRestore(null);
        }}
      >
        {restore && (
          <p>
            Os dados voltam a ser como estavam em <strong>{fmtDateTime(restore.createdAt)}</strong> ({countsLine(restore.counts)}). O estado atual é guardado numa nova cópia antes.
          </p>
        )}
      </ConfirmSheet>
    </>
  );
}
