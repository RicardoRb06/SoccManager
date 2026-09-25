/** Mais › Lixeira: reservas e clientes excluídos, com restauração. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/AppShell';
import { Button, Chip } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { db } from '../../db/database';
import { ConflictError, restoreCustomer, restoreReservation } from '../../db/repo';
import { formatDateBR } from '../../domain/dates';
import { formatTimeRange } from '../../domain/time';
import { formatBRL } from '../../domain/money';

export default function TrashPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'reservas' | 'clientes'>('reservas');
  const data = useLiveQuery(async () => {
    const [reservations, customers, courts, allCustomers] = await Promise.all([
      db.reservations.filter((r) => !!r.deletedAt).toArray(),
      db.customers.filter((c) => !!c.deletedAt).toArray(),
      db.courts.toArray(),
      db.customers.toArray(),
    ]);
    const byDeleted = <T extends { deletedAt?: string }>(xs: T[]) => xs.sort((a, b) => ((a.deletedAt ?? '') < (b.deletedAt ?? '') ? 1 : -1));
    return {
      reservations: byDeleted(reservations),
      customers: byDeleted(customers),
      courts: new Map(courts.map((c) => [c.id, c.name])),
      names: new Map(allCustomers.map((c) => [c.id, c.name])),
    };
  }, []);

  async function run(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof ConflictError ? 'Não dá para restaurar: o horário já foi ocupado por outra reserva.' : err instanceof Error ? err.message : 'Não foi possível restaurar.');
    }
  }

  return (
    <>
      <PageHeader
        title="Lixeira"
        subtitle="Itens excluídos podem ser restaurados"
        actions={
          <a href="#/mais" className="grid size-11 place-items-center rounded-full hover:bg-accent" aria-label="Voltar para Mais">
            <ChevronLeft className="size-5" aria-hidden />
          </a>
        }
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
        <div className="flex gap-2" role="group" aria-label="Tipo">
          <Chip selected={tab === 'reservas'} onClick={() => setTab('reservas')}>
            Reservas ({data?.reservations.length ?? 0})
          </Chip>
          <Chip selected={tab === 'clientes'} onClick={() => setTab('clientes')}>
            Clientes ({data?.customers.length ?? 0})
          </Chip>
        </div>

        {!data ? (
          <p className="py-8 text-center text-muted-foreground">Carregando…</p>
        ) : (tab === 'reservas' ? data.reservations.length : data.customers.length) === 0 ? (
          <div className="rounded-2xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">
            <Trash2 className="mx-auto mb-2 size-8 text-muted-foreground/50" aria-hidden />A lixeira está vazia.
          </div>
        ) : tab === 'reservas' ? (
          <ul className="flex flex-col gap-2">
            {data.reservations.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border bg-card shadow-xs p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{data.names.get(r.customerId) ?? 'Cliente'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateBR(r.date)} · {formatTimeRange(r.startMin, r.endMin)} · {data.courts.get(r.courtId)} · {formatBRL(r.price)}
                  </p>
                  <p className="text-xs text-muted-foreground/70">Excluída em {r.deletedAt ? new Date(r.deletedAt).toLocaleString('pt-BR') : ''}</p>
                </div>
                <Button variant="outline" className="shrink-0 px-3" onClick={() => run(() => restoreReservation(r.id), 'Reserva restaurada.')}>
                  <RotateCcw className="size-4" aria-hidden /> Restaurar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.customers.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border bg-card shadow-xs p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground/70">Excluído em {c.deletedAt ? new Date(c.deletedAt).toLocaleString('pt-BR') : ''}</p>
                </div>
                <Button variant="outline" className="shrink-0 px-3" onClick={() => run(() => restoreCustomer(c.id), 'Cliente restaurado.')}>
                  <RotateCcw className="size-4" aria-hidden /> Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Itens na lixeira não aparecem na agenda nem nos relatórios, mas continuam no backup.</p>
      </div>
    </>
  );
}
