/**
 * Layout: barra inferior com 5 abas no celular; barra lateral no desktop (≥1024px).
 */
import type { ReactNode } from 'react';
import { BarChart3, CalendarDays, Menu, Repeat, Users } from 'lucide-react';
import { useSettings } from '../db/hooks';
import { licenseService } from '../license/LicenseService';

export const TABS = [
  { path: '/agenda', label: 'Agenda', icon: CalendarDays },
  { path: '/mensalistas', label: 'Mensalistas', icon: Repeat },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/resumo', label: 'Resumo', icon: BarChart3 },
  { path: '/mais', label: 'Mais', icon: Menu },
] as const;

function isActive(tabPath: string, current: string) {
  return current === tabPath || current.startsWith(`${tabPath}/`);
}

export function CourtBadge({ size = 36 }: { size?: number }) {
  const s = useSettings();
  if (s.logo) return <img src={s.logo} alt="" width={size} height={size} className="rounded-xl object-cover" style={{ width: size, height: size }} />;
  const initials = s.shortName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-xl bg-primary font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}

export function AppShell({ path, children, banner }: { path: string; children: ReactNode; banner?: ReactNode }) {
  const s = useSettings();
  const license = licenseService.getStatus();
  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <CourtBadge size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{s.courtName}</p>
            <p className="text-xs text-muted-foreground">{license.mode === 'demo' ? 'Versão de demonstração' : `Licenciado para ${license.licensedTo}`}</p>
          </div>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {TABS.map(({ path: p, label, icon: Icon }) => {
            const active = isActive(p, path);
            return (
              <a
                key={p}
                href={`#${p}`}
                data-tour={`tab-${p.slice(1)}`}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-xl px-3 font-medium ${active ? 'bg-brand-soft text-brand-strong' : 'text-muted-foreground hover:bg-accent'}`}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {banner}
        <main className="pb-nav mx-auto w-full max-w-3xl lg:max-w-6xl" style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}>
          {children}
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav
        aria-label="Principal"
        className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5" style={{ height: 'var(--nav-height)' }}>
          {TABS.map(({ path: p, label, icon: Icon }) => {
            const active = isActive(p, path);
            return (
              <li key={p}>
                <a
                  href={`#${p}`}
                  data-tour={`tab-${p.slice(1)}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-brand' : 'text-muted-foreground'}`}
                >
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Cabeçalho padrão de página. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex min-h-14 items-center gap-3 px-4 py-2">
        <div className="lg:hidden">
          <CourtBadge size={32} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}

/** Placeholder das telas ainda não implementadas neste marco. */
export function ComingSoon({ milestone, children }: { milestone: number; children?: ReactNode }) {
  return (
    <div className="m-4 rounded-2xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">
      <p className="font-medium">Esta tela chega no marco {milestone}.</p>
      {children}
    </div>
  );
}
