/** shadcn/ui Sonner (toasts), seguindo o tema claro/escuro do app. */
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useResolvedTheme } from '@/utils/theme';

export function Toaster(props: ToasterProps) {
  const theme = useResolvedTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
      {...props}
    />
  );
}
