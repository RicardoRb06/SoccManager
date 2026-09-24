import { lazy, Suspense, useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { ThemeSync } from './components/ThemeSync';
import { ToastProvider } from './components/ui/Toast';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { BackupBanner } from './features/mais/BackupBanner';
import { DemoBanner } from './features/demo/DemoBanner';
import { Tour } from './features/demo/Tour';
import { licenseService } from './license/LicenseService';
import { useSettingsState } from './db/hooks';
import tenant from './config/tenant.config';
import { matchPath, navigate, useHashPath } from './utils/router';
import AgendaPage from './features/agenda/AgendaPage';
import MensalistasPage from './features/mensalistas/MensalistasPage';
import ClientesPage from './features/clientes/ClientesPage';
import ClienteDetailPage from './features/clientes/ClienteDetailPage';

// Rotas pesadas carregadas sob demanda
const ResumoPage = lazy(() => import('./features/resumo/ResumoPage'));
const MaisPage = lazy(() => import('./features/mais/MaisPage'));
const BlocksPage = lazy(() => import('./features/mais/BlocksPage'));
const BackupPage = lazy(() => import('./features/mais/BackupPage'));
const TrashPage = lazy(() => import('./features/mais/TrashPage'));
const SettingsPage = lazy(() => import('./features/mais/settings/SettingsPage'));
const OnboardingPage = lazy(() => import('./features/onboarding/OnboardingPage'));
const ConditionsPage = lazy(() => import('./features/demo/ConditionsPage'));

function Routes({ path }: { path: string }) {
  const agenda = matchPath('/agenda/:date', path);
  if (agenda) return <AgendaPage date={agenda.date} />;
  if (path.startsWith('/mensalistas')) return <MensalistasPage />;
  const cliente = matchPath('/clientes/:id', path);
  if (cliente?.id) return <ClienteDetailPage id={cliente.id} />;
  if (path.startsWith('/clientes')) return <ClientesPage />;
  if (path.startsWith('/resumo')) return <ResumoPage />;
  if (path === '/mais/bloqueios') return <BlocksPage />;
  if (path === '/mais/backup') return <BackupPage />;
  if (path === '/mais/lixeira') return <TrashPage />;
  if (path.startsWith('/mais/configuracoes')) return <SettingsPage />;
  if (path === '/mais/condicoes' && licenseService.isDemo()) return <ConditionsPage />;
  if (path.startsWith('/mais')) return <MaisPage />;
  return <AgendaPage />;
}

export default function App() {
  const path = useHashPath();
  const { settings, loaded } = useSettingsState();
  const needsOnboarding = !tenant.demo && loaded && !settings.onboardingDone;

  useEffect(() => {
    if (path === '/' || path === '') navigate('/agenda', { replace: true });
  }, [path]);

  return (
    <ToastProvider>
      <ThemeSync />
      {!tenant.demo && !loaded ? (
        <p className="p-6 text-center text-slate-500">Carregando…</p>
      ) : needsOnboarding ? (
        <Suspense fallback={<p className="p-6 text-center text-slate-500">Carregando…</p>}>
          <OnboardingPage />
        </Suspense>
      ) : (
        <AppShell
          path={path}
          banner={
            <>
              {licenseService.isDemo() && <DemoBanner />}
              <BackupBanner />
            </>
          }
        >
          <Suspense fallback={<p className="p-6 text-center text-slate-500">Carregando…</p>}>
            <Routes path={path} />
          </Suspense>
        </AppShell>
      )}
      {licenseService.isDemo() && <Tour />}
      <UpdatePrompt />
    </ToastProvider>
  );
}
