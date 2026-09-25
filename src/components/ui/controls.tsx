/**
 * Controles do app montados sobre os componentes shadcn/ui.
 * Alvos de toque ≥ 44px em tudo que se toca.
 */
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';
import { NativeSelect } from './native-select';
import { Switch as SwitchPrimitive } from './switch';

export { Button, buttonVariants } from './button';
export { Input } from './input';
export { Textarea } from './textarea';

/** Seletor nativo (no celular abre a lista do próprio aparelho). */
export function Select(props: ComponentProps<'select'>) {
  return <NativeSelect {...props} />;
}

/** Opção em forma de pílula (duração, dias da semana, filtros). Selecionada = cor da quadra. */
export function Chip({ selected, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-state={selected ? 'on' : 'off'}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground hover:bg-accent',
        className,
      )}
      {...props}
    />
  );
}

/** Rótulo + campo + dica/erro. */
export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Linha com texto à esquerda e chave (switch) à direita; a linha toda é clicável. */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id?: string }) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <Label htmlFor={sid} className="flex-1 cursor-pointer py-2">
        {label}
      </Label>
      <SwitchPrimitive id={sid} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
