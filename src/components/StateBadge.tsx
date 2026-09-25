/**
 * Estado visual de um horário. Sempre cor + ícone + texto (nunca só cor).
 */
import { Ban, CircleDashed, CircleDollarSign, CircleCheck, Clock, Lock, Repeat, UserX, type LucideIcon } from 'lucide-react';
import { Badge } from './ui/badge';

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

type BadgeVariant = 'success' | 'warning' | 'info' | 'danger' | 'muted';

interface StateStyle {
  label: string;
  icon: LucideIcon;
  /** fundo/borda da linha */
  row: string;
  /** cor do badge (variante do shadcn Badge) */
  variant: BadgeVariant;
}

export const STATE_STYLES: Record<VisualState, StateStyle> = {
  livre: { label: 'Livre', icon: CircleDashed, row: 'border-dashed border-input bg-card', variant: 'muted' },
  pendente: { label: 'Pendente', icon: Clock, row: 'border-warning-border bg-warning-soft', variant: 'warning' },
  sinal: { label: 'Sinal', icon: CircleDollarSign, row: 'border-info-border bg-info-soft', variant: 'info' },
  pago: { label: 'Pago', icon: CircleCheck, row: 'border-success-border bg-success-soft', variant: 'success' },
  falta: { label: 'Falta', icon: UserX, row: 'hatch-red border-danger-border', variant: 'danger' },
  bloqueado: { label: 'Bloqueado', icon: Lock, row: 'hatch-gray border-input', variant: 'muted' },
  mensal_ok: { label: 'Em dia', icon: Repeat, row: 'border-success-border bg-success-soft', variant: 'success' },
  mensal_devendo: { label: 'Devendo', icon: Repeat, row: 'border-warning-border bg-warning-soft', variant: 'warning' },
  outra_quadra: { label: 'Espaço em uso', icon: Ban, row: 'hatch-gray border-input', variant: 'muted' },
};

export function StateBadge({ state, className = '' }: { state: VisualState; className?: string }) {
  const s = STATE_STYLES[state];
  const Icon = s.icon;
  return (
    <Badge variant={s.variant} className={className}>
      <Icon aria-hidden />
      {s.label}
    </Badge>
  );
}
