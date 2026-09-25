/**
 * shadcn/ui NativeSelect: o seletor nativo do sistema, estilizado.
 * No celular abre a roda/lista do próprio aparelho, que é o mais familiar para quem usa.
 */
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div data-slot="native-select-wrapper" className="relative w-full">
      <select
        data-slot="native-select"
        className={cn(
          'h-10 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-1 pl-3 pr-9 text-base text-foreground shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}
