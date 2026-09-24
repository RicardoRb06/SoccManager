/** Toasts de feedback imediato após cada ação. */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, opts?: { kind?: ToastKind; action?: ToastItem['action']; durationMs?: number }) => void;
  success: (message: string, action?: ToastItem['action']) => void;
  error: (message: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, kind: opts.kind ?? 'info', message, action: opts.action }]);
      window.setTimeout(() => dismiss(id), opts.durationMs ?? (opts.action ? 6000 : 3500));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, action) => show(m, { kind: 'success', action }),
      error: (m) => show(m, { kind: 'error', durationMs: 6000 }),
    }),
    [show],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="above-nav no-print pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3"
      >
        {items.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl lg:mb-2"
            >
              <Icon className={`size-5 shrink-0 ${t.kind === 'success' ? 'text-green-400' : t.kind === 'error' ? 'text-red-400' : 'text-sky-300'}`} aria-hidden />
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="min-h-9 rounded-lg px-2 font-semibold text-amber-300"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useToast fora do ToastProvider');
  return api;
}
