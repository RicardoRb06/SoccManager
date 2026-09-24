/** Lista de clientes: busca, filtros e badges de débito/faltas. Tabela no desktop. */
import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Repeat, Search, UserX } from 'lucide-react';
import { PageHeader } from '../../components/AppShell';
import { Chip, Input } from '../../components/ui/controls';
import { formatBRL } from '../../domain/money';
import { formatDateBR } from '../../domain/dates';
import { formatPhone } from '../../domain/whatsapp';
import { matchesCustomer } from '../../utils/text';
import { navigate } from '../../utils/router';
import { useCustomerSummaries, type CustomerSummary } from './useCustomerSummaries';
import { CustomerSheet } from './CustomerSheet';

type Filter = 'todos' | 'devendo' | 'faltas' | 'mensalistas';

function Badges({ s, align = 'end' }: { s: CustomerSummary; align?: 'start' | 'end' }) {
  return (
    <span className={`flex flex-wrap gap-1 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {s.debt > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Devendo {formatBRL(s.debt)}</span>}
      {s.stats.faltas > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
          <UserX className="size-3" aria-hidden /> {s.stats.faltas} {s.stats.faltas === 1 ? 'falta' : 'faltas'}
        </span>
      )}
      {s.isMensalista && (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
          <Repeat className="size-3" aria-hidden /> Mensalista
        </span>
      )}
    </span>
  );
}

export default function ClientesPage() {
  const data = useCustomerSummaries();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    if (!data) return [];
    return data.list
      .filter((s) => !s.customer.deletedAt)
      .filter((s) => matchesCustomer(query, s.customer.name, s.customer.phone))
      .filter((s) => (filter === 'devendo' ? s.debt > 0 : filter === 'faltas' ? s.stats.faltas > 0 : filter === 'mensalistas' ? s.isMensalista : true))
      .sort((a, b) => (filter === 'devendo' ? b.debt - a.debt : a.customer.name.localeCompare(b.customer.name, 'pt-BR')));
  }, [data, query, filter]);

  const totalDebt = data?.list.filter((s) => !s.customer.deletedAt).reduce((a, s) => a + s.debt, 0) ?? 0;
  const active = data?.list.filter((s) => !s.customer.deletedAt).length ?? 0;

  return (
    <>
      <PageHeader title="Clientes" subtitle={data ? `${active} clientes · ${formatBRL(totalDebt)} a receber` : undefined} />
      <div className="flex flex-col gap-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input type="search" aria-label="Buscar cliente" placeholder="Buscar por nome ou telefone" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtro">
          {(
            [
              ['todos', 'Todos'],
              ['devendo', 'Devendo'],
              ['faltas', 'Com faltas'],
              ['mensalistas', 'Mensalistas'],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} selected={filter === k} onClick={() => setFilter(k)} className="shrink-0">
              {label}
            </Chip>
          ))}
        </div>

        {!data ? (
          <p className="py-10 text-center text-slate-500">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            {query || filter !== 'todos' ? 'Nenhum cliente encontrado com esse filtro.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
        ) : (
          <>
            {/* Celular: cards */}
            <ul className="flex flex-col gap-2 lg:hidden">
              {list.map((s) => (
                <li key={s.customer.id}>
                  <a href={`#/clientes/${s.customer.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{s.customer.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{s.customer.phone ? formatPhone(s.customer.phone) : 'Sem telefone'}</span>
                      </span>
                      {(s.debt > 0 || s.stats.faltas > 0 || s.isMensalista) && (
                        <span className="mt-1 block">
                          <Badges s={s} align="start" />
                        </span>
                      )}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
            {/* Desktop: tabela */}
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Telefone</th>
                    <th className="px-4 py-3 text-right font-semibold">Jogos</th>
                    <th className="px-4 py-3 text-right font-semibold">Total pago</th>
                    <th className="px-4 py-3 font-semibold">Último jogo</th>
                    <th className="px-4 py-3 text-right font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((s) => (
                    <tr key={s.customer.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/clientes/${s.customer.id}`)}>
                      <td className="px-4 py-3 font-semibold">
                        <a href={`#/clientes/${s.customer.id}`}>{s.customer.name}</a>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.customer.phone ? formatPhone(s.customer.phone) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.stats.games}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatBRL(s.stats.totalPaid)}</td>
                      <td className="px-4 py-3 text-slate-600">{s.stats.lastGame ? formatDateBR(s.stats.lastGame) : '—'}</td>
                      <td className="px-4 py-3">
                        <Badges s={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="fab-bottom no-print fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-white shadow-lg hover:bg-brand-strong lg:right-8"
      >
        <Plus className="size-5" aria-hidden /> Novo cliente
      </button>
      {creating && <CustomerSheet onClose={() => setCreating(false)} onCreated={(c) => navigate(`/clientes/${c.id}`)} />}
    </>
  );
}
