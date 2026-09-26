// Mais: backup, configurações, bloqueios, lixeira e informações do app. Carregada sob demanda.
import { BadgeCheck, ChevronRight, Database, Lock, Phone, Settings, ShieldAlert, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react';
import { PageHeader } from '../../components/AppShell';
import { DB_NAME } from '../../db/database';
import { useCounts, useSettings } from '../../db/hooks';
import { useBackupReminder } from './useBackup';
import { formatPhone } from '../../domain/phone';
import { licenseService } from '../../license/LicenseService';
import { InstallItem } from './InstallItem';
import { RestoreDemoItem } from './RestoreDemoItem';
import { TourItem } from '../demo/TourItem';

function Item({ href, icon: Icon, title, subtitle, warn }: { href: string; icon: LucideIcon; title: string; subtitle: string; warn?: string }) {
  return (
    <a href={href} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-accent">
      <Icon className={`size-5 ${warn ? 'text-warning' : 'text-brand'}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {warn && <span className="rounded-full bg-warning-muted px-2 py-0.5 text-xs font-semibold text-warning-fg">{warn}</span>}
      <ChevronRight className="size-5 text-muted-foreground/70" aria-hidden />
    </a>
  );
}

export default function MaisPage() {
  const counts = useCounts();
  const s = useSettings();
  const reminder = useBackupReminder();
  const license = licenseService.getStatus();
  return (
    <>
      <PageHeader title="Mais" />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <nav aria-label="Opções" className="divide-y divide-border overflow-hidden rounded-xl border bg-card shadow-sm">
          <Item
            href="#/mais/backup"
            icon={reminder.due ? ShieldAlert : ShieldCheck}
            title="Backup e segurança"
            subtitle="Salvar e restaurar dados, cópias automáticas"
            warn={reminder.due ? 'Fazer backup' : undefined}
          />
          <Item href="#/mais/configuracoes" icon={Settings} title="Configurações" subtitle="Estabelecimento, quadras, horários e preços" />
          <Item href="#/mais/bloqueios" icon={Lock} title="Bloqueios de horário" subtitle="Manutenção, eventos e feriados" />
          <Item href="#/mais/lixeira" icon={Trash2} title="Lixeira" subtitle="Restaurar reservas e clientes excluídos" />
          <InstallItem />
        </nav>

        {license.mode === 'demo' && (
          <nav aria-label="Demonstração" className="divide-y divide-border overflow-hidden rounded-xl border bg-card shadow-sm">
            <TourItem />
            <RestoreDemoItem />
          </nav>
        )}

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold tracking-tight">
            <Database className="size-5 text-brand" aria-hidden /> Dados neste aparelho
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Reservas</dt>
            <dd className="text-right font-medium tabular-nums">{counts?.reservations ?? '…'}</dd>
            <dt className="text-muted-foreground">Clientes</dt>
            <dd className="text-right font-medium tabular-nums">{counts?.customers ?? '…'}</dd>
            <dt className="text-muted-foreground">Mensalistas</dt>
            <dd className="text-right font-medium tabular-nums">{counts?.recurrences ?? '…'}</dd>
            <dt className="text-muted-foreground">Pagamentos</dt>
            <dd className="text-right font-medium tabular-nums">{counts?.payments ?? '…'}</dd>
          </dl>
          {s.courtPhone && (
            <p className="mt-3 flex items-center gap-2 text-sm text-foreground/85">
              <Phone className="size-4 text-muted-foreground/70" aria-hidden /> Telefone da quadra: {formatPhone(s.courtPhone)}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Banco: <code>{DB_NAME}</code> · formato {s.schemaVersion}
          </p>
        </section>
        <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground/70">
          {license.mode === 'licensed' && <BadgeCheck className="size-4" aria-hidden />}
          {license.mode === 'licensed' ? `Licenciado para ${license.licensedTo}` : 'Versão de demonstração'} · Agenda da Quadra · versão {__APP_VERSION__}
        </p>
      </div>
    </>
  );
}
