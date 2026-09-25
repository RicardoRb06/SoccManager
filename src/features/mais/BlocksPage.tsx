import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Lock, Plus } from 'lucide-react';
import { db } from '../../db/database';
import type { Block } from '../../domain/types';
import { formatDateBR, todayISO } from '../../domain/dates';
import { formatTimeRange } from '../../domain/time';
import { PageHeader } from '../../components/AppShell';
import { Chip } from '../../components/ui/controls';
import { BlockSheet } from './BlockSheet';

export default function BlocksPage() {
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<Block | 'new' | null>(null);
  const today = todayISO();
  const blocks = useLiveQuery(() => db.blocks.orderBy('dateStart').toArray(), []);
  const courts = useLiveQuery(() => db.courts.toArray(), []);
  const courtName = (id: string) => courts?.find((c) => c.id === id)?.name ?? '—';
  const list = (blocks ?? []).filter((b) => (showPast ? b.dateEnd < today : b.dateEnd >= today));
  if (showPast) list.reverse();

  return (
    <>
      <PageHeader
        title="Bloqueios"
        subtitle="Manutenção, eventos e feriados"
        actions={
          <a href="#/mais" className="grid size-10 place-items-center rounded-full hover:bg-accent" aria-label="Voltar para Mais">
            <ChevronLeft className="size-5" aria-hidden />
          </a>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <Chip selected={!showPast} onClick={() => setShowPast(false)}>
            Próximos
          </Chip>
          <Chip selected={showPast} onClick={() => setShowPast(true)}>
            Passados
          </Chip>
        </div>
        {blocks && list.length === 0 && (
          <p className="rounded-2xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">
            {showPast ? 'Nenhum bloqueio passado.' : 'Nenhum bloqueio programado. Use o botão abaixo para bloquear um horário.'}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {list.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setEditing(b)} className="hatch-gray flex w-full items-start gap-3 rounded-2xl border border-input p-3 text-left">
                <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{b.reason}</span>
                  <span className="block text-sm text-foreground/85">
                    {b.dateStart === b.dateEnd ? formatDateBR(b.dateStart) : `${formatDateBR(b.dateStart)} a ${formatDateBR(b.dateEnd)}`} ·{' '}
                    {b.startMin !== undefined && b.endMin !== undefined ? formatTimeRange(b.startMin, b.endMin) : 'dia inteiro'}
                  </span>
                  <span className="block text-xs text-muted-foreground">{b.courtIds.map(courtName).join(', ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => setEditing('new')}
        className="fab-bottom no-print fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-white shadow-lg lg:right-8"
      >
        <Plus className="size-5" aria-hidden /> Novo bloqueio
      </button>
      {editing && <BlockSheet block={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
