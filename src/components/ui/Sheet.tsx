/**
 * Painel do app (padrão "responsive dialog" do shadcn/ui):
 *  - celular: Drawer (vaul) que sobe de baixo e fecha arrastando para baixo;
 *  - desktop (≥1024px): Dialog centralizado.
 * Fecha com Esc, toque fora ou X, trava a rolagem do fundo e devolve o foco ao sair.
 * Ao abrir, foca o painel (não o primeiro campo), para não abrir o teclado sem querer.
 */
import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsDesktop } from '@/utils/hooks';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from './drawer';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Rodapé fixo (botões de ação) */
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

export function Sheet({ open, onClose, title, children, footer, size = 'md' }: SheetProps) {
  const desktop = useIsDesktop();
  const bodyRef = useRef<HTMLDivElement>(null);
  const onOpenChange = (o: boolean) => {
    if (!o) onClose();
  };
  const focusPanel = (e: Event) => {
    e.preventDefault();
    bodyRef.current?.focus();
  };

  const body = (
    <>
      <div ref={bodyRef} tabIndex={-1} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 outline-none lg:px-6">
        {children}
      </div>
      {footer && <div className="pb-safe border-t px-4 py-3 lg:px-6">{footer}</div>}
    </>
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          onOpenAutoFocus={focusPanel}
          className={cn('flex max-h-[88dvh] flex-col gap-0 p-0', size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
        >
          <div className="flex min-h-16 items-center py-3 pl-6 pr-16">
            <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
          </div>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent aria-describedby={undefined} onOpenAutoFocus={focusPanel}>
        <div className="flex items-center gap-2 px-4 pb-2 pt-2">
          <DrawerTitle className="flex-1 text-lg font-semibold tracking-tight">{title}</DrawerTitle>
          <DrawerClose aria-label="Fechar" className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="size-5" aria-hidden />
          </DrawerClose>
        </div>
        {body}
      </DrawerContent>
    </Drawer>
  );
}
