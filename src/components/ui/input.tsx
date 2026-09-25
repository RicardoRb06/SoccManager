/** shadcn/ui Input (altura 44px e fonte 16px para o celular não dar zoom ao focar). */
import * as React from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'flex h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-base text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />;
}
