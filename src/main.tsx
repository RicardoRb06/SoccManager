import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonte Geist do design system, empacotada no app (funciona offline, sem Google Fonts)
import '@fontsource-variable/geist';
import './styles.css';
import App from './App';
import { bootstrapDatabase } from './db/bootstrap';
import { dailySnapshot } from './db/backup';
import { requestPersistence } from './db/storage';
import { db } from './db/database';
import { todayISO } from './domain/dates';
import { listenForInstall } from './pwa/install';

// O navegador avisa cedo que o app pode ser instalado: guarda o aviso para o item "Instalar app"
listenForInstall();

const rootEl = document.getElementById('root')!;
const root = createRoot(rootEl);

function Fatal({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="mb-2 text-lg font-semibold tracking-tight">Não foi possível abrir os dados</h1>
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">
        Verifique se o navegador não está em aba anônima e se há espaço livre no aparelho. Seus dados não foram apagados.
      </p>
      <button type="button" className="mt-4 min-h-10 rounded-xl bg-primary px-5 font-semibold text-white" onClick={() => location.reload()}>
        Tentar de novo
      </button>
    </div>
  );
}

/** Tarefas de proteção de dados que não podem atrasar a abertura do app. */
async function protectData() {
  try {
    await dailySnapshot(todayISO());
  } catch (err) {
    console.warn('Não foi possível criar a cópia interna do dia', err);
  }
  // Primeiro uso relevante: pede para o navegador não apagar os dados sozinho
  const asked = await db.settings.get('persistRequested');
  if (!asked?.value) {
    await requestPersistence();
    await db.settings.put({ key: 'persistRequested', value: true });
  }
}

bootstrapDatabase()
  .then(() => {
    void protectData();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err: unknown) => {
    console.error(err);
    root.render(<Fatal message={err instanceof Error ? err.message : String(err)} />);
  });
