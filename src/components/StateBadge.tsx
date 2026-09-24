/**
 * Estado visual de um horário. Sempre cor + ícone + texto (nunca só cor).
 */
import { Ban, CircleDashed, CircleDollarSign, CircleCheck, Clock, Lock, Repeat, UserX, type LucideIcon } from 'lucide-react';

export type VisualState =
  | 'livre'
  | 'pendente'
  | 'sinal'
  | 'pago'
  | 'falta'
  | 'bloqueado'
  | 'mensal_ok'
  | 'mensal_devendo'
  | 'outra_quadra';

interface StateStyle {
  label: string;
  icon: LucideIcon;
  /** fundo/borda da linha */
  row: string;
  /** badge */
  badge: string;
}

export const STATE_STYLES: Record<VisualState, StateStyle> = {
  livre: { label: 'Livre', icon: CircleDashed, row: 'border-dashed border-slate-300 bg-white', badge: 'bg-slate-100 text-slate-600' },
  pendente: { label: 'Pendente', icon: Clock, row: 'border-amber-300 bg-amber-50', badge: 'bg-amber-100 text-amber-800' },
  sinal: { label: 'Sinal', icon: CircleDollarSign, row: 'border-blue-300 bg-blue-50', badge: 'bg-blue-100 text-blue-800' },
  pago: { label: 'Pago', icon: CircleCheck, row: 'border-green-300 bg-green-50', badge: 'bg-green-100 text-green-800' },
  falta: { label: 'Falta', icon: UserX, row: 'hatch-red border-red-300', badge: 'bg-red-100 text-red-800' },
  bloqueado: { label: 'Bloqueado', icon: Lock, row: 'hatch-gray border-slate-300', badge: 'bg-slate-200 text-slate-700' },
  mensal_ok: { label: 'Em dia', icon: Repeat, row: 'border-green-300 bg-green-50', badge: 'bg-green-100 text-green-800' },
  mensal_devendo: { label: 'Devendo', icon: Repeat, row: 'border-amber-300 bg-amber-50', badge: 'bg-amber-100 text-amber-800' },
  outra_quadra: { label: 'Espaço em uso', icon: Ban, row: 'hatch-gray border-slate-300', badge: 'bg-slate-200 text-slate-700' },
};

export function StateBadge({ state, className = '' }: { state: VisualState; className?: string }) {
  const s = STATE_STYLES[state];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${s.badge} ${className}`}>
      <Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  );
}
