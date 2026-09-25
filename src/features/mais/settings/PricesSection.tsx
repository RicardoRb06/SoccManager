/** Tabela de preços: regras por quadra × dias × faixa de horário, com pré-visualização. */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Pencil, Plus } from 'lucide-react';
import { db } from '../../../db/database';
import { useSettings } from '../../../db/hooks';
import { deletePriceRule, savePriceRule } from '../../../db/settingsRepo';
import type { PriceRule } from '../../../domain/types';
import { addDays, todayISO, WEEKDAY_SHORT, weekdayOf } from '../../../domain/dates';
import { minToHHMM } from '../../../domain/time';
import { formatBRL, formatBRLShort, parseBRL } from '../../../domain/money';
import { ALL_COURTS, priceFor } from '../../../domain/pricing';
import { Sheet } from '../../../components/ui/Sheet';
import { Button, Chip, Field, Input, Select } from '../../../components/ui/controls';
import { centsToInput } from '../../../components/PaymentSheets';
import { useToast } from '../../../components/ui/Toast';
import { errorMessage } from '../../../utils/text';

/** "Seg a Sex", "Sáb e Dom", "Todos os dias", "Seg, Qua, Sex" */
export function weekdaysLabel(days: number[]): string {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return 'Todos os dias';
  if (set.join() === '1,2,3,4,5') return 'Seg a Sex';
  if (set.join() === '0,6') return 'Sáb e Dom';
  return set.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

function RuleSheet({ rule, courts, defaultCourt, onClose }: { rule?: PriceRule; courts: Array<{ id: string; name: string }>; defaultCourt: string; onClose: () => void }) {
  const toast = useToast();
  const settings = useSettings();
  const [courtId, setCourtId] = useState(rule?.courtId ?? defaultCourt);
  const [days, setDays] = useState<number[]>(rule?.weekdays ?? [1, 2, 3, 4, 5]);
  const [start, setStart] = useState(rule?.startMin ?? 18 * 60);
  const [end, setEnd] = useState(rule?.endMin ?? 24 * 60);
  const [priceText, setPriceText] = useState(rule ? centsToInput(rule.price) : '');
  const step = settings.slotMinutes;
  const times = Array.from({ length: 1440 / step + 1 }, (_, i) => i * step);
  const price = parseBRL(priceText);

  async function save() {
    if (price === null) return toast.error('Informe o preço por hora.');
    try {
      await savePriceRule({ id: rule?.id, courtId, weekdays: days, startMin: start, endMin: end, price });
      toast.success('Preço salvo.');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={rule ? 'Editar preço' : 'Novo preço'}
      footer={
        <div className="flex gap-2">
          {rule && (
            <Button
              variant="ghost"
              className="text-danger"
              onClick={() =>
                void deletePriceRule(rule.id).then(() => {
                  toast.success('Preço removido.');
                  onClose();
                })
              }
            >
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
        <Field label="Quadra" htmlFor="pr-court">
          <Select id="pr-court" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            <option value={ALL_COURTS}>Todas as quadras (padrão)</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dias da semana">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <Chip key={d} className="px-3" selected={days.includes(d)} onClick={() => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]))}>
                {WEEKDAY_SHORT[d]}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <button type="button" className="font-medium text-brand" onClick={() => setDays([1, 2, 3, 4, 5])}>
              Seg a Sex
            </button>
            <button type="button" className="font-medium text-brand" onClick={() => setDays([0, 6])}>
              Fim de semana
            </button>
            <button type="button" className="font-medium text-brand" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>
              Todos
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Das" htmlFor="pr-start">
            <Select id="pr-start" value={start} onChange={(e) => setStart(Number(e.target.value))}>
              {times.slice(0, -1).map((m) => (
                <option key={m} value={m}>
                  {minToHHMM(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Até" htmlFor="pr-end" error={end <= start ? 'Deve ser depois do início.' : undefined}>
            <Select id="pr-end" value={end} onChange={(e) => setEnd(Number(e.target.value))}>
              {times.slice(1).map((m) => (
                <option key={m} value={m}>
                  {minToHHMM(m)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Preço por hora" htmlFor="pr-price" hint="Reservas que cruzam faixas somam cada trecho proporcionalmente.">
          <Input id="pr-price" inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="Ex.: 120,00" />
        </Field>
      </div>
    </Sheet>
  );
}

export function PricesSection() {
  const settings = useSettings();
  const data = useLiveQuery(async () => ({ courts: await db.courts.orderBy('order').toArray(), rules: await db.priceRules.toArray() }), []);
  const [editing, setEditing] = useState<PriceRule | 'new' | null>(null);
  const [previewDay, setPreviewDay] = useState(() => weekdayOf(todayISO()));
  const courts = (data?.courts ?? []).filter((c) => c.active);
  const courtName = (id: string) => (id === ALL_COURTS ? 'Todas as quadras' : (data?.courts.find((c) => c.id === id)?.name ?? 'Quadra removida'));

  const sortedRules = useMemo(
    () =>
      [...(data?.rules ?? [])].sort((a, b) =>
        a.courtId === b.courtId ? Math.min(...a.weekdays) - Math.min(...b.weekdays) || a.startMin - b.startMin : courtName(a.courtId).localeCompare(courtName(b.courtId)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  // pré-visualização: próxima data com o dia escolhido
  const sampleDate = useMemo(() => {
    const t = todayISO();
    return addDays(t, (previewDay - weekdayOf(t) + 7) % 7);
  }, [previewDay]);
  const h = settings.openingHours[previewDay];
  const hoursList = h ? Array.from({ length: Math.ceil((h.close - h.open) / 60) }, (_, i) => h.open + i * 60) : [];

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card shadow-xs">
        {sortedRules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{courtName(r.courtId)}</p>
              <p className="text-xs text-muted-foreground">
                {weekdaysLabel(r.weekdays)} · {minToHHMM(r.startMin)}–{minToHHMM(r.endMin)}
              </p>
            </div>
            <span className="font-semibold tabular-nums">{formatBRL(r.price)}/h</span>
            <button type="button" aria-label="Editar preço" className="grid size-10 place-items-center rounded-full hover:bg-accent" onClick={() => setEditing(r)}>
              <Pencil className="size-4" aria-hidden />
            </button>
          </li>
        ))}
        {data && sortedRules.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nenhum preço cadastrado. Os horários vão aparecer como R$ 0.</li>}
      </ul>
      <Button variant="outline" onClick={() => setEditing('new')}>
        <Plus className="size-4" aria-hidden /> Adicionar preço
      </Button>
      <p className="text-xs text-muted-foreground">Regra de uma quadra específica vale mais que a regra de “Todas as quadras”.</p>

      <section className="rounded-xl border bg-card shadow-xs p-3">
        <h3 className="mb-2 font-semibold">Pré-visualização (preço de 1 hora)</h3>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Chip key={d} className="px-3" selected={previewDay === d} onClick={() => setPreviewDay(d)}>
              {WEEKDAY_SHORT[d]}
            </Chip>
          ))}
        </div>
        {!h ? (
          <p className="text-sm text-muted-foreground">Fechado neste dia.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-2 font-semibold">Horário</th>
                  {courts.map((c) => (
                    <th key={c.id} className="py-1 pr-2 text-right font-semibold">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hoursList.map((start) => (
                  <tr key={start}>
                    <td className="py-1 pr-2 tabular-nums text-muted-foreground">{minToHHMM(start)}</td>
                    {courts.map((c) => {
                      const p = priceFor(data?.rules ?? [], c.id, sampleDate, start, Math.min(start + 60, h.close));
                      return (
                        <td key={c.id} className={`py-1 pr-2 text-right tabular-nums ${p === 0 ? 'text-warning' : ''}`}>
                          {p === 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="size-3.5" aria-hidden /> sem preço
                            </span>
                          ) : (
                            formatBRLShort(p)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <RuleSheet
          rule={editing === 'new' ? undefined : editing}
          courts={courts}
          defaultCourt={courts[0]?.id ?? ALL_COURTS}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
