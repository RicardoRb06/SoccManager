/** Busca de cliente com autocomplete e cadastro rápido inline. */
import { useId, useMemo, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { Customer } from '../../domain/types';
import { formatPhone } from '../../domain/whatsapp';
import { matchesCustomer } from '../../utils/text';
import { Input } from '../../components/ui/controls';

export type CustomerChoice =
  | { kind: 'none' }
  | { kind: 'existing'; id: string }
  | { kind: 'new'; name: string; phone: string };

export function CustomerPicker({
  customers,
  value,
  onChange,
  error,
}: {
  customers: Customer[];
  value: CustomerChoice;
  onChange: (v: CustomerChoice) => void;
  error?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const active = useMemo(() => customers.filter((c) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [customers]);
  const matches = useMemo(() => active.filter((c) => matchesCustomer(query, c.name, c.phone)).slice(0, 6), [active, query]);

  if (value.kind === 'existing') {
    const c = customers.find((x) => x.id === value.id);
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c?.name ?? 'Cliente removido'}</p>
          {c?.phone && <p className="text-xs text-slate-500">{formatPhone(c.phone)}</p>}
        </div>
        <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-brand" onClick={() => onChange({ kind: 'none' })}>
          Trocar
        </button>
      </div>
    );
  }

  if (value.kind === 'new') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-brand/40 bg-brand-soft p-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-strong">
            <UserPlus className="size-4" aria-hidden /> Novo cliente
          </p>
          <button type="button" aria-label="Cancelar cadastro" className="grid size-9 place-items-center rounded-full hover:bg-white/60" onClick={() => onChange({ kind: 'none' })}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <Input aria-label="Nome do cliente" placeholder="Nome" value={value.name} autoComplete="off" onChange={(e) => onChange({ ...value, name: e.target.value })} />
        <Input
          aria-label="Telefone (WhatsApp)"
          placeholder="Telefone (WhatsApp)"
          inputMode="tel"
          autoComplete="off"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
        />
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    );
  }

  const showList = focused || query.length > 0;
  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-label="Buscar cliente por nome ou telefone"
        placeholder="Buscar por nome ou telefone"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
      />
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      {showList && (
        <ul id={`${id}-list`} role="listbox" className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ kind: 'existing', id: c.id });
                  setQuery('');
                }}
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatPhone(c.phone)}</span>
              </button>
            </li>
          ))}
          <li role="option" aria-selected={false}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left font-semibold text-brand hover:bg-brand-soft"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const digits = query.replace(/\D/g, '');
                const looksPhone = digits.length >= 8 && digits.length === query.replace(/[\s()+-]/g, '').length;
                onChange({ kind: 'new', name: looksPhone ? '' : query.trim(), phone: looksPhone ? query.trim() : '' });
                setQuery('');
              }}
            >
              <UserPlus className="size-4" aria-hidden />
              {query.trim() ? `Cadastrar "${query.trim()}"` : 'Cadastrar novo cliente'}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
