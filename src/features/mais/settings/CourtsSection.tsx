/** Quadras: adicionar, editar, ativar/desativar, ordenar, espaço compartilhado. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { db } from '../../../db/database';
import { deleteCourt, moveCourt, saveCourt } from '../../../db/settingsRepo';
import type { Court, Modality } from '../../../domain/types';
import { Sheet } from '../../../components/ui/Sheet';
import { Button, Field, Input, Select, Switch } from '../../../components/ui/controls';
import { ConfirmSheet } from '../../../components/ui/ConfirmSheet';
import { useToast } from '../../../components/ui/Toast';
import { errorMessage } from '../../../utils/text';

export const MODALITIES: Array<{ value: Modality; label: string }> = [
  { value: 'futsal', label: 'Futsal' },
  { value: 'society', label: 'Society' },
  { value: 'basquete', label: 'Basquete' },
  { value: 'volei', label: 'Vôlei' },
  { value: 'outro', label: 'Outro' },
];

function CourtSheet({ court, onClose }: { court?: Court; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(court?.name ?? '');
  const [modality, setModality] = useState<Modality>(court?.modality ?? 'futsal');
  const [active, setActive] = useState(court?.active ?? true);
  const [group, setGroup] = useState(court?.sharedSpaceGroup ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    try {
      await saveCourt({ id: court?.id, name, modality, active, sharedSpaceGroup: group });
      toast.success(court ? 'Quadra atualizada.' : 'Quadra adicionada.');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <Sheet
        open={!confirmDelete}
        onClose={onClose}
        title={court ? 'Editar quadra' : 'Nova quadra'}
        footer={
          <div className="flex gap-2">
            {court && (
              <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                Excluir
              </Button>
            )}
            <Button className="flex-1" onClick={() => void save()}>
              Salvar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Nome" htmlFor="c-name">
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Quadra 1 · Futsal" />
          </Field>
          <Field label="Modalidade" htmlFor="c-mod">
            <Select id="c-mod" value={modality} onChange={(e) => setModality(e.target.value as Modality)}>
              {MODALITIES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Espaço compartilhado (opcional)"
            htmlFor="c-group"
            hint="Quadras com o mesmo nome aqui ocupam o mesmo espaço físico: reservar uma bloqueia a outra. Ex.: poliesportiva."
          >
            <Input id="c-group" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Ex.: poliesportiva" />
          </Field>
          <Switch id="c-active" label="Quadra ativa (aparece na agenda)" checked={active} onChange={setActive} />
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        title="Excluir quadra?"
        confirmLabel="Excluir"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!court) return;
          try {
            await deleteCourt(court.id);
            toast.success('Quadra excluída.');
            onClose();
          } catch (err) {
            toast.error(errorMessage(err));
            setConfirmDelete(false);
          }
        }}
      >
        <p>Só é possível excluir uma quadra que nunca teve reservas. Se ela já foi usada, desative-a para manter o histórico.</p>
      </ConfirmSheet>
    </>
  );
}

export function CourtsSection() {
  const courts = useLiveQuery(() => db.courts.orderBy('order').toArray(), []);
  const [editing, setEditing] = useState<Court | 'new' | null>(null);
  const toast = useToast();

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card shadow-xs">
        {(courts ?? []).map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className={`truncate font-medium ${c.active ? '' : 'text-muted-foreground/70 line-through'}`}>{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {MODALITIES.find((m) => m.value === c.modality)?.label}
                {c.sharedSpaceGroup ? ` · espaço “${c.sharedSpaceGroup}”` : ''}
                {!c.active ? ' · desativada' : ''}
              </p>
            </div>
            <button type="button" aria-label={`Subir ${c.name}`} disabled={i === 0} className="grid size-10 place-items-center rounded-full hover:bg-accent disabled:opacity-30" onClick={() => void moveCourt(c.id, -1).catch((e) => toast.error(errorMessage(e)))}>
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Descer ${c.name}`}
              disabled={i === (courts?.length ?? 0) - 1}
              className="grid size-10 place-items-center rounded-full hover:bg-accent disabled:opacity-30"
              onClick={() => void moveCourt(c.id, 1).catch((e) => toast.error(errorMessage(e)))}
            >
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label={`Editar ${c.name}`} className="grid size-10 place-items-center rounded-full hover:bg-accent" onClick={() => setEditing(c)}>
              <Pencil className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={() => setEditing('new')}>
        <Plus className="size-4" aria-hidden /> Adicionar quadra
      </Button>
      {editing && <CourtSheet court={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
