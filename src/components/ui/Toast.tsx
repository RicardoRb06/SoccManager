/**
 * Feedback imediato após cada ação, com os toasts do shadcn/ui (Sonner).
 * Mantém a API do app: toast.success / toast.error / toast.show (com ação "Desfazer").
 */
import { useMemo, type ReactNode } from 'react';
import { toast as sonner } from 'sonner';
import { Toaster } from './sonner';

type ToastKind = 'success' | 'error' | 'info';
interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastApi {
  show: (message: string, opts?: { kind?: ToastKind; action?: ToastAction; durationMs?: number }) => void;
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
}

const api: ToastApi = {
  show(message, opts = {}) {
    const fn = opts.kind === 'success' ? sonner.success : opts.kind === 'error' ? sonner.error : sonner.info;
    fn(message, {
      duration: opts.durationMs ?? (opts.action ? 6000 : 3500),
      action: opts.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined,
    });
  },
  success: (m, action) => api.show(m, { kind: 'success', action }),
  error: (m) => api.show(m, { kind: 'error', durationMs: 6000 }),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-center" richColors closeButton={false} visibleToasts={3} offset={{ bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)' }} mobileOffset={{ bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)' }} className="no-print" />
    </>
  );
}

export function useToast(): ToastApi {
  return useMemo(() => api, []);
}
