/** Criar/editar bloqueio de horário (manutenção, evento, feriado...). */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { db } from '../../db/database';
import { useSettings } from '../../db/hooks';
import { deleteBlock, saveBlock, type BlockInput } from '../../db/repo';
import type { Block, ISODate } from '../../domain/types';
import { formatDateBR, isISODate, todayISO } from '../../domain/dates';
import { formatTimeRange, minToHHMM, overlaps } from '../../domain/time';
import { reservationOccupies } from '../../domain/schedule';
import { Sheet } from '../../components/ui/Sheet';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Button, Chip, Field, Input, Select, Switch } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { errorMessage } from '../../utils/text';

export function BlockSheet({ block, defaults, onClose }: { block?: Block; defaults?: { courtId?: string; date?: ISODate }; onClose: () => void }) {
  const toast = useToast();
  const settings = useSettings();
  const courts = useLiveQuery(() => db.courts.orderBy('order').toArray(), []) ?? [];
  const [courtIds, setCourtIds] = useState<string[]>(block?.courtIds ?? (defaults?.courtId ? [defaults.courtId] : []));
  const [dateStart, setDateStart] = useState<ISODate>(block?.dateStart ?? defaults?.date ?? todayISO());
  const [dateEnd, setDateEnd] = useState<ISODate>(block?.dateEnd ?? defaults?.date ?? todayISO());
  const [allDay, setAllDay] = useState(block ? block.startMin === undefined : false);
  const [startMin, setStartMin] = useState(block?.startMin ?? 16 * 60);
  const [endMin, setEndMin] = useState(block?.endMin ?? 18 * 60);
  const [reason, setReason] = useState(block?.reason ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const times = useMemo(() => Array.from({ length: 1440 / settings.slotMinutes + 1 }, (_, i) => i * settings.slotMinutes), [settings.slotMinutes]);

  // Reservas já marcadas que caem no bloqueio (aviso)
  const affected = useLiveQuery(async () => {
    if (!isISODate(dateStart) || !isISODate(dateEnd) || dateEnd < dateStart || !courtIds.length) return [];
    const list = await db.reservations.where('date').between(dateStart, dateEnd, true, true).toArray();
    return list.filter(
      (r) => reservationOccupies(r) && courtIds.includes(r.courtId) && (allDay || overlaps(r.startMin, r.endMin, startMin, endMin)),
    );
  }, [dateStart, dateEnd, courtIds.join(','), allDay, startMin, endMin]);

  async function handleSave() {
    const input: BlockInput = {
      id: block?.id,
      courtIds,
      dateStart,
      dateEnd,
      reason,
      ...(allDay ? {} : { startMin, endMin }),
    };
    setSaving(true);
    try {
      await saveBlock(input);
      toast.success(block ? 'Bloqueio atualizado.' : 'Horário bloqueado.');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet
        open={!confirmDelete}
        onClose={onClose}
        title={block ? 'Editar bloqueio' : 'Bloquear horário'}
        footer={
          <div className="flex gap-2">
            {block && (
              <Button variant="ghost" className="text-red-700" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden /> Excluir
              </Button>
            )}
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {affected && affected.length > 0 ? 'Bloquear mesmo assim' : 'Salvar bloqueio'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Quadras">
            <div className="flex flex-wrap gap-2">
              {courts.map((c) => (
                <Chip
                  key={c.id}
                  selected={courtIds.includes(c.id)}
                  onClick={() => setCourtIds((ids) => (ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                >
                  {c.name}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="De" htmlFor="bl-start">
              <Input
                id="bl-start"
                type="date"
                value={dateStart}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setDateStart(v);
                  if (dateEnd < v) setDateEnd(v);
                }}
              />
            </Field>
            <Field label="Até" htmlFor="bl-end">
              <Input id="bl-end" type="date" min={dateStart} value={dateEnd} onChange={(e) => e.target.value && setDateEnd(e.target.value)} />
            </Field>
          </div>
          <Switch id="bl-allday" label="Dia inteiro" checked={allDay} onChange={setAllDay} />
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Das" htmlFor="bl-from">
                <Select id="bl-from" value={startMin} onChange={(e) => setStartMin(Number(e.target.value))}>
                  {times.slice(0, -1).map((m) => (
                    <option key={m} value={m}>
                      {minToHHMM(m)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Até" htmlFor="bl-to" error={endMin <= startMin ? 'Deve ser depois do início.' : undefined}>
                <Select id="bl-to" value={endMin} onChange={(e) => setEndMin(Number(e.target.value))}>
                  {times.slice(1).map((m) => (
                    <option key={m} value={m}>
                      {minToHHMM(m)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <Field label="Motivo" htmlFor="bl-reason">
            <Input id="bl-reason" value={reason} placeholder="Ex.: Manutenção do piso" onChange={(e) => setReason(e.target.value)} />
          </Field>

          {affected && affected.length > 0 && (
            <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4" aria-hidden /> {affected.length} reserva(s) já marcada(s) neste período
              </p>
              <ul className="mt-1 list-disc pl-5">
                {affected.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    {formatDateBR(r.date)} {formatTimeRange(r.startMin, r.endMin)}
                  </li>
                ))}
              </ul>
              <p className="mt-1">Elas não são canceladas automaticamente. Avise os clientes e remarque pela agenda.</p>
            </div>
          )}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title="Excluir bloqueio?"
        confirmLabel="Excluir"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!block) return;
          await deleteBlock(block.id);
          toast.success('Bloqueio excluído. O horário voltou a ficar livre.');
          onClose();
        }}
      >
        <p>O horário volta a ficar disponível para reservas.</p>
      </ConfirmSheet>
    </>
  );
}
