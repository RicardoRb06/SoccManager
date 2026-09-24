/**
 * Migrações de DADOS (formato lógico), usadas ao importar backups de versões anteriores.
 * O esquema físico do IndexedDB é migrado pelo Dexie (db/database.ts, db.version(n)).
 *
 * Para cada nova versão do formato:
 *   1. aumente SCHEMA_VERSION em db/fromTenant.ts;
 *   2. adicione aqui `migrations[<versão anterior>] = (data) => dataNaNovaVersão`.
 * Um backup na versão N passa por migrations[N], migrations[N+1], ... até a atual.
 */
import { SCHEMA_VERSION } from './fromTenant';

export type RawData = Record<string, unknown>;
export type Migration = (data: RawData) => RawData;

/** Chave = versão DE ORIGEM. */
export const migrations: Record<number, Migration> = {
  // Versão 0 = protótipos antigos sem `skipDates`/`priceManual`. Mantido como exemplo e teste.
  0: (data) => {
    const recurrences = Array.isArray(data.recurrences) ? data.recurrences : [];
    return {
      ...data,
      recurrences: recurrences.map((r) => ({ skipDates: [], ...(r as object) })),
    };
  },
};

export function migrateData(data: RawData, fromVersion: number): RawData {
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(`Este backup foi criado por uma versão mais nova do app (formato ${fromVersion}). Atualize o app antes de importar.`);
  }
  let cur = data;
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const m = migrations[v];
    if (!m) throw new Error(`Não há migração do formato ${v} para ${v + 1}.`);
    cur = m(cur);
  }
  return cur;
}
