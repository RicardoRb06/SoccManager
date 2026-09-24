import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { bootstrapDatabase } from './db/bootstrap';

const rootEl = document.getElementById('root')!;
const root = createRoot(rootEl);

function Fatal({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="mb-2 text-lg font-bold">Não foi possível abrir os dados</h1>
      <p className="mb-4 text-sm text-slate-600">{message}</p>
      <p className="text-sm text-slate-600">
        Verifique se o navegador não está em aba anônima e se há espaço livre no aparelho. Seus dados não foram apagados.
      </p>
      <button type="button" className="mt-4 min-h-11 rounded-xl bg-brand px-5 font-semibold text-white" onClick={() => location.reload()}>
        Tentar de novo
      </button>
    </div>
  );
}

bootstrapDatabase()
  .then(() => {
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
