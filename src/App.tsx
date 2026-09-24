import { lazy, Suspense, useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { ThemeSync } from './components/ThemeSync';
import { ToastProvider } from './components/ui/Toast';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { matchPath, navigate, useHashPath } from './utils/router';
import AgendaPage from './features/agenda/AgendaPage';
import { MensalistasPage } from './features/placeholders';
import ClientesPage from './features/clientes/ClientesPage';
import ClienteDetailPage from './features/clientes/ClienteDetailPage';

// Rotas pesadas carregadas sob demanda
const ResumoPage = lazy(() => import('./features/resumo/ResumoPage'));
const MaisPage = lazy(() => import('./features/mais/MaisPage'));
const BlocksPage = lazy(() => import('./features/mais/BlocksPage'));

function Routes({ path }: { path: string }) {
  const agenda = matchPath('/agenda/:date', path);
  if (agenda) return <AgendaPage date={agenda.date} />;
  if (path.startsWith('/mensalistas')) return <MensalistasPage />;
  const cliente = matchPath('/clientes/:id', path);
  if (cliente?.id) return <ClienteDetailPage id={cliente.id} />;
  if (path.startsWith('/clientes')) return <ClientesPage />;
  if (path.startsWith('/resumo')) return <ResumoPage />;
  if (path === '/mais/bloqueios') return <BlocksPage />;
  if (path.startsWith('/mais')) return <MaisPage />;
  return <AgendaPage />;
}

export default function App() {
  const path = useHashPath();

  useEffect(() => {
    if (path === '/' || path === '') navigate('/agenda', { replace: true });
  }, [path]);

  return (
    <ToastProvider>
      <ThemeSync />
      <AppShell path={path}>
        <Suspense fallback={<p className="p-6 text-center text-slate-500">Carregando…</p>}>
          <Routes path={path} />
        </Suspense>
      </AppShell>
      <UpdatePrompt />
    </ToastProvider>
  );
}
